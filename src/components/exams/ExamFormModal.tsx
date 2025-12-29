import React, { useState, useEffect } from 'react';
import { Exam } from '../../types';
import Modal from '../common/Modal';
import { useToast } from '../../context/ToastContext';

interface ExamFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (exam: Omit<Exam, 'id' | 'schoolId'> | Exam) => Promise<void>;
    examToEdit: Exam | null;
}

const ExamFormModal: React.FC<ExamFormModalProps> = ({ isOpen, onClose, onSave, examToEdit }) => {
    const { showToast } = useToast();
    const getInitialState = () => ({
        name: examToEdit?.name || '',
    });

    const [formData, setFormData] = useState(getInitialState());
    const [error, setError] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setFormData(getInitialState());
            setError('');
        }
    }, [isOpen, examToEdit]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (!formData.name.trim()) {
            setError('Exam name is required.');
            return;
        }

        setIsSaving(true);
        try {
            if (examToEdit) {
                await onSave({ ...examToEdit, ...formData });
            } else {
                await onSave(formData);
            }
            onClose();
        } catch (error) {
            console.error("Failed to save exam:", error);
            showToast('Error', 'An error occurred while saving the exam.', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={examToEdit ? 'Edit Exam' : 'Add New Exam'}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label htmlFor="name" className="input-label">Exam Name</label>
                    <input
                        type="text"
                        id="name"
                        value={formData.name}
                        onChange={e => setFormData({ name: e.target.value })}
                        className="input-field"
                        placeholder="e.g., Mid-Term Examination"
                        required
                    />
                    {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
                </div>
                <div className="flex justify-end space-x-3 pt-4">
                    <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
                    <button type="submit" className="btn-primary" disabled={isSaving}>
                        {isSaving ? 'Saving...' : 'Save Exam'}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default ExamFormModal;