import React, { useState, useEffect } from 'react';
import { Cloud, CheckCircle, RefreshCw, LogOut, KeyRound, AlertTriangle, HelpCircle } from 'lucide-react';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { googleSignIn, googleSignOut, initAuth, uploadBackupToGoogleDrive, setManualAccessToken } from '../../utils/googleDriveService';
import type { User as FirebaseUser } from 'firebase/auth';
import type { School } from '../../types';

export const GoogleDriveBackupCard: React.FC = () => {
    const { user, activeSchoolId } = useAuth();
    const { schools, generateFullBackupPayload } = useData();
    const { showToast } = useToast();

    const [fbUser, setFbUser] = useState<FirebaseUser | null>(null);
    const [isSigningIn, setIsSigningIn] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [showManualInput, setShowManualInput] = useState(false);
    const [manualToken, setManualToken] = useState('');
    const [domainError, setDomainError] = useState<string | null>(null);
    const [frequency, setFrequency] = useState<string>(() => localStorage.getItem('edusync_gdrive_frequency') || 'disabled');
    const [lastUploadTime, setLastUploadTime] = useState<string | null>(() => localStorage.getItem('edusync_gdrive_last_upload'));
    const [lastFilename, setLastFilename] = useState<string | null>(() => localStorage.getItem('edusync_gdrive_last_filename'));

    const effectiveSchoolId = user?.role === 'Owner' && activeSchoolId ? activeSchoolId : user?.schoolId;
    const currentSchool = schools.find((s: School) => s.id === effectiveSchoolId);
    const schoolName = currentSchool?.name || 'Institution';

    useEffect(() => {
        const unsubscribe = initAuth(
            (u) => setFbUser(u),
            () => {
                if (localStorage.getItem('edusync_gdrive_manual_token')) {
                    setFbUser({ email: 'connected.via.token@edusync.local' } as any);
                } else {
                    setFbUser(null);
                }
            }
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
                    showToast('Cloud Backup Error', err.message || 'Scheduled backup failed (Check Google Drive storage quota).', 'error');
                }
            }
        };

        checkAndRunScheduledBackup();
    }, [fbUser, frequency, generateFullBackupPayload, schoolName, showToast]);

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

    const handleSaveManualToken = (e: React.FormEvent) => {
        e.preventDefault();
        if (!manualToken.trim()) return;
        setManualAccessToken(manualToken);
        setFbUser({ email: 'connected.via.token@edusync.local' } as any);
        setShowManualInput(false);
        setManualToken('');
        setDomainError(null);
        showToast('Success', 'Google Drive access token linked successfully!', 'success');
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

    const handleFrequencyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value;
        setFrequency(val);
        localStorage.setItem('edusync_gdrive_frequency', val);
        showToast('Scheduler Updated', `Cloud backup schedule set to: ${val.toUpperCase()}`, 'success');
    };

    const currentDomain = typeof window !== 'undefined' ? window.location.hostname : 'preview domain';

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
                        <p className="text-xs text-amber-700 dark:text-amber-400 pt-1">
                            Alternatively, you can link Google Drive instantly using the <strong>Enter Token Manually</strong> option below.
                        </p>
                    </div>
                )}

                {!fbUser ? (
                    <div className="space-y-4">
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-white dark:bg-secondary-800 rounded-lg border dark:border-secondary-700">
                            <div>
                                <p className="text-sm font-bold text-secondary-900 dark:text-white">Google Drive Connection</p>
                                <p className="text-xs text-secondary-500 mt-0.5">Link your Google account to enable direct cloud storage uploads.</p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    onClick={handleGoogleSignIn}
                                    disabled={isSigningIn}
                                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow transition-all flex items-center gap-2 text-sm disabled:opacity-50"
                                >
                                    <Cloud className="w-4 h-4" />
                                    {isSigningIn ? 'Connecting...' : 'Connect Google Drive'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowManualInput(!showManualInput)}
                                    className="px-4 py-2.5 bg-secondary-200 dark:bg-secondary-700 hover:bg-secondary-300 dark:hover:bg-secondary-600 text-secondary-800 dark:text-secondary-200 font-bold rounded-lg transition-all flex items-center gap-2 text-sm"
                                >
                                    <KeyRound className="w-4 h-4" />
                                    {showManualInput ? 'Hide Token Guide' : 'Enter Token Manually'}
                                </button>
                            </div>
                        </div>

                        {showManualInput && (
                            <form onSubmit={handleSaveManualToken} className="p-4 bg-white dark:bg-secondary-800 rounded-lg border dark:border-secondary-700 space-y-4">
                                <div className="border-b pb-3 dark:border-secondary-700">
                                    <div className="flex items-center gap-2 text-secondary-900 dark:text-white font-bold text-sm mb-1">
                                        <HelpCircle className="w-4 h-4 text-primary-600" />
                                        How to get a Google OAuth Access Token (Step-by-Step Guide):
                                    </div>
                                    <ol className="text-xs text-secondary-600 dark:text-secondary-300 list-decimal list-inside space-y-1.5 pl-1">
                                        <li>Open the official <a href="https://developers.google.com/oauthplayground/" target="_blank" rel="noreferrer" className="text-primary-600 dark:text-primary-400 underline font-semibold">Google OAuth 2.0 Playground</a>.</li>
                                        <li>On the left sidebar, scroll down and expand <strong>Drive API v3</strong>.</li>
                                        <li>Select scope: <code className="bg-secondary-100 dark:bg-secondary-900 px-1 py-0.5 rounded font-mono text-[11px]">https://www.googleapis.com/auth/drive.file</code>.</li>
                                        <li>Click the blue <strong>Authorize APIs</strong> button and sign in with your Google account.</li>
                                        <li>Under Step 2 (&quot;Exchange authorization code for tokens&quot;), click <strong>Exchange authorization code for token</strong>.</li>
                                        <li>Copy the resulting **Access token** (starts with <code className="bg-secondary-100 dark:bg-secondary-900 px-1 py-0.5 rounded font-mono text-[11px]">ya29...</code>) and paste it below.</li>
                                    </ol>
                                    <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-2 font-medium">
                                        ⚠️ <em>Note on Token Expiry:</em> Manual tokens generated via OAuth Playground expire after <strong>1 hour</strong>. For permanent automated backups without expiration, use <strong>Connect Google Drive</strong> (after adding your domain to Firebase).
                                    </p>
                                </div>

                                <div>
                                    <label className="input-label">Paste Access Token Here</label>
                                    <input
                                        type="password"
                                        required
                                        placeholder="ya29.a0..."
                                        value={manualToken}
                                        onChange={e => setManualToken(e.target.value)}
                                        className="input-field font-mono text-xs"
                                    />
                                </div>
                                <div className="flex justify-end">
                                    <button type="submit" className="btn-primary text-xs font-bold py-2 px-4">
                                        Save &amp; Link Token
                                    </button>
                                </div>
                            </form>
                        )}
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
