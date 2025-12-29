import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { Student, UserRole, FeeChallan } from '../../types';
import Modal from '../common/Modal';
import Avatar from '../common/Avatar';
import Badge from '../common/Badge';
import StudentFormModal from './StudentFormModal';
import { ActiveView } from '../layout/Layout';
import TableSkeleton from '../common/skeletons/TableSkeleton';
import { DownloadIcon, UploadIcon } from '../../constants';
import { exportToCsv } from '../../utils/csvHelper';
import ImportModal from '../common/ImportModal';
import { Permission } from '../../permissions';
import { getClassLevel } from '../../utils/sorting';

interface StudentManagementPageProps {
    setActiveView: (view: ActiveView) => void;
}

// Helper functions for formatting
const formatCnic = (value: string | number | undefined): string => {
    if (!value) return '';
    const digits = String(value).replace(/\D/g, '').slice(0, 13);
    if (digits.length === 13) {
        return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12, 13)}`;
    }
    return String(value); // Return original if not 13 digits, allows for already-formatted input
};

const formatPhoneNumber = (value: string | number | undefined): string => {
    if (!value) return '';
    const digits = String(value).replace(/\D/g, '').slice(0, 11);
     if (digits.length === 11) {
        return `${digits.slice(0, 4)}-${digits.slice(4)}`;
    }
    return String(value);
};

const parseCurrency = (value: any): number | null => {
    if (value === null || value === undefined || String(value).trim() === '') {
        return null;
    }
    const stringValue = String(value).replace(/,/g, '');
    const parsed = parseFloat(stringValue);
    return isNaN(parsed) ? null : parsed;
};


const StudentManagementPage: React.FC<StudentManagementPageProps> = ({ setActiveView }) => {
    const { user, activeSchoolId, hasPermission } = useAuth();
    const { students, classes, addStudent, updateStudent, deleteStudent, loading, bulkAddStudents, feeHeads, fees } = useData();

    const effectiveSchoolId = user?.role === UserRole.Owner && activeSchoolId ? activeSchoolId : user?.schoolId;

    const [searchTerm, setSearchTerm] = useState('');
    const [classFilter, setClassFilter] = useState<string>('all');
    const [statusFilter, setStatusFilter] = useState<Student['status'] | 'all'>('Active');
    const [sortBy, setSortBy] = useState<'name' | 'rollNumber' | 'class'>('rollNumber');
    
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [studentToEdit, setStudentToEdit] = useState<Student | null>(null);
    const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const STUDENTS_PER_PAGE = 10;
    
    const canEdit = hasPermission(Permission.CAN_EDIT_STUDENTS);
    const canDelete = hasPermission(Permission.CAN_DELETE_STUDENTS);

    const schoolClasses = useMemo(() => classes.filter(c => c.schoolId === effectiveSchoolId)
        .sort((a, b) => (a.sortOrder ?? Infinity) - (b.sortOrder ?? Infinity) || getClassLevel(a.name) - getClassLevel(b.name)), 
        [classes, effectiveSchoolId]);
    const classMap = useMemo(() => new Map(schoolClasses.map(c => [c.id, `${c.name}${c.section ? ` - ${c.section}` : ''}`])), [schoolClasses]);

    const studentBalanceMap = useMemo(() => {
        const balanceMap = new Map<string, number>();

        const feesByStudent = fees.reduce((acc, fee) => {
            if (fee.status !== 'Cancelled') {
                if (!acc[fee.studentId]) {
                    acc[fee.studentId] = [];
                }
                acc[fee.studentId].push(fee);
            }
            return acc;
        }, {} as Record<string, FeeChallan[]>);

        students.forEach(student => {
            const studentFees = feesByStudent[student.id] || [];
            
            const totalNewFees = studentFees.reduce((sum, challan) => {
                const newFee = (challan.totalAmount || 0) - (challan.previousBalance || 0);
                return sum + newFee;
            }, 0);
            
            const totalPaid = studentFees.reduce((sum, challan) => sum + (challan.paidAmount || 0), 0);
            const totalDiscount = studentFees.reduce((sum, challan) => sum + (challan.discount || 0), 0);
            const openingBalance = student.openingBalance || 0;

            const balance = openingBalance + totalNewFees - totalPaid - totalDiscount;
            
            balanceMap.set(student.id, balance);
        });
    
        return balanceMap;
    }, [students, fees]);

    const filteredStudents = useMemo(() => {
        const result = students.filter(student => {
            if (student.schoolId !== effectiveSchoolId) return false;
            if (classFilter !== 'all' && student.classId !== classFilter) return false;
            if (statusFilter !== 'all' && student.status !== statusFilter) return false;
            if (searchTerm && !student.name.toLowerCase().includes(searchTerm.toLowerCase()) && !student.rollNumber.toLowerCase().includes(searchTerm.toLowerCase())) return false;
            return true;
        });

        return result.sort((a, b) => {
            if (sortBy === 'name') {
                return a.name.localeCompare(b.name);
            } else if (sortBy === 'class') {
                const classA = classMap.get(a.classId) || '';
                const classB = classMap.get(b.classId) || '';
                const diff = getClassLevel(classA) - getClassLevel(classB);
                if (diff !== 0) return diff;
                return a.rollNumber.localeCompare(b.rollNumber, undefined, { numeric: true });
            } else {
                // Default to rollNumber
                return a.rollNumber.localeCompare(b.rollNumber, undefined, { numeric: true });
            }
        });
    }, [students, effectiveSchoolId, searchTerm, classFilter, statusFilter, sortBy, classMap]);
    
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, classFilter, statusFilter, sortBy]);

    const totalPages = Math.ceil(filteredStudents.length / STUDENTS_PER_PAGE);
    const paginatedStudents = useMemo(() => {
        const startIndex = (currentPage - 1) * STUDENTS_PER_PAGE;
        const endIndex = startIndex + STUDENTS_PER_PAGE;
        return filteredStudents.slice(startIndex, endIndex);
    }, [filteredStudents, currentPage]);

    const handleOpenModal = (student: Student | null = null) => {
        setStudentToEdit(student);
        setIsFormModalOpen(true);
    };

    const handleCloseModal = () => {
        setStudentToEdit(null);
        setIsFormModalOpen(false);
    };

    const handleSaveStudent = async (studentData: Student | Omit<Student, 'id' | 'status'>) => {
        if ('id' in studentData) {
            await updateStudent(studentData);
        } else {
            await addStudent(studentData);
        }
    };

    const handleDeleteStudent = () => {
        if (studentToDelete) {
            deleteStudent(studentToDelete.id);
            setStudentToDelete(null);
        }
    };
    
    const validateStudentImport = async (data: any[]) => {
        const classNameToIdMap = new Map(schoolClasses.map(c => [`${c.name}${c.section ? ` - ${c.section}` : ''}`.toLowerCase(), c.id]));
        const existingRollNos = new Set(students.filter(s => s.schoolId === effectiveSchoolId).map(s => s.rollNumber.trim().toLowerCase()));
        const rollNosInCsv = new Set<string>();

        const validRecords: any[] = [];
        const invalidRecords: { record: any, reason: string, rowNum: number }[] = [];

        data.forEach((item, index) => {
            const rowNum = index + 2;
            const classNameFromCsv = item.class_name || item.className;
            const className = String(classNameFromCsv || '').trim().toLowerCase();
            const classId = className ? classNameToIdMap.get(className) : undefined;
            const rollNumberFromCsv = item.roll_number || item.rollNumber;
            const rollNumber = String(rollNumberFromCsv || '').trim().toLowerCase();
    
            if (!classId) {
                invalidRecords.push({ record: item, reason: `Class "${classNameFromCsv}" not found.`, rowNum });
            } else if (!item.name || !rollNumberFromCsv) {
                invalidRecords.push({ record: item, reason: `Missing required field (name or roll_number).`, rowNum });
            } else if (existingRollNos.has(rollNumber)) {
                invalidRecords.push({ record: item, reason: `Duplicate roll number "${rollNumberFromCsv}" is already in use.`, rowNum });
            } else if (rollNosInCsv.has(rollNumber)) {
                invalidRecords.push({ record: item, reason: `Duplicate roll number "${rollNumberFromCsv}" within the CSV file.`, rowNum });
            } else {
                validRecords.push(item);
                if (rollNumber) rollNosInCsv.add(rollNumber);
            }
        });
        return { validRecords, invalidRecords };
    };

    const handleImportStudents = async (validData: any[], progressCallback: (progress: { processed: number; total: number; errors: string[] }) => void) => {
        if (!effectiveSchoolId) {
            throw new Error("No active school selected. Cannot import students.");
        }
    
        const hasTuitionFeeInCsv = validData.some(item => 
            (item.tuition_fee !== undefined && item.tuition_fee !== null && String(item.tuition_fee).trim() !== '') ||
            (item.tuitionFee !== undefined && item.tuitionFee !== null && String(item.tuitionFee).trim() !== '')
        );
        const schoolFeeHeads = feeHeads.filter(fh => fh.schoolId === effectiveSchoolId);
        const tuitionFeeHead = schoolFeeHeads.find(fh => fh.name.toLowerCase() === 'tuition fee');

        if (hasTuitionFeeInCsv && !tuitionFeeHead) {
            throw new Error("A 'Tuition Fee' head is required to import student-specific tuition fees. Please go to Fee Management > Fee Heads, create a fee head named 'Tuition Fee', and try importing again.");
        }
        
        const CHUNK_SIZE = 50;
        const classNameToIdMap = new Map(schoolClasses.map(c => [`${c.name}${c.section ? ` - ${c.section}` : ''}`.toLowerCase(), c.id]));
        
        let processed = 0;
    
        for (let i = 0; i < validData.length; i += CHUNK_SIZE) {
            const chunk = validData.slice(i, i + CHUNK_SIZE);
            const studentsToImport: Omit<Student, 'id' | 'status'>[] = [];
    
            chunk.forEach(item => {
                const classNameFromCsv = item.class_name || item.className;
                const classId = classNameToIdMap.get(String(classNameFromCsv || '').trim().toLowerCase());
                
                const parsedOpeningBalance = parseCurrency(item.opening_balance || item.openingBalance) ?? 0;

                const studentData: Omit<Student, 'id' | 'status'> & { feeStructure?: {feeHeadId: string, amount: number}[] } = {
                    name: item.name,
                    rollNumber: item.roll_number || item.rollNumber,
                    // FIX: Explicitly cast classId to string to resolve 'unknown' type error. The validation step ensures it's not undefined.
                    classId: classId as string,
                    schoolId: effectiveSchoolId!,
                    fatherName: item.father_name || item.fatherName,
                    fatherCnic: formatCnic(item.father_cnic || item.fatherCnic),
                    dateOfBirth: item.date_of_birth || item.dateOfBirth || null,
                    dateOfAdmission: item.date_of_admission || item.dateOfAdmission || null,
                    contactNumber: formatPhoneNumber(item.contact_number || item.contactNumber),
                    secondaryContactNumber: formatPhoneNumber(item.secondary_contact_number || item.secondaryContactNumber),
                    address: item.address || '',
                    gender: (item.gender === 'Female' || item.gender === 'female') ? 'Female' : 'Male',
                    admittedClass: (item.admitted_class || item.admittedClass) as string,
                    grNumber: item.gr_number || item.grNumber,
                    religion: item.religion,
                    caste: item.caste,
                    lastSchoolAttended: item.last_school_attended || item.lastSchoolAttended,
                    openingBalance: parsedOpeningBalance,
                    userId: item.user_id || item.userId || null,
                };
                
                const feeStructure: { feeHeadId: string; amount: number }[] = [];
                const tuitionFee = item.tuition_fee || item.tuitionFee;
                const parsedTuitionFee = parseCurrency(tuitionFee);

                schoolFeeHeads.forEach(head => {
                    let amountToApply: number | null = null;
                    if (tuitionFeeHead && head.id === tuitionFeeHead.id) {
                        if (parsedTuitionFee !== null && parsedTuitionFee >= 0) {
                            amountToApply = parsedTuitionFee;
                        } else if (head.defaultAmount > 0) {
                            amountToApply = head.defaultAmount;
                        }
                    } 
                    else if (head.defaultAmount > 0) {
                        amountToApply = head.defaultAmount;
                    }
                    if (amountToApply !== null) {
                        feeStructure.push({ feeHeadId: head.id, amount: amountToApply });
                    }
                });

                if (feeStructure.length > 0) {
                    studentData.feeStructure = feeStructure;
                }
                
                studentsToImport.push(studentData);
            });
    
            if (studentsToImport.length > 0) {
                await bulkAddStudents(studentsToImport);
            }

            processed += chunk.length;
            progressCallback({ processed, total: validData.length, errors: [] });
        }
    };


    const sampleDataForImport = [{
        name: "Kamran Ahmed",
        roll_number: "101",
        class_name: schoolClasses[0] ? `${schoolClasses[0].name}${schoolClasses[0].section ? ` - ${schoolClasses[0].section}` : ''}` : "Grade 5 - A",
        father_name: "Zulfiqar Ahmed",
        father_cnic: "35202-1234567-1",
        date_of_birth: "2010-05-15",
        date_of_admission: new Date().toISOString().split('T')[0],
        contact_number: "0300-1234567",
        secondary_contact_number: "0333-7654321",
        address: "123 School Lane, City",
        gender: "Male",
        admitted_class: schoolClasses[0] ? `${schoolClasses[0].name}${schoolClasses[0].section ? ` - ${schoolClasses[0].section}` : ''}` : "Grade 5 - A",
        gr_number: "GR-1234",
        religion: "Islam",
        caste: "Arain",
        last_school_attended: "Previous Public School",
        opening_balance: 0,
        user_id: "", // Optional: Link to a Parent user's ID
        tuition_fee: 5000, // Optional: Sets custom tuition fee. If not provided, school default is used.
    }];

    const requiredHeaders = ['name', 'roll_number', 'class_name', 'father_name', 'date_of_birth', 'contact_number', 'admitted_class'];

    const handleExport = () => {
        const dataToExport = filteredStudents.map(s => ({
            rollNumber: s.rollNumber,
            name: s.name,
            fatherName: s.fatherName,
            className_for_reference: classMap.get(s.classId) || 'N/A',
            status: s.status,
            balance: studentBalanceMap.get(s.id) || 0,
            classId: s.classId,
            fatherCnic: s.fatherCnic,
            dateOfBirth: s.dateOfBirth,
            dateOfAdmission: s.dateOfAdmission,
            contactNumber: s.contactNumber,
            secondaryContactNumber: s.secondaryContactNumber,
            address: s.address,
            gender: s.gender,
            admittedClass: s.admittedClass,
            grNumber: s.grNumber,
            religion: s.religion,
            caste: s.caste,
            lastSchoolAttended: s.lastSchoolAttended,
            openingBalance: s.openingBalance,
            userId: s.userId,
        }));
        exportToCsv(dataToExport, 'students_export');
    };
    
    const showingFrom = filteredStudents.length > 0 ? (currentPage - 1) * STUDENTS_PER_PAGE + 1 : 0;
    const showingTo = Math.min(currentPage * STUDENTS_PER_PAGE, filteredStudents.length);
    const skeletonColumns = [ { width: '35%' }, { width: '20%' }, { width: '10%' }, { width: '15%' }, { width: '20%' }];

    return (
        <>
            <StudentFormModal isOpen={isFormModalOpen} onClose={handleCloseModal} onSave={handleSaveStudent} studentToEdit={studentToEdit} />
            <ImportModal
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                onValidate={validateStudentImport}
                onImport={handleImportStudents}
                sampleData={sampleDataForImport}
                fileName="Students"
                requiredHeaders={requiredHeaders}
            />
            <Modal isOpen={!!studentToDelete} onClose={() => setStudentToDelete(null)} title="Confirm Student Deletion">
                <div>
                    <p className="text-sm text-secondary-600 dark:text-secondary-400">
                        Are you sure you want to delete <strong className="text-secondary-800 dark:text-secondary-200">{studentToDelete?.name}</strong>? Their record will be hidden from active lists but not permanently deleted.
                    </p>
                    <div className="mt-6 flex justify-end space-x-3">
                        <button type="button" onClick={() => setStudentToDelete(null)} className="btn-secondary">Cancel</button>
                        <button type="button" onClick={handleDeleteStudent} className="btn-danger">Delete Student</button>
                    </div>
                </div>
            </Modal>

            <div className="space-y-6">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                    <h1 className="text-3xl font-bold text-secondary-900 dark:text-white">Student Management</h1>
                    <div className="flex items-center gap-2">
                        {canEdit && (
                            <button onClick={() => setIsImportModalOpen(true)} className="btn-secondary">
                                <UploadIcon className="w-4 h-4" /> Import CSV
                            </button>
                        )}
                        <button onClick={handleExport} className="btn-secondary">
                            <DownloadIcon className="w-4 h-4" /> Export CSV
                        </button>
                        {canEdit && <button onClick={() => handleOpenModal()} className="btn-primary">+ Add Student</button>}
                    </div>
                </div>

                <div className="p-4 bg-white dark:bg-secondary-800 rounded-lg shadow-md">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <input type="text" placeholder="Search by name or roll number..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="input-field" />
                        <select value={classFilter} onChange={e => setClassFilter(e.target.value)} className="input-field">
                            <option value="all">All Classes</option>
                            {schoolClasses.map(c => <option key={c.id} value={c.id}>{`${c.name}${c.section ? ` - ${c.section}` : ''}`}</option>)}
                        </select>
                        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)} className="input-field">
                            <option value="all">All Statuses</option>
                            <option value="Active">Active</option>
                            <option value="Inactive">Inactive</option>
                            <option value="Left">Left</option>
                            <option value="Deleted">Deleted</option>
                        </select>
                        <select value={sortBy} onChange={e => setSortBy(e.target.value as any)} className="input-field">
                            <option value="rollNumber">Sort by ID</option>
                            <option value="name">Sort by Name</option>
                            <option value="class">Sort by Class</option>
                        </select>
                    </div>
                </div>

                <div className="bg-white dark:bg-secondary-800 rounded-lg shadow-md">
                    {loading ? (
                        <TableSkeleton columns={skeletonColumns} rows={STUDENTS_PER_PAGE} />
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left text-secondary-500 dark:text-secondary-400">
                                    <thead className="text-xs text-secondary-700 uppercase bg-secondary-50 dark:bg-secondary-700 dark:text-secondary-300">
                                        <tr>
                                            <th className="px-6 py-3">Student</th>
                                            <th className="px-6 py-3">Class</th>
                                            <th className="px-6 py-3">Status</th>
                                            <th className="px-6 py-3 text-right">Balance</th>
                                            <th className="px-6 py-3">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {paginatedStudents.map(student => {
                                            const balance = studentBalanceMap.get(student.id) || 0;
                                            return (
                                                <tr key={student.id} className="bg-white dark:bg-secondary-800 border-b dark:border-secondary-700 hover:bg-secondary-50 dark:hover:bg-secondary-700/50">
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center space-x-3">
                                                            <Avatar student={student} className="h-10 w-10" />
                                                            <div>
                                                                <button onClick={() => setActiveView({ view: 'studentProfile', payload: { studentId: student.id } })} className="font-semibold text-secondary-900 dark:text-white hover:underline text-left">
                                                                    {student.name}
                                                                </button>
                                                                <div className="text-xs text-secondary-500">
                                                                    <span className="font-bold text-primary-700 dark:text-primary-400">ID: {student.rollNumber}</span> | {student.fatherName}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">{classMap.get(student.classId) || 'N/A'}</td>
                                                    <td className="px-6 py-4"><Badge color={student.status === 'Active' ? 'green' : 'secondary'}>{student.status}</Badge></td>
                                                    <td className={`px-6 py-4 text-right font-semibold ${balance > 0 ? 'text-red-600 dark:text-red-400' : ''}`}>
                                                        Rs. {balance.toLocaleString()}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <div className="flex items-center space-x-4">
                                                            {canEdit && (
                                                                <button onClick={() => handleOpenModal(student)} className="font-medium text-primary-600 dark:text-primary-500 hover:underline">Edit</button>
                                                            )}
                                                            {canDelete && (
                                                                <button onClick={() => setStudentToDelete(student)} className="font-medium text-red-600 dark:text-red-500 hover:underline">Delete</button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            {filteredStudents.length > 0 && (
                                <div className="flex justify-between items-center p-4 border-t dark:border-secondary-700">
                                    <span className="text-sm text-secondary-700 dark:text-secondary-400">
                                        Showing {showingFrom} - {showingTo} of {filteredStudents.length} students
                                    </span>
                                    {totalPages > 1 && (
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
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </>
    );
};

export default StudentManagementPage;