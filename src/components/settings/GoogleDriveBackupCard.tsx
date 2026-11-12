import React, { useState, useEffect } from 'react';
import { Cloud, CheckCircle, RefreshCw, LogOut, AlertTriangle, Info } from 'lucide-react';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { googleSignIn, googleSignOut, initAuth, uploadBackupToGoogleDrive } from '../../utils/googleDriveService';
import type { User as FirebaseUser } from 'firebase/auth';
import type { School } from '../../types';

export const GoogleDriveBackupCard: React.FC = () => {
    const { user, activeSchoolId } = useAuth();
    const { schools, generateFullBackupPayload } = useData();
    const { showToast } = useToast();

    const [fbUser, setFbUser] = useState<FirebaseUser | null>(null);
    const [isSigningIn, setIsSigningIn] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [domainError, setDomainError] = useState<string | null>(null);
    const [lastUploadTime, setLastUploadTime] = useState<string | null>(() => localStorage.getItem('edusync_gdrive_last_upload'));
    const [lastFilename, setLastFilename] = useState<string | null>(() => localStorage.getItem('edusync_gdrive_last_filename'));

    const effectiveSchoolId = user?.role === 'Owner' && activeSchoolId ? activeSchoolId : user?.schoolId;
    const currentSchool = schools.find((s: School) => s.id === effectiveSchoolId);
    const schoolName = currentSchool?.name || 'Institution';

    useEffect(() => {
        const unsubscribe = initAuth(
            (u) => setFbUser(u),
            () => setFbUser(null)
        );
        return () => unsubscribe();
    }, []);

    const handleGoogleSignIn = async () => {
        setIsSigningIn(true);
        setDomainError(null);
        try {
            const result = await googleSignIn();
            if (result) {
                setFbUser(result.user);
                showToast('Success', `Connected to Google Drive as ${result.user.email}`, 'success');
            }
        } catch (err: any) {
            const msg = err.message || 'Failed to authenticate with Google.';
            if (msg.includes('not authorized in Firebase Console')) {
                setDomainError(msg);
            }
            showToast('Google Sign-In Error', msg, 'error');
        } finally {
            setIsSigningIn(false);
        }
    };

    const handleGoogleSignOut = async () => {
        try {
            await googleSignOut();
            setFbUser(null);
            setDomainError(null);
            showToast('Success', 'Disconnected from Google Drive.', 'success');
        } catch (err: any) {
            showToast('Error', 'Failed to sign out from Google.', 'error');
        }
    };

    const handleManualCloudBackup = async () => {
        if (!fbUser) {
            showToast('Authentication Required', 'Please connect your Google Drive account first.', 'error');
            return;
        }

        setIsUploading(true);
        try {
            const payload = await generateFullBackupPayload();
            const res = await uploadBackupToGoogleDrive(payload, schoolName);
            const timestampStr = new Date().toISOString();
            localStorage.setItem('edusync_gdrive_last_upload', timestampStr);
            localStorage.setItem('edusync_gdrive_last_filename', res.fileName);
            setLastUploadTime(timestampStr);
            setLastFilename(res.fileName);
            showToast('Success', `Database backup uploaded to Google Drive successfully! (${res.fileName})`, 'success');
        } catch (err: any) {
            showToast('Cloud Backup Error', err.message || 'Failed to upload backup to Google Drive. Check if your Google Drive storage is full.', 'error');
        } finally {
            setIsUploading(false);
        }
    };

    const currentDomain = typeof window !== 'undefined' ? window.location.hostname : 'preview domain';

    return (
        <div className="bg-white dark:bg-secondary-800 rounded-lg shadow-md p-6 mt-6">
            <div className="flex items-start gap-4 mb-6">
                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                    <Cloud className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-secondary-900 dark:text-white leading-tight">Google Drive Cloud Backup</h2>
                    <p className="text-sm text-secondary-500 mt-1 max-w-lg">
                        Securely backup your complete school database directly to your Owner Google Drive account via manual backup to Google Drive.
                    </p>
                </div>
            </div>

            <div className="bg-secondary-50 dark:bg-secondary-900/40 rounded-xl p-5 border dark:border-secondary-700 space-y-4">
                {domainError && (
                    <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700 rounded-lg space-y-2">
                        <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-bold text-sm">
                            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                            Firebase Auth Domain Authorization Required
                        </div>
                        <p className="text-xs text-amber-700 dark:text-amber-400">
                            Your current preview domain (<code className="font-mono bg-amber-100 dark:bg-amber-900 px-1 py-0.5 rounded">{currentDomain}</code>) is not yet added to your Firebase project&apos;s authorized domains.
                        </p>
                        <ol className="text-xs text-amber-700 dark:text-amber-400 list-decimal list-inside space-y-1 pl-1">
                            <li>Open your <a href="https://console.firebase.google.com" target="_blank" rel="noreferrer" className="underline font-semibold">Firebase Console</a>.</li>
                            <li>Go to <strong>Authentication</strong> &gt; <strong>Settings</strong> &gt; <strong>Authorized domains</strong>.</li>
                            <li>Click <strong>Add domain</strong> and paste: <code className="font-mono bg-amber-100 dark:bg-amber-900 px-1 py-0.5 rounded">{currentDomain}</code>.</li>
                        </ol>
                    </div>
                )}

                {!fbUser ? (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-white dark:bg-secondary-800 rounded-lg border dark:border-secondary-700">
                        <div>
                            <p className="text-sm font-bold text-secondary-900 dark:text-white">Google Drive Connection</p>
                            <p className="text-xs text-secondary-500 mt-0.5">Link your Google account to enable direct cloud storage uploads.</p>
                        </div>
                        <button
                            type="button"
                            onClick={handleGoogleSignIn}
                            disabled={isSigningIn}
                            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow transition-all flex items-center gap-2 text-sm disabled:opacity-50"
                        >
                            <Cloud className="w-4 h-4" />
                            {isSigningIn ? 'Connecting...' : 'Connect Google Drive'}
                        </button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-lg">
                            <div className="flex items-center gap-3">
                                <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                                <div>
                                    <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300">Connected to Google Drive</p>
                                    <p className="text-sm font-semibold text-secondary-900 dark:text-white">{fbUser.email}</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={handleGoogleSignOut}
                                className="text-xs font-bold text-red-600 dark:text-red-400 hover:underline flex items-center gap-1 px-2 py-1"
                            >
                                <LogOut className="w-3.5 h-3.5" />
                                Disconnect
                            </button>
                        </div>

                        <div className="bg-white dark:bg-secondary-800 p-4 rounded-lg border dark:border-secondary-700 flex flex-col sm:flex-row items-center justify-between gap-4">
                            <div>
                                <span className="text-xs font-bold text-secondary-400 uppercase tracking-widest block mb-1">Cloud Backup Status</span>
                                <p className="text-xs text-secondary-600 dark:text-secondary-300">
                                    Last Upload: <strong className="text-secondary-900 dark:text-white">{lastUploadTime ? new Date(lastUploadTime).toLocaleString() : 'Never'}</strong>
                                </p>
                                {lastFilename && (
                                    <p className="text-[11px] font-mono text-secondary-500 truncate mt-0.5" title={lastFilename}>
                                        File: {lastFilename}
                                    </p>
                                )}
                            </div>
                            <button
                                type="button"
                                onClick={handleManualCloudBackup}
                                disabled={isUploading}
                                className="py-2.5 px-6 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-50 shrink-0"
                            >
                                <RefreshCw className={`w-4 h-4 ${isUploading ? 'animate-spin' : ''}`} />
                                {isUploading ? 'Uploading to Drive...' : 'Backup Now to Google Drive'}
                            </button>
                        </div>
                    </div>
                )}

                <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg text-xs text-blue-800 dark:text-blue-300">
                    <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                    <p>
                        Automatic scheduled backups are not supported from the browser. Use <code className="bg-blue-100 dark:bg-blue-900/60 px-1 py-0.5 rounded font-mono">npm run backup</code> on a schedule for automatic backups.
                    </p>
                </div>
            </div>
        </div>
    );
};
