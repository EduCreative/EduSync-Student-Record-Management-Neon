import React, { useState, useEffect } from 'react';
import { Cloud, CheckCircle, RefreshCw, LogOut } from 'lucide-react';
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
    const [frequency, setFrequency] = useState<string>(() => localStorage.getItem('edusync_gdrive_frequency') || 'disabled');
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

    // Scheduled backup check
    useEffect(() => {
        if (!fbUser || frequency === 'disabled') return;

        const checkAndRunScheduledBackup = async () => {
            const lastUpload = localStorage.getItem('edusync_gdrive_last_upload');
            const now = new Date().getTime();
            let intervalMs = 0;

            if (frequency === 'daily') intervalMs = 24 * 60 * 60 * 1000;
            else if (frequency === 'weekly') intervalMs = 7 * 24 * 60 * 60 * 1000;
            else if (frequency === 'monthly') intervalMs = 30 * 24 * 60 * 60 * 1000;

            if (!lastUpload || (now - new Date(lastUpload).getTime() >= intervalMs)) {
                try {
                    console.log('Running automated scheduled Google Drive backup...');
                    const payload = await generateFullBackupPayload();
                    const res = await uploadBackupToGoogleDrive(payload, schoolName);
                    const timestampStr = new Date().toISOString();
                    localStorage.setItem('edusync_gdrive_last_upload', timestampStr);
                    localStorage.setItem('edusync_gdrive_last_filename', res.fileName);
                    setLastUploadTime(timestampStr);
                    setLastFilename(res.fileName);
                    showToast('Cloud Backup', `Scheduled backup successfully uploaded to Google Drive (${res.fileName}).`, 'success');
                } catch (err: any) {
                    console.error('Scheduled Google Drive backup failed:', err);
                }
            }
        };

        checkAndRunScheduledBackup();
    }, [fbUser, frequency, generateFullBackupPayload, schoolName, showToast]);

    const handleGoogleSignIn = async () => {
        setIsSigningIn(true);
        try {
            const result = await googleSignIn();
            if (result) {
                setFbUser(result.user);
                showToast('Success', `Connected to Google Drive as ${result.user.email}`, 'success');
            }
        } catch (err: any) {
            showToast('Google Sign-In Error', err.message || 'Failed to authenticate with Google.', 'error');
        } finally {
            setIsSigningIn(false);
        }
    };

    const handleGoogleSignOut = async () => {
        try {
            await googleSignOut();
            setFbUser(null);
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
            showToast('Cloud Backup Error', err.message || 'Failed to upload backup to Google Drive.', 'error');
        } finally {
            setIsUploading(false);
        }
    };

    const handleFrequencyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value;
        setFrequency(val);
        localStorage.setItem('edusync_gdrive_frequency', val);
        showToast('Scheduler Updated', `Cloud backup schedule set to: ${val.toUpperCase()}`, 'success');
    };

    return (
        <div className="bg-white dark:bg-secondary-800 rounded-lg shadow-md p-6 mt-6">
            <div className="flex items-start gap-4 mb-6">
                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                    <Cloud className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-secondary-900 dark:text-white leading-tight">Google Drive Cloud Backup &amp; Scheduler</h2>
                    <p className="text-sm text-secondary-500 mt-1 max-w-lg">
                        Securely backup your complete school database directly to your Owner or Admin Google Drive account automatically (Daily / Weekly / Monthly) or on-demand.
                    </p>
                </div>
            </div>

            <div className="bg-secondary-50 dark:bg-secondary-900/40 rounded-xl p-5 border dark:border-secondary-700 space-y-4">
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

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="input-label">Automated Backup Schedule</label>
                                <select
                                    value={frequency}
                                    onChange={handleFrequencyChange}
                                    className="input-field"
                                >
                                    <option value="disabled">Disabled (Manual Only)</option>
                                    <option value="daily">Daily Backup</option>
                                    <option value="weekly">Weekly Backup</option>
                                    <option value="monthly">Monthly Backup</option>
                                </select>
                                <p className="text-[11px] text-secondary-400 mt-1">Automatic backups trigger when you open the web app according to your selected frequency.</p>
                            </div>

                            <div className="bg-white dark:bg-secondary-800 p-4 rounded-lg border dark:border-secondary-700 flex flex-col justify-between">
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
                                <div className="mt-3">
                                    <button
                                        type="button"
                                        onClick={handleManualCloudBackup}
                                        disabled={isUploading}
                                        className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-50"
                                    >
                                        <RefreshCw className={`w-4 h-4 ${isUploading ? 'animate-spin' : ''}`} />
                                        {isUploading ? 'Uploading to Drive...' : 'Backup Now to Google Drive'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
