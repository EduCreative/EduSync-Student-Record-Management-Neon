import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { User, UserRole } from '../../types';
import Badge from '../common/Badge';
import UserFormModal from './UserFormModal';
import Modal from '../common/Modal';
import Avatar from '../common/Avatar';
import { formatDateTime, DownloadIcon, UploadIcon } from '../../constants';
import TableSkeleton from '../common/skeletons/TableSkeleton';
import { exportToCsv } from '../../utils/csvHelper';
import ImportModal from '../common/ImportModal';
import { Permission } from '../../permissions';

interface UserManagementPageProps {
    payload?: { roleFilter?: UserRole };
}

const UserManagementPage: React.FC<UserManagementPageProps> = ({ payload }) => {
    const { user: currentUser, activeSchoolId, hasPermission } = useAuth();
    const { users, schools, getSchoolById, bulkAddUsers, updateUser, deleteUser, loading, addUserByAdmin } = useData();
    
    const effectiveSchoolId = currentUser?.role === UserRole.Owner && activeSchoolId ? activeSchoolId : currentUser?.schoolId;
    const isOwnerGlobalView = currentUser?.role === UserRole.Owner && !activeSchoolId;

    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>(payload?.roleFilter || 'all');
    const [schoolFilter, setSchoolFilter] = useState<string>('all');
    const [statusFilter, setStatusFilter] = useState<User['status'] | 'all'>('all');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [userToEdit, setUserToEdit] = useState<User | null>(null);
    const [userToDelete, setUserToDelete] = useState<User | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const USERS_PER_PAGE = 10;

    const creatableRoles = useMemo(() => {
        if (!currentUser) return [];

        switch (currentUser.role) {
            case UserRole.Owner:
                return Object.values(UserRole);
            case UserRole.Admin:
                return Object.values(UserRole).filter(role => ![UserRole.Owner, UserRole.Admin].includes(role));
            default:
                return [];
        }
    }, [currentUser]);

    const filteredUsers = useMemo(() => {
        return users
            .filter(user => {
                const isAdminView = currentUser?.role === UserRole.Admin || (currentUser?.role === UserRole.Owner && activeSchoolId);
                if (isAdminView && user.schoolId !== effectiveSchoolId) {
                    return false;
                }
                if (currentUser?.role === UserRole.Owner && schoolFilter !== 'all' && user.schoolId !== schoolFilter) {
                    return false;
                }
                if (roleFilter !== 'all' && user.role !== roleFilter) {
                    return false;
                }
                if (statusFilter !== 'all' && user.status !== statusFilter) {
                    return false;
                }
                if (searchTerm && !user.name.toLowerCase().includes(searchTerm.toLowerCase()) && !user.email.toLowerCase().includes(searchTerm.toLowerCase())) {
                    return false;
                }
                // Admin should not see other Admins or Owners
                if (currentUser?.role === UserRole.Admin && (user.role === UserRole.Admin || user.role === UserRole.Owner)) {
                    return false;
                }
                return true;
            });
    }, [users, currentUser, searchTerm, roleFilter, schoolFilter, statusFilter, activeSchoolId, effectiveSchoolId]);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, roleFilter, schoolFilter, statusFilter]);

    const totalPages = Math.ceil(filteredUsers.length / USERS_PER_PAGE);

    const paginatedUsers = useMemo(() => {
        const startIndex = (currentPage - 1) * USERS_PER_PAGE;
        const endIndex = startIndex + USERS_PER_PAGE;
        return filteredUsers.slice(startIndex, endIndex);
    }, [filteredUsers, currentPage]);


    const handleOpenModal = (user: User | null = null) => {
        setUserToEdit(user);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setUserToEdit(null);
        setIsModalOpen(false);
    };

    const handleSaveUser = async (userData: User | (Omit<User, 'id' | 'lastLogin' | 'disabledNavLinks'> & { disabledNavLinks?: string[], password?: string })) => {
        if ('id' in userData) {
            await updateUser(userData as User);
        } else {
            const singleUserData = { ...userData, schoolId: userData.schoolId || effectiveSchoolId || ''};
            await addUserByAdmin(singleUserData);
        }
    };

    const handleDeleteUser = () => {
        if (userToDelete) {
            deleteUser(userToDelete.id);
            setUserToDelete(null); 
        }
    };

    const validateUserImport = async (data: any[]) => {
        const validRecords: any[] = [];
        const invalidRecords: { record: any, reason: string, rowNum: number }[] = [];
        const required = ['name', 'email', 'role', 'password'];

        data.forEach((item, index) => {
            const rowNum = index + 2;
            const missing = required.filter(h => !item[h]);
            if(missing.length > 0) {
                invalidRecords.push({ record: item, reason: `Missing required fields: ${missing.join(', ')}`, rowNum });
            } else if (isOwnerGlobalView && !item.schoolId) {
                invalidRecords.push({ record: item, reason: `Missing required field: schoolId`, rowNum });
            }
            else {
                validRecords.push(item);
            }
        });
        return { validRecords, invalidRecords };
    };
    
    const handleImportUsers = async (validData: any[], progressCallback: (progress: { processed: number; total: number; errors: string[] }) => void) => {
        if (!effectiveSchoolId && !isOwnerGlobalView) {
            throw new Error("No active school selected for import.");
        }
    
        const CHUNK_SIZE = 50;
        let processed = 0;

        for (let i = 0; i < validData.length; i += CHUNK_SIZE) {
            const chunk = validData.slice(i, i + CHUNK_SIZE);
            const usersToImport = chunk.map(item => ({
                ...item,
                status: 'Active',
                schoolId: item.schoolId || effectiveSchoolId,
            }));

            if (usersToImport.length > 0) {
                await bulkAddUsers(usersToImport);
            }
            
            processed += chunk.length;
            progressCallback({ processed, total: validData.length, errors: [] });
        }
    };

    const sampleDataForImport = [{
        name: "John Doe",
        email: "john.doe@example.com",
        role: "Teacher",
        password: "securePassword123",
        ...(isOwnerGlobalView && { schoolId: "paste_valid_school_id_here" })
    }];

    const requiredHeaders = ['name', 'email', 'role', 'password'];
    if (isOwnerGlobalView) {
        requiredHeaders.push('schoolId');
    }

    const handleExport = () => {
        const dataToExport = filteredUsers.map(u => ({
            name: u.name,
            email: u.email,
            role: u.role,
            status: u.status,
            school: u.schoolId != null ? getSchoolById(u.schoolId)?.name || 'N/A' : 'N/A',
            last_login: formatDateTime(u.lastLogin),
        }));
        exportToCsv(dataToExport, 'users_export');
    };
    
    const showingFrom = filteredUsers.length > 0 ? (currentPage - 1) * USERS_PER_PAGE + 1 : 0;
    const showingTo = Math.min(currentPage * USERS_PER_PAGE, filteredUsers.length);

    const getStatusBadgeColor = (status: User['status']) => {
        switch (status) {
            case 'Active': return 'green';
            case 'Inactive': return 'secondary';
            case 'Suspended': return 'red';
            case 'Pending Approval': return 'yellow';
            default: return 'secondary';
        }
    };
    
    const skeletonColumns = [
        { width: '35%' }, 
        { width: '15%' }, 
        ...(currentUser?.role === UserRole.Owner && !activeSchoolId ? [{ width: '15%' }] : []),
        { width: '10%' }, 
        { width: '15%' }, 
        { width: '10%' }
    ];

    return (
        <>
            <UserFormModal isOpen={isModalOpen} onClose={handleCloseModal} onSave={handleSaveUser} userToEdit={userToEdit} />
            <ImportModal
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                onValidate={validateUserImport}
                onImport={handleImportUsers}
                sampleData={sampleDataForImport}
                fileName="Users"
                requiredHeaders={requiredHeaders}
            />
            <Modal
                isOpen={!!userToDelete}
                onClose={() => setUserToDelete(null)}
                title="Confirm User Deactivation"
            >
                <div>
                    <p className="text-sm text-secondary-600 dark:text-secondary-400">
                        Are you sure you want to deactivate the user{' '}
                        <strong className="text-secondary-800 dark:text-secondary-200">{userToDelete?.name}</strong>?
                        They will no longer be able to log in. Their record will not be permanently deleted.
                    </p>
                    <div className="mt-6 flex justify-end space-x-3">
                        <button
                            type="button"
                            onClick={() => setUserToDelete(null)}
                            className="btn-secondary"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleDeleteUser}
                            className="btn-danger"
                        >
                            Deactivate
                        </button>
                    </div>
                </div>
            </Modal>

            <div className="space-y-6">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                    <h1 className="text-3xl font-bold text-secondary-900 dark:text-white">User Management</h1>
                    <div className="flex items-center gap-2">
                         <button onClick={() => setIsImportModalOpen(true)} className="btn-secondary">
                            <UploadIcon className="w-4 h-4" /> Import CSV
                        </button>
                        <button onClick={handleExport} className="btn-secondary">
                            <DownloadIcon className="w-4 h-4" /> Export CSV
                        </button>
                        {hasPermission(Permission.CAN_MANAGE_USERS) && (
                            <button onClick={() => handleOpenModal()} className="btn-primary">
                                + Add User
                            </button>
                        )}
                    </div>
                </div>

                <div className="p-4 bg-white dark:bg-secondary-800 rounded-lg shadow-md">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                         <div className={currentUser?.role === UserRole.Owner ? 'sm:col-span-2 lg:col-span-1' : 'sm:col-span-2'}>
                            <label htmlFor="search-user" className="input-label">Search Users</label>
                            <input
                                id="search-user"
                                type="text"
                                placeholder="By name or email..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="input-field"
                            />
                        </div>

                        {currentUser?.role === UserRole.Owner && !activeSchoolId && (
                            <div>
                                <label htmlFor="school-filter" className="input-label">School</label>
                                <select id="school-filter" value={schoolFilter} onChange={e => setSchoolFilter(e.target.value)} className="input-field">
                                    <option value="all">All Schools</option>
                                    {schools.map(school => <option key={school.id} value={school.id}>{school.name}</option>)}
                                </select>
                            </div>
                        )}
                        
                        <div>
                             <label htmlFor="role-filter" className="input-label">Role</label>
                             <select id="role-filter" value={roleFilter} onChange={e => setRoleFilter(e.target.value as UserRole | 'all')} className="input-field">
                                <option value="all">All Roles</option>
                                {creatableRoles.map(role => <option key={role} value={role}>{role}</option>)}
                            </select>
                        </div>
                       
                        <div>
                            <label htmlFor="status-filter" className="input-label">Status</label>
                            <select id="status-filter" value={statusFilter} onChange={e => setStatusFilter(e.target.value as User['status'] | 'all')} className="input-field">
                                <option value="all">All Statuses</option>
                                <option value="Active">Active</option>
                                <option value="Inactive">Inactive</option>
                                <option value="Pending Approval">Pending Approval</option>
                                <option value="Suspended">Suspended</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-secondary-800 rounded-lg shadow-md">
                    {loading ? (
                        <TableSkeleton columns={skeletonColumns} rows={USERS_PER_PAGE} />
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left text-secondary-500 dark:text-secondary-400">
                                    <thead className="text-xs text-secondary-700 uppercase bg-secondary-50 dark:bg-secondary-700 dark:text-secondary-300">
                                        <tr>
                                            <th scope="col" className="px-6 py-3">User</th>
                                            <th scope="col" className="px-6 py-3">Role</th>
                                            {currentUser?.role === UserRole.Owner && !activeSchoolId && <th scope="col" className="px-6 py-3">School</th>}
                                            <th scope="col" className="px-6 py-3">Status</th>
                                            <th scope="col" className="px-6 py-3">Last Login</th>
                                            <th scope="col" className="px-6 py-3">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {paginatedUsers.map(user => {
                                            const canManage = hasPermission(Permission.CAN_MANAGE_USERS);
                                            const canDelete = hasPermission(Permission.CAN_DELETE_USERS);

                                            const canPerformActionsOnUser = (() => {
                                                if (!currentUser || currentUser.id === user.id) return false;
                                                if (user.role === UserRole.Owner) return false;
                                                if (currentUser.role === UserRole.Admin && user.role === UserRole.Admin) return false;
                                                return true;
                                            })();

                                            return (
                                                <tr key={user.id} className="bg-white dark:bg-secondary-800 border-b dark:border-secondary-700 hover:bg-secondary-50 dark:hover:bg-secondary-700/50">
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center space-x-3">
                                                            <Avatar user={user} className="h-10 w-10" />
                                                            <div>
                                                                <div className="font-semibold text-secondary-900 dark:text-white">{user.name}</div>
                                                                <div className="text-xs text-secondary-500">{user.email}</div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4"><Badge>{user.role}</Badge></td>
                                                    {currentUser?.role === UserRole.Owner && !activeSchoolId && <td className="px-6 py-4">{user.schoolId != null ? getSchoolById(user.schoolId)?.name || 'N/A' : 'N/A'}</td>}
                                                    <td className="px-6 py-4">
                                                        <Badge color={getStatusBadgeColor(user.status)}>
                                                            {user.status}
                                                        </Badge>
                                                    </td>
                                                    <td className="px-6 py-4">{formatDateTime(user.lastLogin)}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <div className="flex items-center space-x-4">
                                                            {canManage && canPerformActionsOnUser && (
                                                                <button 
                                                                    onClick={() => handleOpenModal(user)} 
                                                                    className="font-medium text-primary-600 dark:text-primary-500 hover:underline"
                                                                >
                                                                    Edit
                                                                </button>
                                                            )}
                                                             {canDelete && canPerformActionsOnUser && (
                                                                <button 
                                                                    onClick={() => setUserToDelete(user)} 
                                                                    className="font-medium text-red-600 dark:text-red-500 hover:underline"
                                                                >
                                                                    Deactivate
                                                                </button>
                                                             )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            {totalPages > 0 && (
                                <div className="flex justify-between items-center p-4 border-t dark:border-secondary-700">
                                    <span className="text-sm text-secondary-700 dark:text-secondary-400">
                                        Showing {showingFrom} - {showingTo} of {filteredUsers.length} users
                                    </span>
                                    <div className="flex items-center space-x-2">
                                        <button
                                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                            disabled={currentPage === 1}
                                            className="px-3 py-1 text-sm font-medium text-secondary-600 bg-white dark:bg-secondary-700 border border-secondary-300 dark:border-secondary-600 rounded-md hover:bg-secondary-50 dark:hover:bg-secondary-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            Previous
                                        </button>
                                        <span className="text-sm text-secondary-700 dark:text-secondary-400">
                                            Page {currentPage} of {totalPages}
                                        </span>
                                        <button
                                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                            disabled={currentPage === totalPages}
                                            className="px-3 py-1 text-sm font-medium text-secondary-600 bg-white dark:bg-secondary-700 border border-secondary-300 dark:border-secondary-600 rounded-md hover:bg-secondary-50 dark:hover:bg-secondary-600 disabled:opacity-50 disabled:cursor-not-allowed"
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

export default UserManagementPage;