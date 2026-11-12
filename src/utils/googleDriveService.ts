import { initializeApp, getApps } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/drive.file');

let isSigningIn = false;
let cachedAccessToken: string | null = null;

export const initAuth = (
    onAuthSuccess?: (user: User, token: string) => void,
    onAuthFailure?: () => void
) => {
    return onAuthStateChanged(auth, async (user: User | null) => {
        if (user) {
            const token = cachedAccessToken || localStorage.getItem('edusync_gdrive_manual_token');
            if (token) {
                if (onAuthSuccess) onAuthSuccess(user, token);
            } else if (!isSigningIn) {
                cachedAccessToken = null;
                if (onAuthFailure) onAuthFailure();
            }
        } else {
            const manual = localStorage.getItem('edusync_gdrive_manual_token');
            if (manual && auth.currentUser) {
                if (onAuthSuccess) onAuthSuccess(auth.currentUser, manual);
            } else {
                cachedAccessToken = null;
                if (onAuthFailure) onAuthFailure();
            }
        }
    });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
    try {
        isSigningIn = true;
        const result = await signInWithPopup(auth, provider);
        const credential = GoogleAuthProvider.credentialFromResult(result);
        if (!credential?.accessToken) {
            throw new Error('Failed to get access token from Google Sign-In.');
        }

        cachedAccessToken = credential.accessToken;
        return { user: result.user, accessToken: cachedAccessToken };
    } catch (error: any) {
        console.error('Google sign-in error:', error);
        if (error.code === 'auth/unauthorized-domain') {
            const currentDomain = window.location.hostname;
            throw new Error(`Domain "${currentDomain}" is not authorized in Firebase Console. Please open your Firebase Console > Authentication > Settings > Authorized domains and add "${currentDomain}". Alternatively, use the Manual OAuth Token option below.`);
        }
        throw error;
    } finally {
        isSigningIn = false;
    }
};

export const setManualAccessToken = (token: string) => {
    cachedAccessToken = token.trim();
    localStorage.setItem('edusync_gdrive_manual_token', token.trim());
};

export const getAccessToken = async (): Promise<string | null> => {
    if (cachedAccessToken) return cachedAccessToken;
    const manual = localStorage.getItem('edusync_gdrive_manual_token');
    if (manual) return manual;
    return null;
};

export const googleSignOut = async () => {
    try {
        await auth.signOut();
    } catch {}
    cachedAccessToken = null;
    localStorage.removeItem('edusync_gdrive_manual_token');
};

/**
 * Uploads backup JSON payload to Google Drive using multipart upload.
 */
export async function uploadBackupToGoogleDrive(backupPayload: any, schoolName = 'School'): Promise<{ fileId: string; fileName: string }> {
    const accessToken = await getAccessToken();
    if (!accessToken) {
        throw new Error('Not authenticated with Google Drive. Please sign in or connect with a Google OAuth token first.');
    }

    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const timestampStr = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const sanitizedSchoolName = schoolName.replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = `EduSync_Backup_${sanitizedSchoolName}_${timestampStr}.json`;

    const fileMetadata = {
        name: fileName,
        mimeType: 'application/json',
    };

    const jsonString = JSON.stringify(backupPayload, null, 2);
    const file = new Blob([jsonString], { type: 'application/json' });

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(fileMetadata)], { type: 'application/json' }));
    form.append('file', file);

    const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
        body: form,
    });

    if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error?.message || `Google Drive upload failed with status ${response.status}`);
    }

    const data = await response.json();
    return {
        fileId: data.id,
        fileName: data.name || fileName
    };
}
