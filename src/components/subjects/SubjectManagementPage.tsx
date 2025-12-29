import React, { useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { Subject, UserRole } from '../../types';
import Modal from '../common/Modal';
import SubjectFormModal from './SubjectFormModal';
import TableSkeleton from '../common/skeletons/TableSkeleton';
import { Permission } from '../../permissions';

const SubjectManagementPage: React.FC = () => {
    const { user: currentUser, activeSchoolId, hasPermission } = useAuth();
    const { subjects, addSubject, updateSubject, deleteSubject, loading } = useData();

    const effectiveSchoolId = currentUser?.role === UserRole.Owner && activeSchoolId ? activeSchoolId : currentUser?.schoolId;
    const canManage = hasPermission(Permission.CAN_EDIT_CLASSES); // Reuse class permission for now

    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [subjectToEdit, setSubjectToEdit] = useState<Subject | null>(null);
    const [subjectToDelete, setSubjectToDelete] = useState<Subject | null>(null);

    const schoolSubjects = useMemo(() => {
        return subjects.filter(s => s.schoolId === effectiveSchoolId).sort((a,b) => a.name.localeCompare(b.name));
    }, [subjects, effectiveSchoolId]);

    const handleOpenModal = (subject: Subject | null = null) => {
        setSubjectToEdit(subject);
        setIsFormModalOpen(true);
    };

    const handleCloseModal = () => {
        setSubjectToEdit(null);
        setIsFormModalOpen(false);
    };

    const handleSaveSubject = async (data: Omit<Subject, 'id' | 'schoolId'> | Subject) => {
        if (!effectiveSchoolId) return;

        if ('id' in data) {
            await updateSubject(data);
        } else {
            await addSubject({ ...data, schoolId: effectiveSchoolId });
        }
    };

    const handleDelete = () => {
        if (subjectToDelete) {
            deleteSubject(subjectToDelete.id);
            setSubjectToDelete(null);
        }
    };

    return (
        <>
            <SubjectFormModal
                isOpen={isFormModalOpen}
                onClose={handleCloseModal}
                onSave={handleSaveSubject}
                subjectToEdit={subjectToEdit}
            />
            <Modal isOpen={!!subjectToDelete} onClose={() => setSubjectToDelete(null)} title="Confirm Deletion">
                <p>Are you sure you want to delete the subject "{subjectToDelete?.name}"? This action cannot be undone.</p>
                <div className="flex justify-end space-x-2 pt-4">
                    <button type="button" onClick={() => setSubjectToDelete(null)} className="btn-secondary">Cancel</button>
                    <button type="button" onClick={handleDelete} className="btn-danger">Delete</button>
                </div>
            </Modal>
            
            <div className="space-y-6">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                    <h1 className="text-3xl font-bold text-secondary-900 dark:text-white">Subject Management</h1>
                    {canManage && (
                        <button onClick={() => handleOpenModal()} className="btn-primary">
                            + Add Subject
                        </button>
                    )}
                </div>

                 <div className="bg-white dark:bg-secondary-800 rounded-lg shadow-md">
                    {loading ? (
                        <TableSkeleton columns={[{ width: '80%' }, { width: '20%' }]} />
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left text-secondary-500 dark:text-secondary-400">
                                <thead className="text-xs text-secondary-700 uppercase bg-secondary-50 dark:bg-secondary-700 dark:text-secondary-300">
                                    <tr>
                                        <th scope="col" className="px-6 py-3">Subject Name</th>
                                        <th scope="col" className="px-6 py-3">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {schoolSubjects.map(subject => (
                                        <tr key={subject.id} className="bg-white dark:bg-secondary-800 border-b dark:border-secondary-700 hover:bg-secondary-50 dark:hover:bg-secondary-700/50">
                                            <td className="px-6 py-4 font-medium text-secondary-900 dark:text-white">{subject.name}</td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {canManage ? (
                                                    <div className="flex items-center space-x-4">
                                                        <button onClick={() => handleOpenModal(subject)} className="font-medium text-primary-600 dark:text-primary-500 hover:underline">Edit</button>
                                                        <button onClick={() => setSubjectToDelete(subject)} className="font-medium text-red-600 dark:text-red-500 hover:underline">Delete</button>
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
                    )}
                </div>
            </div>
        </>
    );
};

export default SubjectManagementPage;
