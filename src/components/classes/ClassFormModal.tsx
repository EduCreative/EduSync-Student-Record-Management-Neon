import React, { useState, useEffect, useMemo } from 'react';
import { Class, UserRole } from '../../types';
import Modal from '../common/Modal';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

interface ClassFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (classData: Class | Omit<Class, 'id'>) => Promise<void>;
    classToEdit?: Class | null;
}

const ClassFormModal: React.FC<ClassFormModalProps> = ({ isOpen, onClose, onSave, classToEdit }) => {
    const { user: currentUser, activeSchoolId } = useAuth();
    const { users } = useData();
    const { showToast } = useToast();

    const [formData, setFormData] = useState({ name: '', section: '', teacherId: '' });
    const [error, setError] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const effectiveSchoolId = currentUser?.role === UserRole.Owner && activeSchoolId ? activeSchoolId : currentUser?.schoolId;

    const schoolTeachers = useMemo(() => {
        return users.filter(u => u.schoolId === effectiveSchoolId && u.role === UserRole.Teacher);
    }, [users, effectiveSchoolId]);

    useEffect(() => {
        if (isOpen) {
            if (classToEdit) {
                setFormData({ name: classToEdit.name, section: classToEdit.section || '', teacherId: classToEdit.teacherId || '' });
            } else {
                setFormData({ name: '', section: '', teacherId: '' });
            }
            setError('');
        }
    }, [classToEdit, isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (!formData.name.trim()) {
            setError('Class name is required.');
            return;
        }

        if (!effectiveSchoolId) {
            const msg = 'No active school context. Cannot save class.';
            setError(msg);
            showToast('Error', 'No active school selected. Please select a school first.', 'error');
            return;
        }
        
        setIsSaving(true);
        try {
            const saveData = {
                ...formData,
                section: formData.section.trim() || null,
                teacherId: formData.teacherId || null,
                schoolId: effectiveSchoolId,
            };

            if (classToEdit) {
                await onSave({ ...classToEdit, ...saveData });
            } else {
                await onSave(saveData);
            }
            onClose();
        } catch (error) {
            console.error("Failed to save class:", error);
            showToast('Error', 'An error occurred while saving the class.', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={classToEdit ? 'Edit Class' : 'Add New Class'}>
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="name" className="input-label">Class/Grade Name</label>
                        <input type="text" name="name" id="name" value={formData.name} onChange={e => setFormData(p => ({...p, name: e.target.value}))} className="input-field" placeholder="e.g., Class 1, Grade 5"/>
                        {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
                    </div>
                     <div>
                        <label htmlFor="section" className="input-label">Section (optional)</label>
                        <input type="text" name="section" id="section" value={formData.section} onChange={e => setFormData(p => ({...p, section: e.target.value}))} className="input-field" placeholder="e.g., A, Blue, Morning" />
                    </div>
                </div>
                <div>
                    <label htmlFor="teacherId" className="input-label">Assign Teacher</label>
                    <select name="teacherId" id="teacherId" value={formData.teacherId} onChange={e => setFormData(p => ({...p, teacherId: e.target.value}))} className="input-field">
                        <option value="">Select a teacher (optional)</option>
                        {schoolTeachers.map(teacher => (
                            <option key={teacher.id} value={teacher.id}>{teacher.name}</option>
                        ))}
                    </select>
                </div>
                <div className="flex justify-end space-x-3 pt-4">
                    <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
                    <button type="submit" className="btn-primary" disabled={isSaving}>
                        {isSaving ? 'Saving...' : 'Save Class'}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default ClassFormModal;