import React, { useState, useEffect } from 'react';
import { Subject } from '../../types';
import Modal from '../common/Modal';
import { useToast } from '../../context/ToastContext';

interface SubjectFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (subject: Omit<Subject, 'id' | 'schoolId'> | Subject) => Promise<void>;
    subjectToEdit: Subject | null;
}

const SubjectFormModal: React.FC<SubjectFormModalProps> = ({ isOpen, onClose, onSave, subjectToEdit }) => {
    const { showToast } = useToast();
    const getInitialState = () => ({
        name: subjectToEdit?.name || '',
    });

    const [formData, setFormData] = useState(getInitialState());
    const [error, setError] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setFormData(getInitialState());
            setError('');
        }
    }, [isOpen, subjectToEdit]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (!formData.name.trim()) {
            setError('Subject name is required.');
            return;
        }

        setIsSaving(true);
        try {
            if (subjectToEdit) {
                await onSave({ ...subjectToEdit, ...formData });
            } else {
                await onSave(formData);
            }
            onClose();
        } catch (error) {
            console.error("Failed to save subject:", error);
            showToast('Error', 'An error occurred while saving the subject.', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={subjectToEdit ? 'Edit Subject' : 'Add New Subject'}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label htmlFor="name" className="input-label">Subject Name</label>
                    <input
                        type="text"
                        id="name"
                        value={formData.name}
                        onChange={e => setFormData({ name: e.target.value })}
                        className="input-field"
                        placeholder="e.g., Mathematics"
                        required
                    />
                    {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
                </div>
                <div className="flex justify-end space-x-3 pt-4">
                    <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
                    <button type="submit" className="btn-primary" disabled={isSaving}>
                        {isSaving ? 'Saving...' : 'Save Subject'}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default SubjectFormModal;
