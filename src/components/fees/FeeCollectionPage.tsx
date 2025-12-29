
import React, { useState, useMemo, useEffect } from 'react';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { Student, UserRole, FeeChallan, Class } from '../../types';
import Avatar from '../common/Avatar';
import FeePaymentModal from './FeePaymentModal';
import Badge from '../common/Badge';
import Modal from '../common/Modal';
import { Permission } from '../../permissions';
import SingleChallanGenerationModal from './SingleChallanGenerationModal';
import { getClassLevel } from '../../utils/sorting';
import { formatDate } from '../../constants';
import StudentFeeHistory from '../students/StudentFeeHistory';

const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const getTodayString = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = (today.getMonth() + 1).toString().padStart(2, '0');
    const day = today.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const FeeCollectionPage: React.FC = () => {
    const { user, activeSchoolId, hasPermission } = useAuth();
    const { students, fees, classes, cancelChallan } = useData();
    const [searchTerm, setSearchTerm] = useState('');
    
    const [challanToManage, setChallanToManage] = useState<{ challan: FeeChallan, student: Student, mode: 'pay' | 'edit' } | null>(null);
    const [challanToCancel, setChallanToCancel] = useState<FeeChallan | null>(null);
    const [sessionDate, setSessionDate] = useState(getTodayString());
    
    // Filters
    const [statusFilter, setStatusFilter] = useState<'Outstanding' | 'All' | 'Paid' | 'Unpaid' | 'Partial'>('Outstanding');
    const [classFilter, setClassFilter] = useState('all');
    const [monthFilter, setMonthFilter] = useState(new Date().toISOString().slice(0, 7)); // Format: YYYY-MM
    const [sortBy, setSortBy] = useState<'date' | 'name' | 'rollNumber' | 'class'>('date');

    // Single Challan Generation
    const [isStudentSelectModalOpen, setIsStudentSelectModalOpen] = useState(false);
    const [studentForChallan, setStudentForChallan] = useState<Student | null>(null);
    const [isSingleChallanModalOpen, setIsSingleChallanModalOpen] = useState(false);
    const [studentSearchTerm, setStudentSearchTerm] = useState('');

    // Fee History Modal
    const [viewHistoryStudent, setViewHistoryStudent] = useState<Student | null>(null);

    const [currentPage, setCurrentPage] = useState(1);
    const ROWS_PER_PAGE = 15;

    const canManage = hasPermission(Permission.CAN_MANAGE_FEES);
    const effectiveSchoolId = user?.role === UserRole.Owner && activeSchoolId ? activeSchoolId : user?.schoolId;

    const schoolClasses = useMemo(() => classes.filter(c => c.schoolId === effectiveSchoolId)
        .sort((a, b) => (a.sortOrder ?? Infinity) - (b.sortOrder ?? Infinity) || getClassLevel(a.name) - getClassLevel(b.name)), 
        [classes, effectiveSchoolId]);
    const classMap = useMemo(() => new Map(classes.map((c: Class) => [c.id, c.name])), [classes]);
    const studentMap = useMemo(() => new Map(students.map(s => [s.id, s])), [students]);

    const filteredChallans = useMemo(() => {
        const filtered = fees.filter(challan => {
            if (challan.status === 'Cancelled') return false;
            
            const student = studentMap.get(challan.studentId);
            if (!student || student.schoolId !== effectiveSchoolId) return false;

            // Class Filter
            if (classFilter !== 'all' && student.classId !== classFilter) return false;

            // Month Filter (Challan Month)
            if (monthFilter) {
                const [fYear, fMonth] = monthFilter.split('-');
                const challanMonthIndex = months.indexOf(challan.month);
                const challanMonthStr = String(challanMonthIndex + 1).padStart(2, '0');
                const challanYearStr = String(challan.year);
                
                if (challanYearStr !== fYear || challanMonthStr !== fMonth) return false;
            }

            // Status Filter
            if (statusFilter === 'Outstanding') {
                if (challan.status === 'Paid') return false;
            } else if (statusFilter !== 'All') {
                 // Map 'Partial' to match specific cases if needed, but 'Partial' status matches directly
                 if (statusFilter === 'Partial' && challan.status !== 'Partial') return false;
                 if (statusFilter === 'Paid' && challan.status !== 'Paid') return false;
                 if (statusFilter === 'Unpaid' && challan.status !== 'Unpaid') return false;
            }

            // Search Filter
            if (searchTerm) {
                const lowerTerm = searchTerm.toLowerCase();
                return (
                    student.name.toLowerCase().includes(lowerTerm) ||
                    student.rollNumber.toLowerCase().includes(lowerTerm) ||
                    challan.challanNumber.toLowerCase().includes(lowerTerm)
                );
            }

            return true;
        });
        
        return filtered.sort((a, b) => {
            const studentA = studentMap.get(a.studentId);
            const studentB = studentMap.get(b.studentId);

            if (sortBy === 'name') {
                return (studentA?.name || '').localeCompare(studentB?.name || '');
            }
            if (sortBy === 'rollNumber') {
                return (studentA?.rollNumber || '').localeCompare(studentB?.rollNumber || '', undefined, { numeric: true });
            }
            if (sortBy === 'class') {
                const classA = classMap.get(studentA?.classId || '') || '';
                const classB = classMap.get(studentB?.classId || '') || '';
                const diff = getClassLevel(classA) - getClassLevel(classB);
                if (diff !== 0) return diff;
                return (studentA?.rollNumber || '').localeCompare(studentB?.rollNumber || '', undefined, { numeric: true });
            }

            // Default 'date' / priority logic
            const isAOutstanding = a.status === 'Unpaid' || a.status === 'Partial';
            const isBOutstanding = b.status === 'Unpaid' || b.status === 'Partial';
            
            if (isAOutstanding && !isBOutstanding) return -1;
            if (!isAOutstanding && isBOutstanding) return 1;
            
            const dateA = new Date(a.year, months.indexOf(a.month)).getTime();
            const dateB = new Date(b.year, months.indexOf(b.month)).getTime();
            return dateB - dateA;
        });

    }, [fees, studentMap, effectiveSchoolId, statusFilter, classFilter, monthFilter, searchTerm, sortBy, classMap]);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, statusFilter, classFilter, monthFilter, sortBy]);

    const totalPages = Math.ceil(filteredChallans.length / ROWS_PER_PAGE);
    const paginatedChallans = useMemo(() => {
        const startIndex = (currentPage - 1) * ROWS_PER_PAGE;
        return filteredChallans.slice(startIndex, startIndex + ROWS_PER_PAGE);
    }, [filteredChallans, currentPage]);


    const getStatusColor = (status: FeeChallan['status']) => {
        if (status === 'Paid') return 'green';
        if (status === 'Unpaid') return 'red';
        if (status === 'Cancelled') return 'secondary';
        return 'yellow'; // Partial
    }

    const handleConfirmCancel = async () => {
        if (challanToCancel) {
            await cancelChallan(challanToCancel.id);
            setChallanToCancel(null);
        }
    };

    const handleSelectStudentForChallan = (student: Student) => {
        setStudentForChallan(student);
        setIsStudentSelectModalOpen(false);
        setIsSingleChallanModalOpen(true);
    };

    const filteredStudentsForSelection = useMemo(() => {
        return students.filter(s => 
            s.schoolId === effectiveSchoolId && 
            s.status === 'Active' &&
            (studentSearchTerm === '' || s.name.toLowerCase().includes(studentSearchTerm.toLowerCase()) || s.rollNumber.includes(studentSearchTerm))
        ).sort((a, b) => a.name.localeCompare(b.name));
    }, [students, effectiveSchoolId, studentSearchTerm]);

    const showingFrom = filteredChallans.length > 0 ? (currentPage - 1) * ROWS_PER_PAGE + 1 : 0;
    const showingTo = Math.min(currentPage * ROWS_PER_PAGE, filteredChallans.length);

    // Edit logic for History Component
    const handleEditFromHistory = (challan: FeeChallan) => {
        const student = studentMap.get(challan.studentId);
        if (student) {
            setChallanToManage({ challan, student, mode: 'edit' });
            setViewHistoryStudent(null); // Close history modal to focus on edit
        }
    };

    return (
        <>
            {challanToManage && (
                <FeePaymentModal
                    isOpen={!!challanToManage}
                    onClose={() => setChallanToManage(null)}
                    challan={challanToManage.challan}
                    student={challanToManage.student}
                    editMode={challanToManage.mode === 'edit'}
                    defaultDate={sessionDate}
                />
            )}
            
            {/* Single Challan Generation Modal Flow */}
            {isStudentSelectModalOpen && (
                <Modal isOpen={isStudentSelectModalOpen} onClose={() => setIsStudentSelectModalOpen(false)} title="Select Student for Single Challan">
                    <div className="space-y-4">
                        <input 
                            type="text" 
                            placeholder="Search student..." 
                            className="input-field" 
                            value={studentSearchTerm}
                            onChange={e => setStudentSearchTerm(e.target.value)}
                            autoFocus
                        />
                        <div className="max-h-60 overflow-y-auto border dark:border-secondary-600 rounded-md">
                            {filteredStudentsForSelection.length > 0 ? (
                                <ul className="divide-y dark:divide-secondary-600">
                                    {filteredStudentsForSelection.map(s => (
                                        <li key={s.id} onClick={() => handleSelectStudentForChallan(s)} className="p-2 hover:bg-secondary-50 dark:hover:bg-secondary-700 cursor-pointer flex justify-between items-center">
                                            <span>{s.name} <span className="text-xs font-bold text-primary-700 dark:text-primary-400">(ID: {s.rollNumber})</span></span>
                                            <span className="text-xs text-secondary-400">{classMap.get(s.classId)}</span>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="p-4 text-center text-secondary-500 text-sm">No students found.</p>
                            )}
                        </div>
                        <div className="flex justify-end">
                            <button onClick={() => setIsStudentSelectModalOpen(false)} className="btn-secondary">Cancel</button>
                        </div>
                    </div>
                </Modal>
            )}
            
            {studentForChallan && (
                <SingleChallanGenerationModal
                    isOpen={isSingleChallanModalOpen}
                    onClose={() => setIsSingleChallanModalOpen(false)}
                    student={studentForChallan}
                />
            )}

            {challanToCancel && (
                <Modal
                    isOpen={!!challanToCancel}
                    onClose={() => setChallanToCancel(null)}
                    title="Confirm Challan Cancellation"
                >
                    <p>Are you sure you want to cancel the challan for <strong>{challanToCancel.month} {challanToCancel.year}</strong>? This action cannot be undone.</p>
                    <div className="mt-6 flex justify-end space-x-3">
                        <button type="button" onClick={() => setChallanToCancel(null)} className="btn-secondary">Back</button>
                        <button type="button" onClick={handleConfirmCancel} className="btn-danger">Confirm Cancel</button>
                    </div>
                </Modal>
            )}

            {/* Fee History Modal */}
            <Modal
                isOpen={!!viewHistoryStudent}
                onClose={() => setViewHistoryStudent(null)}
                title={`Fee History: ${viewHistoryStudent?.name}`}
            >
                <div className="max-h-[70vh] overflow-y-auto pr-1">
                    {viewHistoryStudent && (
                        <StudentFeeHistory 
                            studentId={viewHistoryStudent.id} 
                            onEditChallan={handleEditFromHistory} 
                        />
                    )}
                </div>
                <div className="flex justify-end mt-4">
                    <button onClick={() => setViewHistoryStudent(null)} className="btn-secondary">Close</button>
                </div>
            </Modal>

            <div className="p-4 sm:p-6 space-y-4">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <h1 className="text-2xl font-bold text-secondary-900 dark:text-white">Fee Collection</h1>
                     <div className="flex gap-2">
                         {canManage && (
                             <button onClick={() => setIsStudentSelectModalOpen(true)} className="btn-primary text-sm">
                                 + New Single Challan
                             </button>
                         )}
                     </div>
                </div>

                {/* Filters Reordered: Search, Class, CHALLAN Month, Challan Status, Sort By, Payment Date */}
                <div className="bg-white dark:bg-secondary-800 p-4 rounded-lg shadow-md grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 items-end">
                    <div className="col-span-1">
                        <label htmlFor="student-search" className="input-label">Search</label>
                        <input
                            id="student-search"
                            type="text"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="input-field"
                            placeholder="Name, ID, Challan #"
                        />
                    </div>
                    <div className="col-span-1">
                        <label htmlFor="class-filter" className="input-label">Class</label>
                         <select
                            id="class-filter"
                            value={classFilter}
                            onChange={e => setClassFilter(e.target.value)}
                            className="input-field"
                        >
                            <option value="all">All Classes</option>
                            {schoolClasses.map(c => <option key={c.id} value={c.id}>{c.name} {c.section}</option>)}
                        </select>
                    </div>
                    <div className="col-span-1">
                        <label htmlFor="month-filter" className="input-label">Challan Month</label>
                        <input 
                            type="month" 
                            id="month-filter" 
                            value={monthFilter} 
                            onChange={e => setMonthFilter(e.target.value)} 
                            className="input-field"
                        />
                    </div>
                    <div className="col-span-1">
                        <label htmlFor="status-filter" className="input-label">Challan Status</label>
                        <select
                            id="status-filter"
                            value={statusFilter}
                            onChange={e => setStatusFilter(e.target.value as any)}
                            className="input-field"
                        >
                            <option value="Outstanding">Outstanding (Default)</option>
                            <option value="All">All</option>
                            <option value="Paid">Paid</option>
                            <option value="Unpaid">Unpaid</option>
                            <option value="Partial">Partial Paid</option>
                        </select>
                    </div>
                    <div className="col-span-1">
                        <label htmlFor="sort-by" className="input-label">Sort By</label>
                        <select
                            id="sort-by"
                            value={sortBy}
                            onChange={e => setSortBy(e.target.value as any)}
                            className="input-field"
                        >
                            <option value="date">Default (Status/Date)</option>
                            <option value="rollNumber">Student ID</option>
                            <option value="name">Student Name</option>
                            <option value="class">Class</option>
                        </select>
                    </div>
                    <div className="col-span-1">
                        <label htmlFor="session-date" className="input-label">Payment Date</label>
                        <input
                            id="session-date"
                            type="date"
                            value={sessionDate}
                            onChange={e => setSessionDate(e.target.value)}
                            className="input-field"
                            title="Default date for new payments"
                        />
                    </div>
                </div>
                
                <div className="bg-white dark:bg-secondary-800 rounded-lg shadow-md overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-secondary-700 uppercase bg-secondary-50 dark:bg-secondary-700 dark:text-secondary-300">
                                <tr>
                                    <th className="px-4 py-3">Student</th>
                                    <th className="px-4 py-3">Class</th>
                                    <th className="px-4 py-3">Challan</th>
                                    <th className="px-4 py-3">Due Date</th>
                                    <th className="px-4 py-3 text-right">Arrears</th>
                                    <th className="px-4 py-3 text-right">Current Dues</th>
                                    <th className="px-4 py-3 text-right">Outstanding Balance</th>
                                    <th className="px-4 py-3 text-center">Status</th>
                                    <th className="px-4 py-3 text-center">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y dark:divide-secondary-700">
                                {paginatedChallans.map(challan => {
                                    const student = studentMap.get(challan.studentId);
                                    if (!student) return null;
                                    
                                    const arrears = challan.previousBalance || 0;
                                    const currentDues = challan.totalAmount - arrears;
                                    const outstanding = challan.totalAmount - challan.discount - challan.paidAmount;
                                    const isOverdue = new Date(challan.dueDate) < new Date() && (challan.status === 'Unpaid' || challan.status === 'Partial');
                                    
                                    return (
                                        <tr key={challan.id} className="hover:bg-secondary-50 dark:hover:bg-secondary-700/50 transition-colors">
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <Avatar student={student} className="w-8 h-8" />
                                                    <div>
                                                        <div className="font-medium text-secondary-900 dark:text-white">{student.name}</div>
                                                        <div className="text-xs font-bold text-primary-700 dark:text-primary-400">ID: {student.rollNumber}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-secondary-600 dark:text-secondary-400">{classMap.get(student.classId)}</td>
                                            <td className="px-4 py-3 font-medium">{challan.month} {challan.year}</td>
                                            <td className={`px-4 py-3 text-sm ${isOverdue ? 'text-red-600 dark:text-red-400 font-medium' : ''}`}>
                                                {formatDate(challan.dueDate)}
                                            </td>
                                            <td className="px-4 py-3 text-right text-secondary-600 dark:text-secondary-400">{arrears > 0 ? `Rs. ${arrears.toLocaleString()}` : '-'}</td>
                                            <td className="px-4 py-3 text-right text-secondary-600 dark:text-secondary-400">Rs. {currentDues.toLocaleString()}</td>
                                            <td className={`px-4 py-3 text-right font-bold ${outstanding > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                                                Rs. {outstanding.toLocaleString()}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <Badge color={getStatusColor(challan.status)}>{challan.status}</Badge>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <div className="flex flex-col gap-1 items-center">
                                                    {canManage && (challan.status === 'Unpaid' || challan.status === 'Partial') ? (
                                                        <button 
                                                            onClick={() => setChallanToManage({ challan, student, mode: 'pay' })} 
                                                            className="px-3 py-1 text-xs font-medium text-white bg-green-600 rounded hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors"
                                                        >
                                                            Record Payment
                                                        </button>
                                                    ) : (
                                                        <div className="flex justify-center gap-2">
                                                            {canManage && (challan.status === 'Paid' || challan.status === 'Partial') && (
                                                                <button onClick={() => setChallanToManage({ challan, student, mode: 'edit' })} className="text-xs text-primary-600 hover:underline">Record Payment</button>
                                                            )}
                                                            {canManage && challan.status !== 'Paid' && challan.status !== 'Cancelled' && (
                                                                <button onClick={() => setChallanToCancel(challan)} className="text-xs text-red-600 hover:underline">Cancel</button>
                                                            )}
                                                        </div>
                                                    )}
                                                    <button onClick={() => setViewHistoryStudent(student)} className="text-xs text-secondary-500 hover:text-primary-600 hover:underline">
                                                        View Fee History
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                         {filteredChallans.length === 0 && (
                            <div className="p-8 text-center text-secondary-500 dark:text-secondary-400">
                                No challans found matching the selected criteria.
                            </div>
                        )}
                    </div>
                     {totalPages > 0 && (
                        <div className="flex justify-between items-center p-4 border-t dark:border-secondary-700">
                            <span className="text-sm text-secondary-700 dark:text-secondary-400">
                                Showing {showingFrom} - {showingTo} of {filteredChallans.length} records
                            </span>
                            {totalPages > 1 && (
                                <div className="flex items-center space-x-2">
                                    <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="btn-secondary text-sm py-1 px-2">Prev</button>
                                    <span className="text-sm px-2">{currentPage} of {totalPages}</span>
                                    <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="btn-secondary text-sm py-1 px-2">Next</button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};

export default FeeCollectionPage;
