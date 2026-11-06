import React, { useState, useMemo } from 'react';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { FeeHead, UserRole } from '../../types';
import Modal from '../common/Modal';
import FeeHeadFormModal from './FeeHeadFormModal';
import { Permission } from '../../permissions';
import { useToast } from '../../context/ToastContext';

const FeeHeadsManagement: React.FC = () => {
    const { user, activeSchoolId, hasPermission } = useAuth();
    const { feeHeads, students, addFeeHead, updateFeeHead, deleteFeeHead } = useData();

    const effectiveSchoolId = user?.role === UserRole.Owner && activeSchoolId ? activeSchoolId : user?.schoolId;
    const canManage = hasPermission(Permission.CAN_MANAGE_FEE_HEADS);

    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [feeHeadToEdit, setFeeHeadToEdit] = useState<FeeHead | null>(null);
    const [feeHeadToDelete, setFeeHeadToDelete] = useState<FeeHead | null>(null);

    const schoolFeeHeads = useMemo(() => {
        if (!effectiveSchoolId) return [];
        return feeHeads.filter(fh => fh.schoolId === effectiveSchoolId);
    }, [feeHeads, effectiveSchoolId]);

    const isReferenced = useMemo(() => {
        if (!feeHeadToDelete) return false;
        return students.some(s => s.schoolId === effectiveSchoolId && s.feeStructure?.some(item => item.feeHeadId === feeHeadToDelete.id));
    }, [students, effectiveSchoolId, feeHeadToDelete]);

    const handleOpenModal = (feeHead: FeeHead | null = null) => {
        setFeeHeadToEdit(feeHead);
        setIsFormModalOpen(true);
    };

    const handleCloseModal = () => {
        setFeeHeadToEdit(null);
        setIsFormModalOpen(false);
    };

    const handleSaveFeeHead = async (data: Omit<FeeHead, 'id' | 'schoolId'> | FeeHead) => {
        if (!effectiveSchoolId) return;

        if ('id' in data) {
            await updateFeeHead(data);
        } else {
            await addFeeHead({ ...data, schoolId: effectiveSchoolId });
        }
    };

    const { showToast } = useToast();

    const handleDelete = async () => {
        if (feeHeadToDelete && !isReferenced) {
            try {
                await deleteFeeHead(feeHeadToDelete.id);
                setFeeHeadToDelete(null);
            } catch (err: any) {
                showToast('Error', `Failed to delete fee head: ${err.message || 'Unknown error'}`, 'error');
            }
        }
    };

    return (
        <>
            <FeeHeadFormModal
                isOpen={isFormModalOpen}
                onClose={handleCloseModal}
                onSave={handleSaveFeeHead}
                feeHeadToEdit={feeHeadToEdit}
            />
            <Modal isOpen={!!feeHeadToDelete} onClose={() => setFeeHeadToDelete(null)} title="Confirm Deletion">
                {isReferenced ? (
                    <div className="space-y-3">
                        <p className="text-red-600 dark:text-red-400 font-medium">Cannot delete this fee head.</p>
                        <p className="text-secondary-600 dark:text-secondary-300">The fee head "{feeHeadToDelete?.name}" is actively referenced in student custom fee structures. You must remove it from student fee profiles before deleting.</p>
                    </div>
                ) : (
                    <p className="text-secondary-700 dark:text-secondary-300">Are you sure you want to delete the fee head "{feeHeadToDelete?.name}"? This action cannot be undone.</p>
                )}
                <div className="flex justify-end space-x-2 pt-4">
                    <button type="button" onClick={() => setFeeHeadToDelete(null)} className="btn-secondary">Cancel</button>
                    {!isReferenced && (
                        <button type="button" onClick={handleDelete} className="btn-danger">Delete</button>
                    )}
                </div>
            </Modal>
            
            <div className="p-4 sm:p-6">
                 <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold text-secondary-900 dark:text-white">Manage Fee Heads</h2>
                    {canManage && (
                        <button onClick={() => handleOpenModal()} className="btn-primary">
                            + Add Fee Head
                        </button>
                    )}
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-secondary-500 dark:text-secondary-400">
                        <thead className="text-xs text-secondary-700 uppercase bg-secondary-50 dark:bg-secondary-700 dark:text-secondary-300">
                            <tr>
                                <th scope="col" className="px-6 py-3">Fee Head Name</th>
                                <th scope="col" className="px-6 py-3">Default Amount</th>
                                <th scope="col" className="px-6 py-3">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {schoolFeeHeads.map(fh => (
                                <tr key={fh.id} className="bg-white dark:bg-secondary-800 border-b dark:border-secondary-700 hover:bg-secondary-50 dark:hover:bg-secondary-700/50">
                                    <td className="px-6 py-4 font-medium text-secondary-900 dark:text-white">{fh.name}</td>
                                    <td className="px-6 py-4">Rs. {fh.defaultAmount.toLocaleString()}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {canManage ? (
                                            <div className="flex items-center space-x-4">
                                                <button onClick={() => handleOpenModal(fh)} className="font-medium text-primary-600 dark:text-primary-500 hover:underline">Edit</button>
                                                <button onClick={() => setFeeHeadToDelete(fh)} className="font-medium text-red-600 dark:text-red-500 hover:underline">Delete</button>
                                            </div>
                                        ) : (
                                            <span className="text-secondary-400 italic">No actions</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    );
};

export default FeeHeadsManagement;