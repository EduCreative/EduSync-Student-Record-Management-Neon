import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { User, UserRole } from '../../types';
import Badge from '../common/Badge';
import UserFormModal from '../users/UserFormModal';
import Modal from '../common/Modal';
import Avatar from '../common/Avatar';
import { formatDateTime, DownloadIcon, UploadIcon } from '../../constants';
import TableSkeleton from '../common/skeletons/TableSkeleton';
import { exportToCsv } from '../../utils/csvHelper';
import ImportModal from '../common/ImportModal';

const AccountantManagementPage: React.FC = () => {
    const { user: currentUser, activeSchoolId } = useAuth();
    const { users, bulkAddUsers, updateUser, deleteUser, loading } = useData();
    
    const effectiveSchoolId = currentUser?.role === UserRole.Owner && activeSchoolId ? activeSchoolId : currentUser?.schoolId;

    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'Active' | 'Inactive'>('all');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [userToEdit, setUserToEdit] = useState<User | null>(null);
    const [userToDelete, setUserToDelete] = useState<User | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const USERS_PER_PAGE = 10;

    const schoolAccountants = useMemo(() => {
        return users.filter(user =>
            user.schoolId === effectiveSchoolId && user.role === UserRole.Accountant
        );
    }, [users, effectiveSchoolId]);

    const filteredAccountants = useMemo(() => {
        return schoolAccountants.filter(accountant => {
            if (statusFilter !== 'all' && accountant.status !== statusFilter) return false;
            if (searchTerm && !accountant.name.toLowerCase().includes(searchTerm.toLowerCase()) && !accountant.email.toLowerCase().includes(searchTerm.toLowerCase())) return false;
            return true;
        });
    }, [schoolAccountants, searchTerm, statusFilter]);
    
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, statusFilter]);

    const totalPages = Math.ceil(filteredAccountants.length / USERS_PER_PAGE);
    const paginatedAccountants = useMemo(() => {
        const startIndex = (currentPage - 1) * USERS_PER_PAGE;
        return filteredAccountants.slice(startIndex, startIndex + USERS_PER_PAGE);
    }, [filteredAccountants, currentPage]);
    
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

    const handleDeleteUser = () => {
        if (userToDelete) {
            deleteUser(userToDelete.id);
            setUserToDelete(null);
        }
    };
    
    const validateAccountantImport = async (data: any[]) => {
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

    const handleImportAccountants = async (validData: any[], progressCallback: (progress: { processed: number; total: number; errors: string[] }) => void) => {
        if (!effectiveSchoolId) {
            throw new Error("No active school selected for import.");
        }
        
        const CHUNK_SIZE = 50;
        let processed = 0;

        for (let i = 0; i < validData.length; i += CHUNK_SIZE) {
            const chunk = validData.slice(i, i + CHUNK_SIZE);
            const accountantsToImport = chunk.map(item => ({
                ...item,
                role: UserRole.Accountant,
                status: 'Active',
                schoolId: effectiveSchoolId,
            }));

            if (accountantsToImport.length > 0) {
                await bulkAddUsers(accountantsToImport);
            }
            
            processed += chunk.length;
            progressCallback({ processed, total: validData.length, errors: [] });
        }
    };

    const sampleDataForImport = [{
        name: "Adam Smith",
        email: "accountant.adam@example.com",
        password: "securePassword123"
    }];

    const requiredHeaders = ['name', 'email', 'password'];

    const handleExport = () => {
        const dataToExport = filteredAccountants.map(a => ({
            name: a.name,
            email: a.email,
            status: a.status,
            last_login: formatDateTime(a.lastLogin),
        }));
        exportToCsv(dataToExport, 'accountants_export');
    };
    
    const showingFrom = filteredAccountants.length > 0 ? (currentPage - 1) * USERS_PER_PAGE + 1 : 0;
    const showingTo = Math.min(currentPage * USERS_PER_PAGE, filteredAccountants.length);

    return (
        <>
            <UserFormModal 
                isOpen={isModalOpen} 
                onClose={handleCloseModal} 
                onSave={handleSaveUser} 
                userToEdit={userToEdit}
                defaultRole={UserRole.Accountant}
                lockRole={true}
            />
             <ImportModal
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                onValidate={validateAccountantImport}
                onImport={handleImportAccountants}
                sampleData={sampleDataForImport}
                fileName="Accountants"
                requiredHeaders={requiredHeaders}
            />
            <Modal isOpen={!!userToDelete} onClose={() => setUserToDelete(null)} title="Confirm Accountant Deletion">
                <div>
                    <p className="text-sm text-secondary-600 dark:text-secondary-400">
                        Are you sure you want to permanently delete the accountant{' '}
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
                    <h1 className="text-3xl font-bold text-secondary-900 dark:text-white">Accountant Management</h1>
                    <div className="flex items-center gap-2">
                        <button onClick={() => setIsImportModalOpen(true)} className="btn-secondary">
                            <UploadIcon className="w-4 h-4" /> Import CSV
                        </button>
                        <button onClick={handleExport} className="btn-secondary">
                            <DownloadIcon className="w-4 h-4" /> Export CSV
                        </button>
                        <button onClick={() => handleOpenModal()} className="btn-primary">
                            + Add Accountant
                        </button>
                    </div>
                </div>

                {/* Filters */}
                <div className="p-4 bg-white dark:bg-secondary-800 rounded-lg shadow-md">
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="search-accountant" className="input-label">Search Accountants</label>
                            <input
                                id="search-accountant"
                                type="text"
                                placeholder="By name or email..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="input-field"
                            />
                        </div>
                        <div>
                            <label htmlFor="status-filter" className="input-label">Status</label>
                            <select id="status-filter" value={statusFilter} onChange={e => setStatusFilter(e.target.value as 'all' | 'Active' | 'Inactive')} className="input-field">
                                <option value="all">All Statuses</option>
                                <option value="Active">Active</option>
                                <option value="Inactive">Inactive</option>
                            </select>
                        </div>
                    </div>
                </div>
                
                {/* Accountants Table */}
                <div className="bg-white dark:bg-secondary-800 rounded-lg shadow-md">
                    {loading ? (
                        <TableSkeleton columns={[{width: '40%'}, {width: '20%'}, {width: '20%'}, {width: '20%'}]} rows={USERS_PER_PAGE} />
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left text-secondary-500 dark:text-secondary-400">
                                    <thead className="text-xs text-secondary-700 uppercase bg-secondary-50 dark:bg-secondary-700 dark:text-secondary-300">
                                        <tr>
                                            <th scope="col" className="px-6 py-3">Accountant</th>
                                            <th scope="col" className="px-6 py-3">Status</th>
                                            <th scope="col" className="px-6 py-3">Last Login</th>
                                            <th scope="col" className="px-6 py-3">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {paginatedAccountants.map(accountant => (
                                            <tr key={accountant.id} className="bg-white dark:bg-secondary-800 border-b dark:border-secondary-700 hover:bg-secondary-50 dark:hover:bg-secondary-700/50">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center space-x-3">
                                                        <Avatar user={accountant} className="h-10 w-10" />
                                                        <div>
                                                            <div className="font-semibold text-secondary-900 dark:text-white">{accountant.name}</div>
                                                            <div className="text-xs text-secondary-500">{accountant.email}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4"><Badge color={accountant.status === 'Active' ? 'green' : 'red'}>{accountant.status}</Badge></td>
                                                <td className="px-6 py-4">{formatDateTime(accountant.lastLogin)}</td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center space-x-4">
                                                        <button onClick={() => handleOpenModal(accountant)} className="font-medium text-primary-600 dark:text-primary-500 hover:underline">Edit</button>
                                                        <button onClick={() => setUserToDelete(accountant)} className="font-medium text-red-600 dark:text-red-500 hover:underline">Delete</button>
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
                                        Showing {showingFrom} - {showingTo} of {filteredAccountants.length} accountants
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

export default AccountantManagementPage;
