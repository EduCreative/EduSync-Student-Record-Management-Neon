
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

const CloudIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M12 12v9"/><path d="m8 17 4 4 4-4"/></svg>
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

                {/* WHATSAPP STYLE BACKUP SECTION */}
                <div className="bg-white dark:bg-secondary-800 rounded-lg shadow-md p-6">
                    <div className="flex items-start gap-4 mb-6">
                        <div className="p-3 bg-primary-100 dark:bg-primary-900/30 rounded-full">
                            <CloudIcon className="w-8 h-8 text-primary-600 dark:text-primary-400" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-secondary-900 dark:text-white leading-tight">Google Drive Backup</h2>
                            <p className="text-sm text-secondary-500 mt-1 max-w-lg">
                                Backup institutional records to your private Google Drive vault. You can restore them when switching devices or reinstalling the app.
                            </p>
                        </div>
                    </div>

                    <div className="bg-secondary-50 dark:bg-secondary-900/40 rounded-xl p-5 mb-6 border dark:border-secondary-700">
                        <h3 className="text-xs font-bold text-secondary-400 uppercase tracking-widest mb-3">Last Backup</h3>
                        <div className="space-y-2">
                            <div className="flex items-baseline gap-2">
                                <span className="text-sm font-medium text-secondary-600 dark:text-secondary-400">Timestamp:</span>
                                <span className="text-sm font-bold text-secondary-900 dark:text-white">
                                    {autoBackupSettings.lastBackup ? new Date(autoBackupSettings.lastBackup).toLocaleString() : 'Never'}
                                </span>
                            </div>
                            <div className="flex items-baseline gap-2">
                                <span className="text-sm font-medium text-secondary-600 dark:text-secondary-400">File Size:</span>
                                <span className="text-sm font-bold text-secondary-900 dark:text-white">
                                    {autoBackupSettings.lastBackupSize || 'N/A'}
                                </span>
                            </div>
                        </div>

                        <div className="mt-6 flex flex-wrap gap-4">
                            <button 
                                onClick={handleManualDriveBackup} 
                                disabled={isCloudBackingUp}
                                className="px-10 py-3 bg-[#25D366] hover:bg-[#20bd5b] text-white font-black rounded-lg shadow-lg shadow-green-500/20 transition-all active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50"
                            >
                                {isCloudBackingUp ? (
                                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                ) : 'BACKUP'}
                            </button>
                            <button 
                                onClick={handleFetchCloudBackups} 
                                disabled={isFetchingCloud}
                                className="px-6 py-3 bg-secondary-200 dark:bg-secondary-700 hover:bg-secondary-300 dark:hover:bg-secondary-600 text-secondary-800 dark:text-secondary-100 font-bold rounded-lg transition-all active:scale-95 disabled:opacity-50"
                            >
                                {isFetchingCloud ? 'Searching...' : 'Restore from Drive'}
                            </button>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="flex items-center justify-between p-1">
                            <div className="flex-1">
                                <h4 className="font-bold text-secondary-800 dark:text-secondary-100">Include Photos</h4>
                                <p className="text-xs text-secondary-500 mt-0.5">Toggle to include student photos and school logos. Disabling this saves significant Drive storage and speeds up backups.</p>
                            </div>
                            <button 
                                onClick={() => updateAutoBackupSettings({ includePhotos: !autoBackupSettings.includePhotos })}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${autoBackupSettings.includePhotos ? 'bg-primary-600' : 'bg-secondary-300 dark:bg-secondary-600'}`}
                            >
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${autoBackupSettings.includePhotos ? 'translate-x-6' : 'translate-x-1'}`} />
                            </button>
                        </div>

                        <div className="flex items-center justify-between p-1 border-t dark:border-secondary-700 pt-6">
                            <div className="flex-1">
                                <h4 className="font-bold text-secondary-800 dark:text-secondary-100">Auto Backup to Google Drive</h4>
                                <p className="text-xs text-secondary-500 mt-0.5">Automatically secure your institution records based on the rotation frequency below.</p>
                            </div>
                            <button 
                                onClick={() => updateAutoBackupSettings({ enabled: !autoBackupSettings.enabled })}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${autoBackupSettings.enabled ? 'bg-primary-600 shadow-[0_0_8px_rgba(37,99,235,0.5)]' : 'bg-secondary-300 dark:bg-secondary-600'}`}
                            >
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${autoBackupSettings.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                            </button>
                        </div>

                        <div className={`p-4 bg-secondary-50 dark:bg-secondary-900/50 rounded-lg border dark:border-secondary-700 transition-all ${!autoBackupSettings.enabled ? 'opacity-40 grayscale pointer-events-none' : ''}`}>
                            <label className="text-[10px] font-black text-primary-600 uppercase block mb-1.5">Backup Frequency</label>
                            <select 
                                value={autoBackupSettings.frequency}
                                onChange={(e) => updateAutoBackupSettings({ frequency: e.target.value as any })}
                                className="bg-transparent border-none text-sm font-bold text-secondary-900 dark:text-white focus:ring-0 w-full p-0 cursor-pointer"
                            >
                                <option value="weekly">Every Week</option>
                                <option value="monthly">Every Month</option>
                            </select>
                            {autoBackupSettings.enabled && (
                                <p className="text-[10px] text-secondary-500 mt-3 flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-primary-500"></span>
                                    Next scheduled run: <span className="font-bold text-primary-600">{nextBackupDate}</span>
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                {/* INTERFACE & OTHER SETTINGS - Standard Style */}
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
