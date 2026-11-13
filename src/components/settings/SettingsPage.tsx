
import React, { useState, useEffect } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { DownloadIcon } from '../../constants';
import Modal from '../common/Modal';
import { UserRole, Branch } from '../../types';
import { useToast } from '../../context/ToastContext';
import ImageUpload from '../common/ImageUpload';
import IncreaseTuitionFeeModal from './IncreaseTuitionFeeModal';
import RestoreModal from './RestoreModal';
import { UploadCloud } from 'lucide-react';
import { GitHubBackupCard } from './GitHubBackupCard';
import { StorageUsageCard } from './StorageUsageCard';
import { Permission } from '../../permissions';

const SettingsPage: React.FC = () => {
    const { toggleTheme, increaseFontSize, decreaseFontSize, resetFontSize, sidebarMode, setSidebarMode } = useTheme();
    const { user, effectiveRole, activeSchoolId, hasPermission } = useAuth();
    const { schools, classes, branches, addBranch, updateBranch, deleteBranch, downloadFullBackup, updateSchool, feeHeads, addFeeHead, updateFeeHead } = useData();
    const { showToast } = useToast();

    // State for School Details
    const [isSchoolSaving, setIsSchoolSaving] = useState(false);
    const effectiveSchoolId = user?.role === UserRole.Owner && activeSchoolId ? activeSchoolId : user?.schoolId;
    const school = schools.find(s => s.id === effectiveSchoolId);
    
    const [schoolDetails, setSchoolDetails] = useState({ name: '', address: '', logoUrl: null as string | null | undefined });
    const [defaultTuitionFee, setDefaultTuitionFee] = useState(0);

    // State for Branches
    const [isBranchModalOpen, setIsBranchModalOpen] = useState(false);
    const [branchToEdit, setBranchToEdit] = useState<Branch | null>(null);
    const [branchForm, setBranchForm] = useState({ name: '', address: '' });
    const [isBranchSaving, setIsBranchSaving] = useState(false);

    // Backup State
    const [lastBackupDownloaded, setLastBackupDownloaded] = useState<string | null>(() => {
        return localStorage.getItem('edusync_last_backup_download');
    });
    const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);

    // State for Tuition Fee Manager
    const [isTuitionFeeModalOpen, setIsTuitionFeeModalOpen] = useState(false);

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

    const handleOpenBranchModal = (branch: Branch | null = null) => {
        setBranchToEdit(branch);
        setBranchForm({
            name: branch?.name || '',
            address: branch?.address || ''
        });
        setIsBranchModalOpen(true);
    };

    const handleSaveBranch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!branchForm.name.trim() || !effectiveSchoolId) return;
        setIsBranchSaving(true);
        try {
            if (branchToEdit) {
                await updateBranch({
                    ...branchToEdit,
                    name: branchForm.name.trim(),
                    address: branchForm.address.trim() || null
                });
                showToast('Success', 'Branch updated successfully!', 'success');
            } else {
                await addBranch({
                    name: branchForm.name.trim(),
                    address: branchForm.address.trim() || null,
                    schoolId: effectiveSchoolId
                });
                showToast('Success', 'Branch created successfully!', 'success');
            }
            setIsBranchModalOpen(false);
        } catch (err: any) {
            showToast('Error', err.message || 'Failed to save branch.', 'error');
        } finally {
            setIsBranchSaving(false);
        }
    };

    const handleDeleteBranch = async (branch: Branch) => {
        const assignedClasses = classes.filter(c => c.branchId === branch.id);
        if (assignedClasses.length > 0) {
            showToast('Cannot Delete Branch', `Cannot delete branch: ${assignedClasses.length} class(es) are currently assigned to this branch. Reassign or delete these classes first.`, 'error');
            return;
        }

        if (!window.confirm(`Are you sure you want to delete branch "${branch.name}"?`)) return;

        try {
            await deleteBranch(branch.id);
            showToast('Success', `Branch "${branch.name}" removed successfully.`, 'success');
        } catch (err: any) {
            showToast('Error', err.message || 'Failed to delete branch.', 'error');
        }
    };

    const handleDownloadBackup = async () => {
        await downloadFullBackup();
        setLastBackupDownloaded(localStorage.getItem('edusync_last_backup_download'));
    };

    return (
        <>

            <Modal isOpen={isBranchModalOpen} onClose={() => setIsBranchModalOpen(false)} title={branchToEdit ? 'Edit Campus Branch' : 'Add Campus Branch'}>
                <form onSubmit={handleSaveBranch} className="space-y-4">
                    <div>
                        <label className="input-label">Branch Name *</label>
                        <input
                            type="text"
                            required
                            value={branchForm.name}
                            onChange={e => setBranchForm(p => ({ ...p, name: e.target.value }))}
                            placeholder="e.g. North Campus, City Branch"
                            className="input-field"
                        />
                    </div>
                    <div>
                        <label className="input-label">Mailing Address (optional)</label>
                        <textarea
                            value={branchForm.address}
                            onChange={e => setBranchForm(p => ({ ...p, address: e.target.value }))}
                            placeholder="Campus address, street, phone"
                            rows={2}
                            className="input-field"
                        />
                    </div>
                    <div className="flex justify-end gap-3 pt-3">
                        <button type="button" onClick={() => setIsBranchModalOpen(false)} className="btn-secondary">
                            Cancel
                        </button>
                        <button type="submit" disabled={isBranchSaving} className="btn-primary">
                            {isBranchSaving ? 'Saving...' : (branchToEdit ? 'Save Changes' : 'Create Branch')}
                        </button>
                    </div>
                </form>
            </Modal>

            <IncreaseTuitionFeeModal isOpen={isTuitionFeeModalOpen} onClose={() => setIsTuitionFeeModalOpen(false)} />
            <RestoreModal 
                isOpen={isRestoreModalOpen} 
                onClose={() => setIsRestoreModalOpen(false)} 
                onRestoreSuccess={() => {
                    showToast('Success', 'Database restored and verified. Refreshing application...', 'success');
                }} 
            />

            <div className="max-w-4xl mx-auto space-y-8">
                <h1 className="text-3xl font-bold text-secondary-900 dark:text-white">Settings</h1>

                {/* FULL DATABASE BACKUP & RESTORE SECTION */}
                {(user?.role === UserRole.Owner || hasPermission(Permission.CAN_MANAGE_BACKUPS)) && (
                    <div className="bg-white dark:bg-secondary-800 rounded-lg shadow-md p-6">
                        <div className="flex items-start gap-4 mb-6">
                            <div className="p-3 bg-primary-100 dark:bg-primary-900/30 rounded-full">
                                <DownloadIcon className="w-8 h-8 text-primary-600 dark:text-primary-400" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-secondary-900 dark:text-white leading-tight">Database Backup & Recovery</h2>
                                <p className="text-sm text-secondary-500 mt-1 max-w-lg">
                                    Export a complete, untruncated snapshot of all institutional tables and historical records into a standard JSON backup archive, or safely restore from an existing backup file.
                                </p>
                            </div>
                        </div>

                        <div className="bg-secondary-50 dark:bg-secondary-900/40 rounded-xl p-5 mb-6 border dark:border-secondary-700">
                            <h3 className="text-xs font-bold text-secondary-400 uppercase tracking-widest mb-3">Backup Status</h3>
                            <div className="space-y-2">
                                <div className="flex items-baseline gap-2">
                                    <span className="text-sm font-medium text-secondary-600 dark:text-secondary-400">Last Downloaded:</span>
                                    <span className="text-sm font-bold text-secondary-900 dark:text-white">
                                        {lastBackupDownloaded ? new Date(lastBackupDownloaded).toLocaleString() : 'Never downloaded from this browser'}
                                    </span>
                                </div>
                            </div>

                            <div className="mt-6 flex flex-wrap gap-4">
                                <button 
                                    onClick={handleDownloadBackup} 
                                    className="px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-lg shadow-lg shadow-primary-500/20 transition-all active:scale-95 flex items-center justify-center gap-2"
                                >
                                    <DownloadIcon className="w-5 h-5" />
                                    Download Full Backup
                                </button>
                                <button 
                                    onClick={() => setIsRestoreModalOpen(true)} 
                                    className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-lg shadow-emerald-600/20 transition-all active:scale-95 flex items-center justify-center gap-2"
                                >
                                    <UploadCloud className="w-5 h-5" />
                                    Restore From Backup
                                </button>
                            </div>
                        </div>

                        <div className="p-4 border-2 border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/20 rounded-lg">
                            <p className="text-sm font-bold text-emerald-800 dark:text-emerald-300">Browser &amp; CLI Disaster Recovery Options</p>
                            <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-1">
                                Click <strong>Restore From Backup</strong> to audit, stage, and restore records directly in your browser with password authorization and checksum validation. Alternatively, CLI restore is available: <code className="px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/50 font-mono text-emerald-900 dark:text-emerald-200">npm run restore -- &lt;file&gt;</code>
                            </p>
                        </div>
                    </div>
                )}

                {user?.role === UserRole.Owner && !user?.branchId && (
                    <StorageUsageCard />
                )}

                {user?.role === UserRole.Owner && (
                    <GitHubBackupCard />
                )}

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

                {(effectiveRole === UserRole.Admin || effectiveRole === UserRole.Owner) && (
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

                {/* CAMPUS BRANCHES SECTION */}
                {(effectiveRole === UserRole.Admin || effectiveRole === UserRole.Owner) && (
                    <div className="bg-white dark:bg-secondary-800 rounded-lg shadow-md p-6">
                        <div className="flex justify-between items-center border-b pb-3 dark:border-secondary-700 mb-6">
                            <div>
                                <h2 className="text-xl font-semibold text-secondary-900 dark:text-white">Campus Branches</h2>
                                <p className="text-xs text-secondary-500 mt-0.5">Manage separate campuses and branch locations for your institution.</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => handleOpenBranchModal()}
                                className="btn-primary text-xs font-bold py-1.5 px-3"
                            >
                                + Add Branch
                            </button>
                        </div>

                        {branches.length === 0 ? (
                            <div className="text-center py-8 px-4 border-2 border-dashed border-secondary-200 dark:border-secondary-700 rounded-lg">
                                <p className="text-sm font-medium text-secondary-600 dark:text-secondary-300">No branches configured yet.</p>
                                <p className="text-xs text-secondary-400 mt-1">If your school operates multiple campus sites, add them here to group classes and filter students.</p>
                                <button
                                    type="button"
                                    onClick={() => handleOpenBranchModal()}
                                    className="btn-secondary text-xs mt-3 shadow-none"
                                >
                                    Create First Branch
                                </button>
                            </div>
                        ) : (
                            <div className="divide-y divide-secondary-100 dark:divide-secondary-700">
                                {branches.map(branch => {
                                    const assignedClassesCount = classes.filter(c => c.branchId === branch.id).length;
                                    return (
                                        <div key={branch.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h4 className="font-semibold text-sm text-secondary-900 dark:text-white">{branch.name}</h4>
                                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">
                                                        {assignedClassesCount} {assignedClassesCount === 1 ? 'class' : 'classes'}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-secondary-500 mt-0.5">{branch.address || 'No address specified'}</p>
                                            </div>
                                            <div className="flex items-center gap-2 self-end sm:self-center">
                                                <button
                                                    type="button"
                                                    onClick={() => handleOpenBranchModal(branch)}
                                                    className="text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline px-2 py-1"
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleDeleteBranch(branch)}
                                                    className="text-xs font-semibold text-red-600 dark:text-red-400 hover:underline px-2 py-1"
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

            </div>
        </>
    );
};

export default SettingsPage;
