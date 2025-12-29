
import React, { useState, useEffect, useMemo } from 'react';
import Modal from '../common/Modal';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../types';
import Avatar from '../common/Avatar';
import { useToast } from '../../context/ToastContext';

interface IncreaseTuitionFeeModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const IncreaseTuitionFeeModal: React.FC<IncreaseTuitionFeeModalProps> = ({ isOpen, onClose }) => {
    const { user, activeSchoolId } = useAuth();
    const { students, increaseTuitionFees } = useData();
    const { showToast } = useToast();

    const [increaseAmount, setIncreaseAmount] = useState<number>(0);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
    const [isSaving, setIsSaving] = useState(false);
    const [isConfirming, setIsConfirming] = useState(false);

    const effectiveSchoolId = user?.role === UserRole.Owner && activeSchoolId ? activeSchoolId : user?.schoolId;

    const schoolStudents = useMemo(() => {
        return students.filter(s => s.schoolId === effectiveSchoolId && s.status === 'Active');
    }, [students, effectiveSchoolId]);

    useEffect(() => {
        if (isOpen) {
            // Pre-select all students when modal opens
            setSelectedStudentIds(new Set(schoolStudents.map(s => s.id)));
            setIncreaseAmount(0);
            setSearchTerm('');
            setIsSaving(false);
            setIsConfirming(false);
        }
    }, [isOpen, schoolStudents]);

    const filteredStudents = useMemo(() => {
        if (!searchTerm) return schoolStudents;
        const lowerSearchTerm = searchTerm.toLowerCase();
        return schoolStudents.filter(s =>
            s.name.toLowerCase().includes(lowerSearchTerm) ||
            s.rollNumber.toLowerCase().includes(lowerSearchTerm)
        );
    }, [schoolStudents, searchTerm]);

    const handleSelectAll = () => {
        setSelectedStudentIds(new Set(schoolStudents.map(s => s.id)));
    };

    const handleDeselectAll = () => {
        setSelectedStudentIds(new Set());
    };

    const handleToggleStudent = (studentId: string) => {
        setSelectedStudentIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(studentId)) {
                newSet.delete(studentId);
            } else {
                newSet.add(studentId);
            }
            return newSet;
        });
    };

    const handleApplyIncrease = () => {
        if (increaseAmount <= 0) {
            showToast('Invalid Amount', 'Please enter a positive amount to increase.', 'error');
            return;
        }
        if (selectedStudentIds.size === 0) {
            showToast('No Students', 'Please select at least one student.', 'error');
            return;
        }
        setIsConfirming(true);
    };

    const handleConfirmAndApply = async () => {
        setIsSaving(true);
        setIsConfirming(false);
        try {
            await increaseTuitionFees(Array.from(selectedStudentIds), increaseAmount);
            onClose();
        } catch (error) {
            // Toast is handled in context
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <>
            <Modal isOpen={isOpen} onClose={onClose} title="Increase Tuition Fees">
                <div className="space-y-4">
                    <div>
                        <label htmlFor="increaseAmount" className="input-label">Amount to Increase</label>
                        <input
                            type="number"
                            id="increaseAmount"
                            value={increaseAmount}
                            onChange={e => setIncreaseAmount(Number(e.target.value))}
                            className="input-field"
                            placeholder="e.g., 500"
                        />
                    </div>

                    <div className="border-t dark:border-secondary-700 pt-4">
                        <h3 className="input-label font-semibold">Select Students to Apply Increase To</h3>
                        <p className="text-xs text-secondary-500 mb-2">By default, all active students are selected. Uncheck students to exempt them.</p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-2">
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="input-field"
                                placeholder="Search student by name or roll number..."
                            />
                            <div className="flex items-center gap-2">
                                <button onClick={handleSelectAll} className="btn-secondary text-xs w-full">Select All</button>
                                <button onClick={handleDeselectAll} className="btn-secondary text-xs w-full">Deselect All</button>
                            </div>
                        </div>

                        <div className="max-h-60 overflow-y-auto border dark:border-secondary-600 rounded-md p-2 space-y-1">
                            {filteredStudents.map(student => (
                                <label key={student.id} className="flex items-center space-x-3 p-2 rounded-md hover:bg-secondary-50 dark:hover:bg-secondary-700/50 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={selectedStudentIds.has(student.id)}
                                        onChange={() => handleToggleStudent(student.id)}
                                        className="h-4 w-4 rounded border-secondary-300 text-primary-600 focus:ring-primary-500"
                                    />
                                    <Avatar student={student} className="w-8 h-8" />
                                    <div>
                                        <p className="text-sm font-medium">{student.name}</p>
                                        <p className="text-xs font-bold text-primary-600 dark:text-primary-400">ID: {student.rollNumber}</p>
                                    </div>
                                </label>
                            ))}
                        </div>
                        <p className="text-sm text-secondary-600 dark:text-secondary-400 mt-2">
                            {selectedStudentIds.size} of {schoolStudents.length} students selected.
                        </p>
                    </div>
                    
                    <div className="flex justify-end space-x-3 pt-4">
                        <button type="button" onClick={onClose} className="btn-secondary" disabled={isSaving}>Cancel</button>
                        <button type="button" onClick={handleApplyIncrease} className="btn-primary" disabled={isSaving}>
                            {isSaving ? 'Applying...' : `Apply Increase of Rs. ${increaseAmount}`}
                        </button>
                    </div>
                </div>
            </Modal>
            <Modal isOpen={isConfirming} onClose={() => setIsConfirming(false)} title="Confirm Fee Increase">
                <p>
                    Are you sure you want to increase the tuition fee by <strong>Rs. {increaseAmount.toLocaleString()}</strong> for <strong>{selectedStudentIds.size}</strong> selected students?
                    This action cannot be undone.
                </p>
                <div className="mt-6 flex justify-end space-x-3">
                    <button type="button" onClick={() => setIsConfirming(false)} className="btn-secondary">Cancel</button>
                    <button type="button" onClick={handleConfirmAndApply} className="btn-danger">Confirm & Apply</button>
                </div>
            </Modal>
        </>
    );
};

export default IncreaseTuitionFeeModal;
