
/**
 * Utility for Google Drive Backup/Restore
 * Requires VITE_GOOGLE_CLIENT_ID environment variable
 */

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const SCOPES = 'https://www.googleapis.com/auth/drive.file';

export interface DriveFile {
    id: string;
    name: string;
    modifiedTime: string;
}

class GoogleDriveService {
    private tokenClient: any = null;
    private accessToken: string | null = null;
    private resolveToken: ((token: string) => void) | null = null;
    private rejectToken: ((reason: any) => void) | null = null;

    init() {
        return new Promise<void>((resolve, reject) => {
            if (this.tokenClient) return resolve();
            
            if (!(window as any).google) {
                return reject(new Error('Google Identity Services script not loaded. Please check your internet connection and refresh.'));
            }

            try {
                this.tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
                    client_id: CLIENT_ID,
                    scope: SCOPES,
                    callback: (response: any) => {
                        if (response.error) {
                            if (this.rejectToken) this.rejectToken(new Error(response.error_description || response.error));
                        } else {
                            this.accessToken = response.access_token;
                            if (this.resolveToken) this.resolveToken(response.access_token);
                        }
                        // Reset handlers
                        this.resolveToken = null;
                        this.rejectToken = null;
                    },
                });
                resolve();
            } catch (err) {
                reject(err);
            }
        });
    }

    async getAccessToken(): Promise<string> {
        // If we have a fresh token, use it
        if (this.accessToken) {
            return this.accessToken;
        }

        return new Promise((resolve, reject) => {
            this.resolveToken = resolve;
            this.rejectToken = reject;

            this.init().then(() => {
                try {
                    // Trigger the GIS popup. GIS handles the callback we defined in initTokenClient.
                    this.tokenClient.requestAccessToken({ prompt: '' });
                } catch (err) {
                    reject(err);
                }
            }).catch(reject);
        });
    }

    async uploadFile(fileName: string, content: string): Promise<void> {
        const token = await this.getAccessToken();
        
        const metadata = {
            name: fileName,
            mimeType: 'application/json',
        };

        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', new Blob([content], { type: 'application/json' }));

        const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: form,
        });

        if (!response.ok) {
            if (response.status === 401) {
                this.accessToken = null; // Token likely expired
                throw new Error("Session expired. Please try the backup again to re-authorize.");
            }
            throw new Error(`Upload failed: ${response.statusText}`);
        }
    }

    async listBackups(): Promise<DriveFile[]> {
        const token = await this.getAccessToken();
        const response = await fetch(
            'https://www.googleapis.com/drive/v3/files?q=mimeType="application/json" and trashed=false&fields=files(id, name, modifiedTime)',
            {
                headers: { Authorization: `Bearer ${token}` },
            }
        );

        if (!response.ok) {
            if (response.status === 401) this.accessToken = null;
            throw new Error(`Failed to list files: ${response.statusText}`);
        }

        const data = await response.json();
        return (data.files || []).filter((f: any) => f.name.startsWith('edusync_backup_'));
    }

    async downloadFile(fileId: string): Promise<string> {
        const token = await this.getAccessToken();
        const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
            headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) {
            if (response.status === 401) this.accessToken = null;
            throw new Error(`Download failed: ${response.statusText}`);
        }

        return await response.text();
    }
}

export const driveService = new GoogleDriveService();
