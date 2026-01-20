
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

const OperationProgressOverlay: React.FC<{ progress: { percentage: number; status: string } }> = ({ progress }) => {
    if (progress.percentage === 0) return null;
    return (
        <div className="fixed inset-0 z-[60] bg-secondary-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-secondary-800 rounded-2xl shadow-2xl p-8 max-w-md w-full border border-primary-500/30">
                <div className="flex flex-col items-center text-center space-y-6">
                    <div className="w-16 h-16 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                        <svg className="w-8 h-8 text-primary-600 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                    </div>
                    <div className="space-y-2">
                        <h3 className="text-xl font-bold">Processing Data</h3>
                        <p className="text-sm text-secondary-500 dark:text-secondary-400">{progress.status}</p>
                    </div>
                    <div className="w-full space-y-2">
                        <div className="flex justify-between text-xs font-bold text-primary-600">
                            <span>Progress</span>
                            <span>{progress.percentage}%</span>
                        </div>
                        <div className="w-full bg-secondary-100 dark:bg-secondary-700 rounded-full h-3 overflow-hidden">
                            <div 
                                className="bg-primary-600 h-full transition-all duration-500 ease-out shadow-[0_0_10px_rgba(37,99,235,0.5)]" 
                                style={{ width: `${progress.percentage}%` }}
                            ></div>
                        </div>
                    </div>
                    <p className="text-[10px] text-secondary-400 uppercase tracking-widest">Please do not refresh or close this tab</p>
                </div>
            </div>
        </div>
    );
};

const SettingsPage: React.FC = () => {
    const { toggleTheme, increaseFontSize, decreaseFontSize, resetFontSize, syncMode, setSyncMode, sidebarMode, setSidebarMode } = useTheme();
    const { user, effectiveRole, activeSchoolId } = useAuth();
    const { schools, backupData, backupToDrive, restoreData, updateSchool, feeHeads, addFeeHead, updateFeeHead, operationProgress, autoBackupSettings, updateAutoBackupSettings, ...data } = useData();
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
        if (!autoBackupSettings.lastBackup) return "Run now to schedule next";
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
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error("Request timed out.")), 15000)
            );

            await Promise.race([
                updateSchool({
                    id: school.id,
                    name: schoolDetails.name,
                    address: schoolDetails.address,
                    logoUrl: schoolDetails.logoUrl
                }),
                timeoutPromise
            ]);
            
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
        if (!window.confirm(`Restore data from ${file.name}? Current local data will be overwritten.`)) return;
        
        setShowCloudPicker(false);
        try {
            const content = await driveService.downloadFile(file.id);
            const blob = new Blob([content], { type: 'application/json' });
            const virtualFile = new File([blob], file.name, { type: 'application/json' });
            await restoreData(virtualFile);
            showToast('Success', 'Data restored from cloud.', 'success');
        } catch (err: any) {
            showToast('Restore Failed', err.message || 'Error downloading file.', 'error');
        }
    };

    const handleHardReset = async () => {
        setIsResetModalOpen(false);
        showToast('Resetting...', 'Clearing local data and preparing to re-sync.', 'info');
        try {
            await deleteDatabase();
            setTimeout(() => {
                window.location.reload();
            }, 1500);
        } catch (error) {
            console.error('Failed to delete database:', error);
            showToast('Reset Failed', 'Could not clear local data.', 'error');
        }
    };

    const handleSyncModeChange = async (mode: 'offline' | 'online') => {
        if (syncMode === mode) return;
        showToast('Changing Sync Mode', `Switching to ${mode} mode. The app will now reload.`, 'info');
        if (mode === 'online') {
            await deleteDatabase();
        }
        setSyncMode(mode);
        setTimeout(() => {
            window.location.reload();
        }, 1500);
    };
    
    return (
        <>
            <OperationProgressOverlay progress={operationProgress} />

            <Modal isOpen={!!restoreFile} onClose={() => setRestoreFile(null)} title="Confirm Data Restore">
                <p>Are you sure you want to restore data from <strong>{restoreFile?.name}</strong>? This will overwrite all existing data for the current school. This action cannot be undone.</p>
                <div className="flex justify-end space-x-2 pt-4">
                    <button type="button" onClick={() => setRestoreFile(null)} className="btn-secondary">Cancel</button>
                    <button type="button" onClick={handleConfirmRestore} className="btn-danger">Confirm Restore</button>
                </div>
            </Modal>

            <Modal isOpen={showCloudPicker} onClose={() => setShowCloudPicker(false)} title="Select Cloud Backup to Restore">
                <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
                    {driveBackups.length > 0 ? driveBackups.map(file => (
                        <div key={file.id} className="p-3 border rounded-lg hover:bg-secondary-50 dark:hover:bg-secondary-700/50 flex justify-between items-center group">
                            <div>
                                <p className="text-sm font-semibold">{file.name}</p>
                                <p className="text-xs text-secondary-500">{new Date(file.modifiedTime).toLocaleString()}</p>
                            </div>
                            <button onClick={() => handleRestoreFromCloud(file)} className="text-xs btn-primary py-1 px-3">Restore</button>
                        </div>
                    )) : <p className="text-center py-4 text-secondary-500">No backups found in your Google Drive.</p>}
                </div>
            </Modal>

            <IncreaseTuitionFeeModal isOpen={isTuitionFeeModalOpen} onClose={() => setIsTuitionFeeModalOpen(false)} />
            <Modal isOpen={isResetModalOpen} onClose={() => setIsResetModalOpen(false)} title="Confirm Hard Reset">
                <p>Are you sure you want to clear all local data? This will log you out and re-download all information from the server upon your next login.</p>
                <div className="flex justify-end space-x-2 pt-4">
                    <button type="button" onClick={() => setIsResetModalOpen(false)} className="btn-secondary">Cancel</button>
                    <button type="button" onClick={handleHardReset} className="btn-danger">Clear Data & Reload</button>
                </div>
            </Modal>

            <div className="max-w-4xl mx-auto space-y-8">
                <h1 className="text-3xl font-bold text-secondary-900 dark:text-white">Settings</h1>

                <div className="bg-white dark:bg-secondary-800 rounded-lg shadow-md p-6">
                    <h2 className="text-xl font-semibold border-b pb-3 dark:border-secondary-700 mb-6">Cloud Backup (Google Drive)</h2>
                    <div className="space-y-6">
                        <div className="p-4 bg-primary-50 dark:bg-primary-900/20 rounded-lg flex items-start gap-4">
                            <div className="p-2 bg-white dark:bg-secondary-800 rounded-full shadow-sm"><GoogleIcon /></div>
                            <div className="flex-1">
                                <h3 className="font-semibold text-secondary-900 dark:text-white">Personal Cloud Storage</h3>
                                <p className="text-sm text-secondary-600 dark:text-secondary-400 mt-1">
                                    Securely save and retrieve system snapshots using your own Google Drive. EduSync only accesses files it creates.
                                </p>
                                <div className="mt-4 flex flex-wrap gap-3">
                                    <button onClick={handleManualDriveBackup} disabled={isCloudBackingUp} className="btn-primary">
                                        {isCloudBackingUp ? 'Uploading...' : 'Backup to Drive'}
                                    </button>
                                    <button onClick={handleFetchCloudBackups} disabled={isFetchingCloud} className="btn-secondary">
                                        {isFetchingCloud ? 'Searching...' : 'Restore from Drive'}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="border-t dark:border-secondary-700 pt-6">
                            <h3 className="font-semibold text-secondary-900 dark:text-white mb-4">Automation</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="flex items-center justify-between p-3 bg-secondary-50 dark:bg-secondary-900/50 rounded-lg border dark:border-secondary-700">
                                    <div>
                                        <p className="font-medium">Scheduled Backup</p>
                                        <p className="text-xs text-secondary-500">Run automatically when you are active.</p>
                                    </div>
                                    <button 
                                        onClick={() => updateAutoBackupSettings({ enabled: !autoBackupSettings.enabled })}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${autoBackupSettings.enabled ? 'bg-primary-600' : 'bg-secondary-300 dark:bg-secondary-600'}`}
                                    >
                                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${autoBackupSettings.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                                    </button>
                                </div>

                                <div className={`p-3 bg-secondary-50 dark:bg-secondary-900/50 rounded-lg border dark:border-secondary-700 transition-opacity ${!autoBackupSettings.enabled ? 'opacity-50 pointer-events-none' : ''}`}>
                                    <label className="text-xs font-bold text-secondary-500 uppercase block mb-1">Frequency</label>
                                    <select 
                                        value={autoBackupSettings.frequency}
                                        onChange={(e) => updateAutoBackupSettings({ frequency: e.target.value as any })}
                                        className="bg-transparent border-none text-sm font-semibold focus:ring-0 w-full p-0"
                                    >
                                        <option value="weekly">Every Week</option>
                                        <option value="monthly">Every Month</option>
                                    </select>
                                </div>
                            </div>

                            {autoBackupSettings.enabled && (
                                <div className="mt-4 flex items-center gap-4 text-xs text-secondary-500 bg-secondary-50 dark:bg-secondary-900/50 p-2 rounded border border-dashed dark:border-secondary-700">
                                    <div className="flex-1">
                                        <span className="font-bold uppercase mr-1">Last Run:</span>
                                        {autoBackupSettings.lastBackup ? new Date(autoBackupSettings.lastBackup).toLocaleString() : 'Never'}
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
                    <h2 className="text-xl font-semibold border-b pb-3 dark:border-secondary-700 mb-6">Sidebar Configuration</h2>
                     <div className="space-y-4">
                        <p className="text-sm text-secondary-600 dark:text-secondary-400">Choose how the sidebar behaves on desktop screens.</p>
                        <div className="flex flex-col sm:flex-row gap-4">
                            <div className={`flex-1 p-4 border-2 rounded-lg cursor-pointer transition-all ${sidebarMode === 'fixed' ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'border-secondary-200 dark:border-secondary-700'}`} onClick={() => setSidebarMode('fixed')}>
                                <div className="flex items-center gap-3 mb-2"><h3 className="font-semibold">Always Expanded</h3></div>
                                <p className="text-xs text-secondary-500">The sidebar stays open at full width.</p>
                            </div>
                            <div className={`flex-1 p-4 border-2 rounded-lg cursor-pointer transition-all ${sidebarMode === 'collapsible' ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'border-secondary-200 dark:border-secondary-700'}`} onClick={() => setSidebarMode('collapsible')}>
                                <div className="flex items-center gap-3 mb-2"><h3 className="font-semibold">Collapsible (Hover)</h3></div>
                                <p className="text-xs text-secondary-500">The sidebar shrinks to icons.</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-secondary-800 rounded-lg shadow-md p-6">
                    <h2 className="text-xl font-semibold border-b pb-3 dark:border-secondary-700 mb-6">Data Synchronization</h2>
                     <div className="space-y-4">
                        <div className="flex flex-col sm:flex-row gap-4">
                            <div className={`flex-1 p-4 border-2 rounded-lg cursor-pointer ${syncMode === 'offline' ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'dark:border-secondary-700'}`} onClick={() => handleSyncModeChange('offline')}>
                                <h3 className="font-semibold">Offline-First</h3>
                                <p className="text-sm text-secondary-500">Caches all data locally. Best for performance.</p>
                            </div>
                            <div className={`flex-1 p-4 border-2 rounded-lg cursor-pointer ${syncMode === 'online' ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'dark:border-secondary-700'}`} onClick={() => handleSyncModeChange('online')}>
                                <h3 className="font-semibold">Online-Only</h3>
                                <p className="text-sm text-secondary-500">Always fetches fresh data. Most reliable for multi-user.</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-secondary-800 rounded-lg shadow-md p-6">
                    <h2 className="text-xl font-semibold border-b pb-3 dark:border-secondary-700 mb-6">Appearance</h2>
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <label className="font-medium text-secondary-700 dark:text-secondary-300">Theme</label>
                            <button onClick={toggleTheme} className="btn-secondary">Switch Theme</button>
                        </div>
                         <div className="flex items-center justify-between">
                            <label className="font-medium text-secondary-700 dark:text-secondary-300">Font Size</label>
                            <div className="flex items-center space-x-2">
                                <button onClick={decreaseFontSize} className="btn-secondary px-3">-</button>
                                <button onClick={resetFontSize} className="btn-secondary">Default</button>
                                <button onClick={increaseFontSize} className="btn-secondary px-3">+</button>
                            </div>
                        </div>
                    </div>
                </div>

                 {effectiveRole === UserRole.Admin && (
                    <div className="bg-white dark:bg-secondary-800 rounded-lg shadow-md p-6">
                        <div className="flex justify-between items-center border-b pb-3 dark:border-secondary-700 mb-6">
                            <h2 className="text-xl font-semibold">School Details</h2>
                            <button onClick={() => setIsTuitionFeeModalOpen(true)} className="btn-secondary text-xs">
                                Bulk Tuition Increase
                            </button>
                        </div>
                        <form onSubmit={handleSchoolUpdate} className="space-y-4">
                             <ImageUpload imageUrl={schoolDetails.logoUrl} onChange={(newLogoUrl) => setSchoolDetails(prev => ({...prev, logoUrl: newLogoUrl}))} bucketName="logos" />
                            <div>
                                <label className="input-label">School Name</label>
                                <input type="text" value={schoolDetails.name} onChange={e => setSchoolDetails(p => ({...p, name: e.target.value}))} className="input-field" />
                            </div>
                             <div>
                                <label className="input-label">Address</label>
                                <textarea value={schoolDetails.address} onChange={e => setSchoolDetails(p => ({...p, address: e.target.value}))} className="input-field" rows={2}></textarea>
                            </div>
                            <div className="flex justify-end">
                                <button type="submit" className="btn-primary" disabled={isSchoolSaving}>{isSchoolSaving ? 'Saving...' : 'Save School Details'}</button>
                            </div>
                        </form>
                    </div>
                )}

                {effectiveRole === UserRole.Admin && syncMode === 'offline' && (
                    <div className="bg-white dark:bg-secondary-800 rounded-lg shadow-md p-6">
                        <h2 className="text-xl font-semibold border-b pb-3 dark:border-secondary-700 mb-6">Local Management</h2>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <p className="font-medium">Local Download</p>
                                <button onClick={backupData} className="btn-secondary"><DownloadIcon className="w-4 h-4 mr-2" /> JSON Backup</button>
                            </div>
                             <div className="flex items-center justify-between">
                                <p className="font-medium">Manual Import</p>
                                <input ref={fileInputRef} type="file" accept=".json" onChange={handleRestoreInitiate} className="hidden" />
                                <button onClick={() => fileInputRef.current?.click()} className="btn-secondary"><UploadIcon className="w-4 h-4 mr-2"/> Restore Local File</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
};

export default SettingsPage;
