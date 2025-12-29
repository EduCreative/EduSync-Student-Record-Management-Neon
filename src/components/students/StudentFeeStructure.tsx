import React, { useState, useMemo, useEffect } from 'react';
import { Student, FeeHead } from '../../types';
import { useData } from '../../context/DataContext';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { Permission } from '../../permissions';

interface StudentFeeStructureProps {
    student: Student;
}

const StudentFeeStructure: React.FC<StudentFeeStructureProps> = ({ student }) => {
    const { feeHeads, updateStudent } = useData();
    const { hasPermission } = useAuth();
    const { showToast } = useToast();
    
    const [structure, setStructure] = useState(student.feeStructure || []);
    const [newFeeHeadId, setNewFeeHeadId] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    
    useEffect(() => {
        setStructure(student.feeStructure || []);
    }, [student.feeStructure]);

    // FIX: Corrected permission check from CAN_MANAGE_STUDENTS to CAN_EDIT_STUDENTS.
    const canManage = hasPermission(Permission.CAN_EDIT_STUDENTS);

    const assignedFeeHeadIds = useMemo(() => new Set(structure.map(item => item.feeHeadId)), [structure]);

    const unassignedFeeHeads = useMemo(() => {
        return feeHeads.filter((fh: FeeHead) => !assignedFeeHeadIds.has(fh.id));
    }, [feeHeads, assignedFeeHeadIds]);
    
    const handleAddFeeHead = () => {
        if (!newFeeHeadId) return;
        const feeHeadToAdd = feeHeads.find(fh => fh.id === newFeeHeadId);
        if (feeHeadToAdd) {
            setStructure([...structure, { feeHeadId: feeHeadToAdd.id, amount: feeHeadToAdd.defaultAmount }]);
            setNewFeeHeadId('');
        }
    };

    const handleRemoveFeeHead = (feeHeadId: string) => {
        setStructure(structure.filter(item => item.feeHeadId !== feeHeadId));
    };

    const handleAmountChange = (feeHeadId: string, amount: number) => {
        setStructure(structure.map(item => item.feeHeadId === feeHeadId ? { ...item, amount } : item));
    };
    
    const handleSave = async () => {
        setIsSaving(true);
        try {
            await updateStudent({ ...student, feeStructure: structure });
            showToast('Success', "Student's fee structure updated successfully.", 'success');
        } catch (error) {
            showToast('Error', "Failed to update fee structure.", 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const feeHeadMap = useMemo(() => new Map(feeHeads.map(fh => [fh.id, fh.name])), [feeHeads]);

    return (
        <div>
            <h3 className="text-lg font-medium text-secondary-900 dark:text-white mb-4">Custom Fee Structure</h3>
            <div className="space-y-4">
                {structure.map(item => (
                    <div key={item.feeHeadId} className="flex items-center space-x-4 p-2 rounded-md hover:bg-secondary-50 dark:hover:bg-secondary-700/50">
                        <div className="flex-1">
                            <label className="text-sm font-medium">{feeHeadMap.get(item.feeHeadId) || 'Unknown Fee Head'}</label>
                        </div>
                        <input
                            type="number"
                            value={item.amount}
                            onChange={e => handleAmountChange(item.feeHeadId, Number(e.target.value))}
                            className="input-field w-32 text-right"
                            disabled={!canManage}
                        />
                        {canManage && (
                            <button onClick={() => handleRemoveFeeHead(item.feeHeadId)} className="text-red-500 hover:text-red-700 text-sm">
                                Remove
                            </button>
                        )}
                    </div>
                ))}
                {structure.length === 0 && <p className="text-sm text-secondary-500 text-center py-4">No custom fee structure assigned. Default class fees will apply.</p>}
            </div>
            
            {canManage && (
                <>
                    <div className="mt-6 pt-4 border-t dark:border-secondary-700 flex items-end space-x-2">
                        <div className="flex-1">
                            <label htmlFor="new-fee-head" className="input-label">Add Fee Head</label>
                            <select id="new-fee-head" value={newFeeHeadId} onChange={e => setNewFeeHeadId(e.target.value)} className="input-field">
                                <option value="">Select a fee head to add</option>
                                {unassignedFeeHeads.map(fh => (
                                    <option key={fh.id} value={fh.id}>{fh.name}</option>
                                ))}
                            </select>
                        </div>
                        <button onClick={handleAddFeeHead} className="btn-secondary" disabled={!newFeeHeadId}>Add</button>
                    </div>

                    <div className="mt-6 flex justify-end">
                        <button onClick={handleSave} disabled={isSaving} className="btn-primary">
                            {isSaving ? 'Saving...' : 'Save Fee Structure'}
                        </button>
                    </div>
                </>
            )}
        </div>
    );
};

export default StudentFeeStructure;