import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { User, UserRole } from '../../types';
import Badge from '../common/Badge';
import UserFormModal from '../users/UserFormModal';
import Modal from '../common/Modal';
import Avatar from '../common/Avatar';
import TableSkeleton from '../common/skeletons/TableSkeleton';
import { DownloadIcon, UploadIcon } from '../../constants';
import { exportToCsv } from '../../utils/csvHelper';
import ImportModal from '../common/ImportModal';

const TeacherManagementPage: React.FC = () => {
    const { user: currentUser, activeSchoolId } = useAuth();
    const { users, classes, bulkAddUsers, updateUser, deleteUser, loading } = useData();
    
    const effectiveSchoolId = currentUser?.role === UserRole.Owner && activeSchoolId ? activeSchoolId : currentUser?.schoolId;

    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'Active' | 'Inactive'>('all');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [userToEdit, setUserToEdit] = useState<User | null>(null);
    const [userToDelete, setUserToDelete] = useState<User | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const USERS_PER_PAGE = 10;

    const schoolTeachers = useMemo(() => {
        return users.filter(user =>
            user.schoolId === effectiveSchoolId && user.role === UserRole.Teacher
        );
    }, [users, effectiveSchoolId]);

    const filteredTeachers = useMemo(() => {
        return schoolTeachers.filter(teacher => {
            if (statusFilter !== 'all' && teacher.status !== statusFilter) return false;
            if (searchTerm && !teacher.name.toLowerCase().includes(searchTerm.toLowerCase()) && !teacher.email.toLowerCase().includes(searchTerm.toLowerCase())) return false;
            return true;
        });
    }, [schoolTeachers, searchTerm, statusFilter]);
    
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, statusFilter]);

    const totalPages = Math.ceil(filteredTeachers.length / USERS_PER_PAGE);
    const paginatedTeachers = useMemo(() => {
        const startIndex = (currentPage - 1) * USERS_PER_PAGE;
        return filteredTeachers.slice(startIndex, startIndex + USERS_PER_PAGE);
    }, [filteredTeachers, currentPage]);

    const classAssignments = useMemo(() => {
        const assignments = new Map<string, string[]>();
        classes.forEach(c => {
            if (c.teacherId) {
                const teacherClasses = assignments.get(c.teacherId) || [];
                teacherClasses.push(c.name);
                assignments.set(c.teacherId, teacherClasses);
            }
        });
        return assignments;
    }, [classes]);

    const handleOpenModal = (user: User | null = null) => {
        setUserToEdit(user);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setUserToEdit(null);
        setIsModalOpen(false);
    };

    const handleSaveUser = async (userData: User | (Omit<User, 'id'> & { password?: string })) => {
        if ('id' in userData) {
            await updateUser(userData as User);
        } else {
            const { password, ...profileData } = userData;
            await bulkAddUsers([{...profileData, password} as (Omit<User, 'id'> & { password?: string })]);
        }
    };

    const validateTeacherImport = async (data: any[]) => {
        const validRecords: any[] = [];
        const invalidRecords: { record: any, reason: string, rowNum: number }[] = [];
        const required = ['name', 'email', 'password'];

        data.forEach((item, index) => {
            const rowNum = index + 2;
            const missing = required.filter(h => !item[h]);
            if(missing.length > 0) {
                invalidRecords.push({ record: item, reason: `Missing required fields: ${missing.join(', ')}`, rowNum });
            } else {
                validRecords.push(item);
            }
        });
        return { validRecords, invalidRecords };
    };
    
    const handleImportTeachers = async (validData: any[], progressCallback: (progress: { processed: number; total: number; errors: string[] }) => void) => {
        if (!effectiveSchoolId) {
            throw new Error("No active school selected for import.");
        }
        
        const CHUNK_SIZE = 50;
        let processed = 0;

        for (let i = 0; i < validData.length; i += CHUNK_SIZE) {
            const chunk = validData.slice(i, i + CHUNK_SIZE);
            const teachersToImport = chunk.map(item => ({
                ...item,
                role: UserRole.Teacher,
                status: 'Active',
                schoolId: effectiveSchoolId,
            }));

            if (teachersToImport.length > 0) {
                await bulkAddUsers(teachersToImport);
            }
            
            processed += chunk.length;
            progressCallback({ processed, total: validData.length, errors: [] });
        }
    };

    const sampleDataForImport = [{
        name: "Jane Doe",
        email: "teacher.jane@example.com",
        password: "securePassword123"
    }];

    const requiredHeaders = ['name', 'email', 'password'];

    const handleDeleteUser = () => {
        if (userToDelete) {
            deleteUser(userToDelete.id);
            setUserToDelete(null);
        }
    };

    const handleExport = () => {
        const dataToExport = filteredTeachers.map(t => ({
            name: t.name,
            email: t.email,
            status: t.status,
            assignedClasses: classAssignments.get(t.id)?.join('; ') || 'N/A',
        }));
        exportToCsv(dataToExport, 'teachers_export');
    };

    const showingFrom = filteredTeachers.length > 0 ? (currentPage - 1) * USERS_PER_PAGE + 1 : 0;
    const showingTo = Math.min(currentPage * USERS_PER_PAGE, filteredTeachers.length);

    return (
        <>
            <UserFormModal 
                isOpen={isModalOpen} 
                onClose={handleCloseModal} 
                onSave={handleSaveUser} 
                userToEdit={userToEdit}
                defaultRole={UserRole.Teacher}
                lockRole={true}
            />
             <ImportModal
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                onValidate={validateTeacherImport}
                onImport={handleImportTeachers}
                sampleData={sampleDataForImport}
                fileName="Teachers"
                requiredHeaders={requiredHeaders}
            />
            <Modal isOpen={!!userToDelete} onClose={() => setUserToDelete(null)} title="Confirm Teacher Deletion">
                <div>
                    <p className="text-sm text-secondary-600 dark:text-secondary-400">
                        Are you sure you want to permanently delete the teacher{' '}
                        <strong className="text-secondary-800 dark:text-secondary-200">{userToDelete?.name}</strong>?
                    </p>
                    <div className="mt-6 flex justify-end space-x-3">
                        <button type="button" onClick={() => setUserToDelete(null)} className="btn-secondary">Cancel</button>
                        <button type="button" onClick={handleDeleteUser} className="btn-danger">Delete</button>
                    </div>
                </div>
            </Modal>

            <div className="space-y-6">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                    <h1 className="text-3xl font-bold text-secondary-900 dark:text-white">Teacher Management</h1>
                    <div className="flex items-center gap-2">
                        <button onClick={() => setIsImportModalOpen(true)} className="btn-secondary">
                            <UploadIcon className="w-4 h-4" /> Import CSV
                        </button>
                        <button onClick={handleExport} className="btn-secondary">
                            <DownloadIcon className="w-4 h-4" /> Export CSV
                        </button>
                        <button onClick={() => handleOpenModal()} className="btn-primary">
                            + Add Teacher
                        </button>
                    </div>
                </div>

                <div className="p-4 bg-white dark:bg-secondary-800 rounded-lg shadow-md">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="search-teacher" className="input-label">Search Teachers</label>
                            <input
                                id="search-teacher"
                                type="text"
                                placeholder="By name or email..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="input-field"
                            />
                        </div>
                        <div>
                            <label htmlFor="status-filter" className="input-label">Status</label>
                            <select id="status-filter" value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)} className="input-field">
                                <option value="all">All Statuses</option>
                                <option value="Active">Active</option>
                                <option value="Inactive">Inactive</option>
                            </select>
                        </div>
                    </div>
                </div>
                
                <div className="bg-white dark:bg-secondary-800 rounded-lg shadow-md">
                    {loading ? (
                        <TableSkeleton columns={[{width: '35%'}, {width: '35%'}, {width: '15%'}, {width: '15%'}]} rows={USERS_PER_PAGE} />
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="text-xs text-secondary-700 uppercase bg-secondary-50 dark:bg-secondary-700 dark:text-secondary-300">
                                        <tr>
                                            <th className="px-6 py-3">Teacher</th>
                                            <th className="px-6 py-3">Assigned Classes</th>
                                            <th className="px-6 py-3">Status</th>
                                            <th className="px-6 py-3">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {paginatedTeachers.map(teacher => (
                                            <tr key={teacher.id} className="border-b dark:border-secondary-700">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center space-x-3">
                                                        <Avatar user={teacher} className="h-10 w-10" />
                                                        <div>
                                                            <div className="font-semibold text-secondary-900 dark:text-white">{teacher.name}</div>
                                                            <div className="text-xs text-secondary-500">{teacher.email}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">{classAssignments.get(teacher.id)?.join(', ') || 'N/A'}</td>
                                                <td className="px-6 py-4"><Badge color={teacher.status === 'Active' ? 'green' : 'red'}>{teacher.status}</Badge></td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center space-x-4">
                                                        <button onClick={() => handleOpenModal(teacher)} className="font-medium text-primary-600 dark:text-primary-500 hover:underline">Edit</button>
                                                        <button onClick={() => setUserToDelete(teacher)} className="font-medium text-red-600 dark:text-red-500 hover:underline">Delete</button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            {totalPages > 0 && (
                                <div className="flex justify-between items-center p-4 border-t dark:border-secondary-700">
                                    <span className="text-sm text-secondary-700 dark:text-secondary-400">
                                        Showing {showingFrom} - {showingTo} of {filteredTeachers.length} teachers
                                    </span>
                                    <div className="flex items-center space-x-2">
                                        <button
                                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                            disabled={currentPage === 1}
                                            className="px-3 py-1 text-sm rounded-md border dark:border-secondary-600 disabled:opacity-50"
                                        >
                                            Previous
                                        </button>
                                        <span className="text-sm px-2">{currentPage} of {totalPages}</span>
                                        <button
                                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                            disabled={currentPage === totalPages}
                                            className="px-3 py-1 text-sm rounded-md border dark:border-secondary-600 disabled:opacity-50"
                                        >
                                            Next
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </>
    );
};

export default TeacherManagementPage;
