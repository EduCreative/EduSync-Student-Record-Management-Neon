
import React, { useRef, useState, useEffect, useMemo } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { DownloadIcon, UploadIcon } from '../../constants';
import Modal from '../common/Modal';
import { UserRole } from '../../types';
import { useToast } from '../../context/ToastContext';
import ImageUpload from '../common/ImageUpload';
import { deleteDatabase } from '../../lib/db';
import { driveService, DriveFile } from '../../utils/googleDriveService';
import IncreaseTuitionFeeModal from './IncreaseTuitionFeeModal';

const GoogleIcon = () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
);

const SettingsPage: React.FC = () => {
    const { toggleTheme, increaseFontSize, decreaseFontSize, resetFontSize, syncMode, setSyncMode, sidebarMode, setSidebarMode } = useTheme();
    const { user, effectiveRole, activeSchoolId } = useAuth();
    const { schools, backupData, backupToDrive, restoreData, updateSchool, feeHeads, addFeeHead, updateFeeHead, autoBackupSettings, updateAutoBackupSettings } = useData();
    const { showToast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [restoreFile, setRestoreFile] = useState<File | null>(null);

    // State for School Details
    const [isSchoolSaving, setIsSchoolSaving] = useState(false);
    const effectiveSchoolId = user?.role === UserRole.Owner && activeSchoolId ? activeSchoolId : user?.schoolId;
    const school = schools.find(s => s.id === effectiveSchoolId);
    
    const [schoolDetails, setSchoolDetails] = useState({ name: '', address: '', logoUrl: null as string | null | undefined });
    const [defaultTuitionFee, setDefaultTuitionFee] = useState(0);

    // Cloud Backup State
    const [isCloudBackingUp, setIsCloudBackingUp] = useState(false);
    const [driveBackups, setDriveBackups] = useState<DriveFile[]>([]);
    const [isFetchingCloud, setIsFetchingCloud] = useState(false);
    const [showCloudPicker, setShowCloudPicker] = useState(false);

    // State for Class Promotion
    const [isTuitionFeeModalOpen, setIsTuitionFeeModalOpen] = useState(false);
    const [isResetModalOpen, setIsResetModalOpen] = useState(false);

    // Initialize forms and preferences from user data
    useEffect(() => {
        if (school) {
            setSchoolDetails({
                name: school.name,
                address: school.address,
                logoUrl: school.logoUrl,
            });
            const tuitionFeeHead = feeHeads.find(fh => fh.schoolId === effectiveSchoolId && fh.name.toLowerCase() === 'tuition fee');
            setDefaultTuitionFee(tuitionFeeHead?.defaultAmount || 0);
        }
    }, [school, feeHeads, effectiveSchoolId]);
    
    const nextBackupDate = useMemo(() => {
        if (!autoBackupSettings.lastBackup) return "Ready for first run";
        const last = new Date(autoBackupSettings.lastBackup);
        const days = autoBackupSettings.frequency === 'weekly' ? 7 : 30;
        last.setDate(last.getDate() + days);
        return last.toLocaleDateString();
    }, [autoBackupSettings]);

    const handleSchoolUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!school || !schoolDetails.name.trim() || !effectiveSchoolId) return;

        setIsSchoolSaving(true);
        try {
            await updateSchool({
                id: school.id,
                name: schoolDetails.name,
                address: schoolDetails.address,
                logoUrl: schoolDetails.logoUrl
            });
            
            const tuitionFeeHead = feeHeads.find(fh => fh.schoolId === effectiveSchoolId && fh.name.toLowerCase() === 'tuition fee');
            if (tuitionFeeHead) {
                if (tuitionFeeHead.defaultAmount !== defaultTuitionFee) {
                    await updateFeeHead({ ...tuitionFeeHead, defaultAmount: defaultTuitionFee });
                }
            } else {
                await addFeeHead({ name: 'Tuition Fee', defaultAmount: defaultTuitionFee, schoolId: effectiveSchoolId });
            }

            showToast('Success', 'School details updated!', 'success');
        } catch (error: any) {
            showToast('Error', error.message || 'Failed to update school details.', 'error');
        } finally {
            setIsSchoolSaving(false);
        }
    };

    const handleRestoreInitiate = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files.length > 0) {
            setRestoreFile(event.target.files[0]);
        }
        event.target.value = '';
    };

    const handleConfirmRestore = async () => {
        if (restoreFile) {
            setRestoreFile(null);
            await restoreData(restoreFile);
        }
    };

    const handleManualDriveBackup = async () => {
        setIsCloudBackingUp(true);
        await backupToDrive();
        setIsCloudBackingUp(false);
    };

    const handleFetchCloudBackups = async () => {
        setIsFetchingCloud(true);
        try {
            const files = await driveService.listBackups();
            setDriveBackups(files);
            setShowCloudPicker(true);
        } catch (err: any) {
            showToast('Cloud Error', err.message || 'Failed to access Drive.', 'error');
        } finally {
            setIsFetchingCloud(false);
        }
    };

    const handleRestoreFromCloud = async (file: DriveFile) => {
        if (!window.confirm(`Overhaul existing records with system state from ${file.name}?`)) return;
        
        setShowCloudPicker(false);
        try {
            const content = await driveService.downloadFile(file.id);
            const blob = new Blob([content], { type: 'application/json' });
            const virtualFile = new File([blob], file.name, { type: 'application/json' });
            await restoreData(virtualFile);
        } catch (err: any) {
            showToast('Restore Failed', err.message || 'Error downloading file.', 'error');
        }
    };

    const handleHardReset = async () => {
        setIsResetModalOpen(false);
        showToast('Resetting...', 'Clearing local environment cache.', 'info');
        try {
            await deleteDatabase();
            setTimeout(() => { window.location.reload(); }, 1500);
        } catch (error) {
            showToast('Reset Failed', 'Clear storage manually in browser.', 'error');
        }
    };

    const handleSyncModeChange = async (mode: 'offline' | 'online') => {
        if (syncMode === mode) return;
        showToast('Updating Configuration', `Swapping to ${mode} sync architecture.`, 'info');
        if (mode === 'online') { await deleteDatabase(); }
        setSyncMode(mode);
        setTimeout(() => { window.location.reload(); }, 1500);
    };
    
    return (
        <>
            <Modal isOpen={!!restoreFile} onClose={() => setRestoreFile(null)} title="Confirm Snapshot Load">
                <p className="text-secondary-600 dark:text-secondary-400">Restore state from <strong>{restoreFile?.name}</strong>? Existing local records will be purged before reconstruction.</p>
                <div className="flex justify-end space-x-2 pt-4">
                    <button type="button" onClick={() => setRestoreFile(null)} className="btn-secondary">Cancel</button>
                    <button type="button" onClick={handleConfirmRestore} className="btn-danger">Start Reconstruction</button>
                </div>
            </Modal>

            <Modal isOpen={showCloudPicker} onClose={() => setShowCloudPicker(false)} title="Available Cloud Snapshots">
                <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
                    {driveBackups.length > 0 ? driveBackups.map(file => (
                        <div key={file.id} className="p-3 border rounded-lg hover:bg-secondary-50 dark:hover:bg-secondary-700/50 flex justify-between items-center group transition-colors">
                            <div>
                                <p className="text-sm font-bold text-secondary-900 dark:text-white">{file.name}</p>
                                <p className="text-[10px] text-secondary-500 uppercase tracking-widest">{new Date(file.modifiedTime).toLocaleString()}</p>
                            </div>
                            <button onClick={() => handleRestoreFromCloud(file)} className="text-xs btn-primary py-1.5 px-4 shadow-none font-bold uppercase tracking-tighter">Reconstruct</button>
                        </div>
                    )) : <p className="text-center py-8 text-secondary-500 italic">No valid EduSync snapshots found in Drive.</p>}
                </div>
            </Modal>

            <IncreaseTuitionFeeModal isOpen={isTuitionFeeModalOpen} onClose={() => setIsTuitionFeeModalOpen(false)} />
            <Modal isOpen={isResetModalOpen} onClose={() => setIsResetModalOpen(false)} title="System Cache Reset">
                <p>Delete all locally cached data? You will need to log in again to re-sync with the cloud database.</p>
                <div className="flex justify-end space-x-2 pt-4">
                    <button type="button" onClick={() => setIsResetModalOpen(false)} className="btn-secondary">Cancel</button>
                    <button type="button" onClick={handleHardReset} className="btn-danger">Reset & Logout</button>
                </div>
            </Modal>

            <div className="max-w-4xl mx-auto space-y-8">
                <h1 className="text-3xl font-bold text-secondary-900 dark:text-white">Settings</h1>

                <div className="bg-white dark:bg-secondary-800 rounded-lg shadow-md p-6">
                    <h2 className="text-xl font-semibold border-b pb-3 dark:border-secondary-700 mb-6">Cloud Backup (Google Drive)</h2>
                    <div className="space-y-6">
                        <div className="p-4 bg-primary-50 dark:bg-primary-900/20 rounded-lg flex items-start gap-4">
                            <div className="p-2 bg-white dark:bg-secondary-800 rounded-full shadow-sm flex-shrink-0 border dark:border-secondary-700"><GoogleIcon /></div>
                            <div className="flex-1">
                                <h3 className="font-semibold text-secondary-900 dark:text-white">External Cloud Vault</h3>
                                <p className="text-sm text-secondary-600 dark:text-secondary-400 mt-1">
                                    Secure your institution's records in your private Google Drive. This acts as an immutable second layer of safety.
                                </p>
                                <div className="mt-4 flex flex-wrap gap-3">
                                    <button onClick={handleManualDriveBackup} disabled={isCloudBackingUp} className="btn-primary">
                                        {isCloudBackingUp ? 'Securing...' : 'Backup Now'}
                                    </button>
                                    <button onClick={handleFetchCloudBackups} disabled={isFetchingCloud} className="btn-secondary">
                                        {isFetchingCloud ? 'Searching...' : 'Restore from Cloud'}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="border-t dark:border-secondary-700 pt-6">
                            <h3 className="font-semibold text-secondary-900 dark:text-white mb-4 uppercase text-xs tracking-widest">Scheduled Automation</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="flex items-center justify-between p-3 bg-secondary-50 dark:bg-secondary-900/50 rounded-lg border dark:border-secondary-700">
                                    <div>
                                        <p className="font-medium text-sm">Background Snapshots</p>
                                        <p className="text-[10px] text-secondary-500 uppercase font-bold">Safe Automatic Sync</p>
                                    </div>
                                    <button 
                                        onClick={() => updateAutoBackupSettings({ enabled: !autoBackupSettings.enabled })}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${autoBackupSettings.enabled ? 'bg-primary-600 shadow-[0_0_8px_rgba(37,99,235,0.5)]' : 'bg-secondary-300 dark:bg-secondary-600'}`}
                                    >
                                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${autoBackupSettings.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                                    </button>
                                </div>

                                <div className={`p-3 bg-secondary-50 dark:bg-secondary-900/50 rounded-lg border dark:border-secondary-700 transition-opacity ${!autoBackupSettings.enabled ? 'opacity-50 pointer-events-none' : ''}`}>
                                    <label className="text-[10px] font-extrabold text-secondary-500 uppercase block mb-1">Rotation Interval</label>
                                    <select 
                                        value={autoBackupSettings.frequency}
                                        onChange={(e) => updateAutoBackupSettings({ frequency: e.target.value as any })}
                                        className="bg-transparent border-none text-sm font-semibold focus:ring-0 w-full p-0 cursor-pointer"
                                    >
                                        <option value="weekly">Weekly Reconstruction</option>
                                        <option value="monthly">Monthly Snapshot</option>
                                    </select>
                                </div>
                            </div>

                            {autoBackupSettings.enabled && (
                                <div className="mt-4 flex items-center gap-4 text-xs text-secondary-500 bg-secondary-50 dark:bg-secondary-900/50 p-2.5 rounded border border-dashed dark:border-secondary-700">
                                    <div className="flex-1">
                                        <span className="font-bold uppercase mr-1 opacity-60">Last Sync:</span>
                                        {autoBackupSettings.lastBackup ? new Date(autoBackupSettings.lastBackup).toLocaleString() : 'Not synced yet'}
                                    </div>
                                    <div className="flex-1 text-right">
                                        <span className="font-bold uppercase mr-1 text-primary-600">Next Due:</span>
                                        {nextBackupDate}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-secondary-800 rounded-lg shadow-md p-6">
                    <h2 className="text-xl font-semibold border-b pb-3 dark:border-secondary-700 mb-6">Interface Options</h2>
                     <div className="space-y-4">
                        <div className="flex flex-col sm:flex-row gap-4">
                            <div className={`flex-1 p-4 border-2 rounded-lg cursor-pointer transition-all ${sidebarMode === 'fixed' ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'border-secondary-200 dark:border-secondary-700'}`} onClick={() => setSidebarMode('fixed')}>
                                <h3 className="font-semibold text-sm">Traditional Sidebar</h3>
                                <p className="text-[10px] text-secondary-500 uppercase">Always Expanded</p>
                            </div>
                            <div className={`flex-1 p-4 border-2 rounded-lg cursor-pointer transition-all ${sidebarMode === 'collapsible' ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'border-secondary-200 dark:border-secondary-700'}`} onClick={() => setSidebarMode('collapsible')}>
                                <h3 className="font-semibold text-sm">Compact Workspace</h3>
                                <p className="text-[10px] text-secondary-500 uppercase">Auto-Collapse</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-secondary-800 rounded-lg shadow-md p-6">
                    <h2 className="text-xl font-semibold border-b pb-3 dark:border-secondary-700 mb-6">Sync Architecture</h2>
                     <div className="space-y-4">
                        <div className="flex flex-col sm:flex-row gap-4">
                            <div className={`flex-1 p-4 border-2 rounded-lg cursor-pointer transition-all ${syncMode === 'offline' ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'border-secondary-200 dark:border-secondary-700'}`} onClick={() => handleSyncModeChange('offline')}>
                                <h3 className="font-semibold text-sm text-primary-600">Hybrid (Recommended)</h3>
                                <p className="text-[10px] text-secondary-500">Fast local access with background persistence.</p>
                            </div>
                            <div className={`flex-1 p-4 border-2 rounded-lg cursor-pointer transition-all ${syncMode === 'online' ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'border-secondary-200 dark:border-secondary-700'}`} onClick={() => handleSyncModeChange('online')}>
                                <h3 className="font-semibold text-sm">Direct Online</h3>
                                <p className="text-[10px] text-secondary-500">Real-time Neon queries without local caching.</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-secondary-800 rounded-lg shadow-md p-6">
                    <h2 className="text-xl font-semibold border-b pb-3 dark:border-secondary-700 mb-6">Accessibility</h2>
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <label className="font-medium text-secondary-700 dark:text-secondary-300">Display Theme</label>
                            <button onClick={toggleTheme} className="btn-secondary shadow-none">Cycle Light/Dark</button>
                        </div>
                         <div className="flex items-center justify-between">
                            <label className="font-medium text-secondary-700 dark:text-secondary-300">Text Scaling</label>
                            <div className="flex items-center space-x-2">
                                <button onClick={decreaseFontSize} className="btn-secondary px-3 shadow-none">-</button>
                                <button onClick={resetFontSize} className="btn-secondary shadow-none">Default</button>
                                <button onClick={increaseFontSize} className="btn-secondary px-3 shadow-none">+</button>
                            </div>
                        </div>
                    </div>
                </div>

                 {effectiveRole === UserRole.Admin && (
                    <div className="bg-white dark:bg-secondary-800 rounded-lg shadow-md p-6">
                        <div className="flex justify-between items-center border-b pb-3 dark:border-secondary-700 mb-6">
                            <h2 className="text-xl font-semibold">Institution Profile</h2>
                            <button onClick={() => setIsTuitionFeeModalOpen(true)} className="text-xs font-bold text-primary-600 hover:underline">
                                Bulk Tuition Manager
                            </button>
                        </div>
                        <form onSubmit={handleSchoolUpdate} className="space-y-4">
                             <ImageUpload imageUrl={schoolDetails.logoUrl} onChange={(newLogoUrl) => setSchoolDetails(prev => ({...prev, logoUrl: newLogoUrl}))} bucketName="logos" />
                            <div>
                                <label className="input-label">Legal Name</label>
                                <input type="text" value={schoolDetails.name} onChange={e => setSchoolDetails(p => ({...p, name: e.target.value}))} className="input-field" />
                            </div>
                             <div>
                                <label className="input-label">Mailing Address</label>
                                <textarea value={schoolDetails.address} onChange={e => setSchoolDetails(p => ({...p, address: e.target.value}))} className="input-field" rows={2}></textarea>
                            </div>
                            <div className="flex justify-end pt-4">
                                <button type="submit" className="btn-primary" disabled={isSchoolSaving}>{isSchoolSaving ? 'Saving...' : 'Update Institution Profile'}</button>
                            </div>
                        </form>
                    </div>
                )}

                {effectiveRole === UserRole.Admin && syncMode === 'offline' && (
                    <div className="bg-white dark:bg-secondary-800 rounded-lg shadow-md p-6 border-t-4 border-red-500">
                        <h2 className="text-xl font-semibold border-b pb-3 dark:border-secondary-700 mb-6">Danger Zone</h2>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <p className="font-medium text-sm">Download Local Copy</p>
                                <button onClick={backupData} className="btn-secondary text-xs shadow-none"><DownloadIcon className="w-3 h-3 mr-1" /> JSON Export</button>
                            </div>
                             <div className="flex items-center justify-between">
                                <p className="font-medium text-sm">Manual File Import</p>
                                <input ref={fileInputRef} type="file" accept=".json" onChange={handleRestoreInitiate} className="hidden" />
                                <button onClick={() => fileInputRef.current?.click()} className="btn-secondary text-xs shadow-none"><UploadIcon className="w-3 h-3 mr-1"/> Load File</button>
                            </div>
                            <div className="flex items-center justify-between pt-2">
                                <p className="font-medium text-sm text-red-500">Troubleshoot Environment</p>
                                <button onClick={() => setIsResetModalOpen(true)} className="text-xs text-red-600 hover:underline">Hard Reset Database</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
};

export default SettingsPage;
