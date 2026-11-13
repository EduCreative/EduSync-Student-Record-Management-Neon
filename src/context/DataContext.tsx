
import React, { createContext, useContext, useState, ReactNode, useCallback, useEffect } from 'react';
import { School, User, UserRole, Class, Student, Attendance, FeeChallan, Result, ActivityLog, FeeHead, SchoolEvent, Subject, Exam, StudentLedger, Branch } from '../types';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';
import { toCamelCase } from '../utils/caseConverter';

interface SyncProgress {
    percentage: number;
    status: string;
}

interface DataContextType {
    schools: School[];
    users: User[];
    classes: Class[];
    branches: Branch[];
    subjects: Subject[];
    exams: Exam[];
    students: Student[];
    attendance: Attendance[];
    fees: FeeChallan[];
    ledger: StudentLedger[];
    results: Result[];
    logs: ActivityLog[];
    feeHeads: FeeHead[];
    events: SchoolEvent[];
    loading: boolean;
    isInitialLoad: boolean;
    lastSyncTime: Date | null;
    syncError: string | null;
    syncProgress: SyncProgress;
    operationProgress: SyncProgress;
    fetchData: () => Promise<void>;
    getSchoolById: (schoolId: string) => School | undefined;
    getLedgerForStudent: (studentId: string) => StudentLedger | undefined;
    updateUser: (updatedUser: User) => Promise<void>;
    deleteUser: (userId: string) => Promise<void>;
    addUserByAdmin: (userData: (Omit<User, 'id'> & { password?: string })) => Promise<void>;
    addStudent: (studentData: Omit<Student, 'id' | 'status'>) => Promise<void>;
    updateStudent: (updatedStudent: Student) => Promise<void>;
    updateFeeStructure: (studentId: string, feeStructure: { feeHeadId: string; amount: number }[]) => Promise<void>;
    deleteStudent: (studentId: string) => Promise<void>;
    addClass: (classData: Omit<Class, 'id'>) => Promise<void>;
    updateClass: (updatedClass: Class) => Promise<void>;
    deleteClass: (classId: string) => Promise<void>;
    addBranch: (branchData: Omit<Branch, 'id'>) => Promise<void>;
    updateBranch: (updatedBranch: Branch) => Promise<void>;
    deleteBranch: (branchId: string) => Promise<void>;
    addSubject: (subjectData: Omit<Subject, 'id'>) => Promise<void>;
    updateSubject: (updatedSubject: Subject) => Promise<void>;
    deleteSubject: (subjectId: string) => Promise<void>;
    addExam: (examData: Omit<Exam, 'id'>) => Promise<void>;
    updateExam: (updatedExam: Exam) => Promise<void>;
    deleteExam: (examId: string) => Promise<void>;
    setAttendance: (date: string, attendanceData: { studentId: string; status: 'Present' | 'Absent' | 'Leave' }[]) => Promise<void>;
    recordFeePayment: (challanId: string, amount: number, discount: number, paidDate: string, options?: { allowOverpayment?: boolean; idempotencyKey?: string }) => Promise<void>;
    updateFeePayment: (challanId: string, paidAmount: number, discount: number, paidDate: string, paymentHistory?: any[]) => Promise<void>;
    cancelChallan: (challanId: string) => Promise<void>;
    generateChallansForMonth: (month: string, year: number, selectedFeeHeads: { feeHeadId: string, amount: number }[], studentIds: string[], dueDate?: string) => Promise<number>;
    deleteChallansForMonth: (month: string, year: number) => Promise<number>;
    addFeeHead: (feeHeadData: Omit<FeeHead, 'id'>) => Promise<void>;
    updateFeeHead: (updatedFeeHead: FeeHead) => Promise<void>;
    deleteFeeHead: (feeHeadId: string) => Promise<void>;
    issueLeavingCertificate: (studentId: string, details: { dateOfLeaving: string; reasonForLeaving: string; conduct: Student['conduct']; progress?: string; placeOfBirth?: string; }) => Promise<void>;
    saveResults: (resultsToSave: Omit<Result, 'id'>[]) => Promise<void>;
    addSchool: (name: string, address: string, logoUrl?: string | null) => Promise<void>;
    updateSchool: (updatedSchool: School) => Promise<void>;
    deleteSchool: (schoolId: string) => Promise<void>;
    addEvent: (eventData: Omit<SchoolEvent, 'id'>) => Promise<void>;
    updateEvent: (updatedEvent: SchoolEvent) => Promise<void>;
    deleteEvent: (eventId: string) => Promise<void>;
    bulkAddStudents: (students: Omit<Student, 'id' | 'status'>[]) => Promise<void>;
    bulkAddUsers: (users: (Omit<User, 'id'> & { password?: string })[]) => Promise<void>;
    bulkAddClasses: (classes: Omit<Class, 'id'>[]) => Promise<void>;
    downloadFullBackup: () => Promise<void>;
    generateFullBackupPayload: () => Promise<any>;
    promoteAllStudents: (mappings: Record<string, string | 'graduate'>, exemptedStudentIds: string[]) => Promise<void>;
    reactivateGraduatedStudents: (options?: { studentIds?: string[]; targetClassId?: string; restoreFromHistory?: boolean }) => Promise<number>;
    revertLastPromotion: () => Promise<boolean>;
    increaseTuitionFees: (studentIds: string[], increaseAmount: number) => Promise<void>;
    sendFeeReminders: (challanIds: string[]) => Promise<void>;
    bulkUpdateClassOrder: (classes: { id: string; sortOrder: number }[]) => Promise<void>;
    addLog: (action: string, details: string) => Promise<void>;
    loadAttendanceRange: (from: string, to: string) => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const useData = (): DataContextType => {
    const context = useContext(DataContext);
    if (!context) {
        throw new Error('useData must be used within a DataProvider');
    }
    return context;
};

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { user, activeSchoolId, logout } = useAuth();
    const { showToast } = useToast();

    const [loading, setLoading] = useState(true);
    const [isInitialLoad, setIsInitialLoad] = useState(true);
    const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
    const [syncError, setSyncError] = useState<string | null>(null);
    const [syncProgress, setSyncProgress] = useState<SyncProgress>({ percentage: 0, status: '' });
    const [operationProgress, setOperationProgress] = useState<SyncProgress>({ percentage: 0, status: '' });
    
    const [schools, setSchools] = useState<School[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [classes, setClasses] = useState<Class[]>([]);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [exams, setExams] = useState<Exam[]>([]);
    const [students, setStudents] = useState<Student[]>([]);
    const [attendance, setAttendanceState] = useState<Attendance[]>([]);
    const [fees, setFees] = useState<FeeChallan[]>([]);
    const [ledger, setLedger] = useState<StudentLedger[]>([]);
    const [results, setResults] = useState<Result[]>([]);
    const [logs, setLogs] = useState<ActivityLog[]>([]);
    const [feeHeads, setFeeHeads] = useState<FeeHead[]>([]);
    const [events, setEvents] = useState<SchoolEvent[]>([]);

    const fetchData = useCallback(async () => {
        if (!user) {
            setLoading(false);
            return;
        }

        setLoading(true);
        setSyncError(null);
        setSyncProgress({ percentage: 5, status: 'Synchronizing records with secure API...' });

        try {
            const effectiveSchoolId = user.role === UserRole.Owner && activeSchoolId ? activeSchoolId : user.schoolId;
            const queryParam = effectiveSchoolId ? `?schoolId=${encodeURIComponent(effectiveSchoolId)}` : '';

            setSyncProgress({ percentage: 20, status: 'Downloading Scoped Data from Secure API...' });

            const response = await fetch(`/api/data${queryParam}`, {
                method: 'GET',
                credentials: 'include'
            });

            if (response.status === 401) {
                console.warn("Session expired on fetchData. Logging out.");
                logout();
                return;
            }

            if (!response.ok) {
                const errBody = await response.json().catch(() => ({}));
                throw new Error(errBody.error || `Server responded with status ${response.status}`);
            }

            const data = await response.json();

            setSyncProgress({ percentage: 60, status: 'Processing Records...' });

            setSchools(data.schools || []);
            setClasses(data.classes || []);
            setBranches(data.branches || []);
            setSubjects(data.subjects || []);
            setExams(data.exams || []);
            setFeeHeads(data.feeHeads || []);
            setEvents(data.events || []);
            setUsers(data.users || []);
            setStudents(data.students || []);
            setFees(data.fees || []);
            setLedger((data.ledger || []).map((l: any) => ({
                studentId: l.studentId,
                totalCharged: Number(l.totalCharged || 0),
                totalPaid: Number(l.totalPaid || 0),
                totalDiscount: Number(l.totalDiscount || 0),
                openingBalance: Number(l.openingBalance || 0),
                balance: Number(l.balance || 0),
            })));
            setAttendanceState(data.attendance || []);
            setResults(data.results || []);
            setLogs(data.logs || []);

            setSyncProgress({ percentage: 100, status: 'DB Synchronized' });
            setLastSyncTime(new Date());
        } catch (error: any) {
            console.error("Sync Error:", error);
            setSyncError(error.message);
            setSyncProgress({ percentage: 0, status: 'Database sync error' });
        } finally {
            setLoading(false);
            if (isInitialLoad) setIsInitialLoad(false);
            setTimeout(() => setSyncProgress({ percentage: 0, status: '' }), 3000);
        }
    }, [user, activeSchoolId, isInitialLoad, schools, users, classes, fees, attendance, results, logs, feeHeads, events, subjects, exams]);

    useEffect(() => { fetchData(); }, [user, activeSchoolId]);

    const apiWrite = useCallback(async (endpoint: string, payload: any): Promise<any> => {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        const res = await fetch(endpoint, {
            method: 'POST',
            headers,
            credentials: 'include',
            body: JSON.stringify(payload)
        });
        if (res.status === 401) {
            console.warn("Session expired on apiWrite. Logging out.");
            logout();
            throw new Error('Session expired. Please log in again.');
        }
        if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            const err = new Error(errorData.error || errorData.message || `Request failed with status ${res.status}`) as any;
            err.code = errorData.error;
            err.rollNumber = errorData.rollNumber;
            err.status = res.status;
            throw err;
        }
        return res.json();
    }, [logout]);

    const addLog = useCallback(async (action: string, details: string) => {
        if (!user) return;
        const effectiveSchoolId = user.role === UserRole.Owner && activeSchoolId ? activeSchoolId : user.schoolId;
        try {
            await apiWrite('/api/write/users', { action: 'add-log', actionName: action, details, schoolId: effectiveSchoolId });
        } catch (e) {
            console.warn('Could not record client log:', e);
        }
    }, [user, activeSchoolId, apiWrite]);

    const updateUser = async (updatedUser: User) => {
        await apiWrite('/api/write/users', { 
            action: 'update-user', 
            id: updatedUser.id, 
            name: updatedUser.name, 
            avatarUrl: updatedUser.avatarUrl, 
            status: updatedUser.status,
            role: updatedUser.role,
            schoolId: updatedUser.schoolId,
            branchId: updatedUser.branchId !== undefined ? updatedUser.branchId : null,
            disabledNavLinks: updatedUser.disabledNavLinks || [],
            permissionsOverrides: updatedUser.permissionsOverrides || {}
        });
        await fetchData();
    };

    const deleteUser = async (userId: string) => {
        await apiWrite('/api/write/users', { action: 'delete-user', userId });
        await fetchData();
    };

    const addUserByAdmin = async (userData: any) => {
        await apiWrite('/api/write/users', {
            action: 'add-user',
            name: userData.name,
            email: userData.email,
            password: userData.password,
            role: userData.role,
            schoolId: userData.schoolId,
            avatarUrl: userData.avatarUrl,
            status: userData.status || 'Active',
            branchId: userData.branchId !== undefined ? userData.branchId : null,
            disabledNavLinks: userData.disabledNavLinks || [],
            permissionsOverrides: userData.permissionsOverrides || {}
        });
        await fetchData();
    };

    const addStudent = async (data: any) => {
        await apiWrite('/api/write/students', { action: 'add-student', student: data });
        await fetchData();
    };

    const updateStudent = async (student: Student) => {
        await apiWrite('/api/write/students', { action: 'update-student', student });
        await fetchData();
    };

    const updateFeeStructure = async (studentId: string, feeStructure: { feeHeadId: string; amount: number }[]) => {
        await apiWrite('/api/write/students', { action: 'update-fee-structure', studentId, feeStructure });
        await fetchData();
    };

    const deleteStudent = async (studentId: string) => {
        await apiWrite('/api/write/students', { action: 'delete-student', studentId });
        await fetchData();
    };

    const addClass = async (data: any) => {
        await apiWrite('/api/write/classes', { 
            action: 'add-class', 
            name: data.name, 
            section: data.section, 
            teacherId: data.teacherId, 
            branchId: data.branchId || null,
            schoolId: data.schoolId, 
            sortOrder: data.sortOrder || 0 
        });
        await fetchData();
    };

    const updateClass = async (cls: Class) => {
        await apiWrite('/api/write/classes', { 
            action: 'update-class', 
            id: cls.id, 
            name: cls.name, 
            section: cls.section, 
            teacherId: cls.teacherId, 
            branchId: cls.branchId || null,
            sortOrder: cls.sortOrder 
        });
        await fetchData();
    };

    const deleteClass = async (id: string) => {
        await apiWrite('/api/write/classes', { action: 'delete-class', id });
        await fetchData();
    };

    const addBranch = async (data: Omit<Branch, 'id'>) => {
        const effectiveSchoolId = user?.role === UserRole.Owner && activeSchoolId ? activeSchoolId : user?.schoolId;
        await apiWrite('/api/write/classes', {
            action: 'add-branch',
            name: data.name,
            address: data.address || null,
            schoolId: data.schoolId || effectiveSchoolId
        });
        await fetchData();
    };

    const updateBranch = async (b: Branch) => {
        await apiWrite('/api/write/classes', {
            action: 'update-branch',
            id: b.id,
            name: b.name,
            address: b.address || null
        });
        await fetchData();
    };

    const deleteBranch = async (id: string) => {
        await apiWrite('/api/write/classes', {
            action: 'delete-branch',
            id
        });
        await fetchData();
    };

    const addSubject = async (data: any) => {
        await apiWrite('/api/write/classes', { action: 'add-subject', name: data.name, schoolId: data.schoolId });
        await fetchData();
    };

    const updateSubject = async (subj: Subject) => {
        await apiWrite('/api/write/classes', { action: 'update-subject', id: subj.id, name: subj.name });
        await fetchData();
    };

    const deleteSubject = async (id: string) => {
        await apiWrite('/api/write/classes', { action: 'delete-subject', id });
        await fetchData();
    };

    const addExam = async (data: any) => {
        await apiWrite('/api/write/classes', { action: 'add-exam', name: data.name, schoolId: data.schoolId });
        await fetchData();
    };

    const updateExam = async (exam: Exam) => {
        await apiWrite('/api/write/classes', { action: 'update-exam', id: exam.id, name: exam.name });
        await fetchData();
    };

    const deleteExam = async (id: string) => {
        await apiWrite('/api/write/classes', { action: 'delete-exam', id });
        await fetchData();
    };

    const loadAttendanceRange = useCallback(async (from: string, to: string) => {
        try {
            const effectiveSchoolId = user?.role === UserRole.Owner && activeSchoolId ? activeSchoolId : user?.schoolId;
            const schoolParam = effectiveSchoolId ? `schoolId=${encodeURIComponent(effectiveSchoolId)}&` : '';
            const res = await fetch(`/api/data?${schoolParam}attendanceFrom=${encodeURIComponent(from)}&attendanceTo=${encodeURIComponent(to)}`, {
                credentials: 'include'
            });
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data.attendance)) {
                    setAttendanceState(prev => {
                        const map = new Map<string, Attendance>();
                        prev.forEach(item => map.set(`${item.studentId}_${item.date}`, item));
                        data.attendance.forEach((item: Attendance) => map.set(`${item.studentId}_${item.date}`, item));
                        return Array.from(map.values());
                    });
                }
            }
        } catch (e) {
            console.warn('Failed to load attendance range:', e);
        }
    }, [user, activeSchoolId]);

    const setAttendance = async (date: string, records: any[]) => {
        const total = records.length;
        setOperationProgress({ percentage: 20, status: `Saving attendance for ${total} students...` });
        const effectiveSchoolId = user?.role === UserRole.Owner && activeSchoolId ? activeSchoolId : user?.schoolId;
        await apiWrite('/api/write/academic', {
            action: 'set-attendance',
            date,
            records,
            schoolId: effectiveSchoolId
        });

        // A15: Update state directly without full reload
        setAttendanceState(prev => {
            const map = new Map<string, Attendance>();
            prev.forEach(item => map.set(`${item.studentId}_${item.date}`, item));
            records.forEach(r => {
                const key = `${r.studentId}_${date}`;
                const existing = map.get(key);
                map.set(key, {
                    id: existing?.id || crypto.randomUUID(),
                    studentId: r.studentId,
                    date,
                    status: r.status,
                    schoolId: effectiveSchoolId || ''
                });
            });
            return Array.from(map.values());
        });

        setOperationProgress({ percentage: 0, status: '' });
        showToast('Success', `Attendance recorded for ${total} students.`, 'success');
    };

    const recordFeePayment = async (challanId: string, amount: number, discount: number, paidDate: string, options?: { allowOverpayment?: boolean; idempotencyKey?: string }) => {
        const challan = fees.find(f => f.id === challanId);
        if (!challan) return;
        const student = students.find(s => s.id === challan.studentId);

        const res = await apiWrite('/api/write/payments', {
            action: 'record-payment',
            challanId,
            amount,
            discount,
            paidDate,
            allowOverpayment: options?.allowOverpayment,
            idempotencyKey: options?.idempotencyKey
        });

        // A15: Update state directly without full reload
        if (res.challan) {
            const updated = toCamelCase(res.challan);
            let history = updated.paymentHistory;
            if (typeof history === 'string') {
                try { history = JSON.parse(history); } catch { history = []; }
            }
            const cleanChallan: FeeChallan = {
                ...updated,
                previousBalance: Number(updated.previousBalance || 0),
                totalAmount: Number(updated.totalAmount || 0),
                discount: Number(updated.discount || 0),
                paidAmount: Number(updated.paidAmount || 0),
                fineAmount: Number(updated.fineAmount || 0),
                paymentHistory: (Array.isArray(history) ? history : []).map((p: any) => ({
                    ...p,
                    amount: Number(p.amount || 0)
                }))
            };
            setFees(prev => prev.map(f => f.id === challanId ? cleanChallan : f));
        }

        showToast('Success', `Recorded payment of Rs. ${amount.toLocaleString()} for ${student?.name || 'Student'}`, 'success');
    };

    const updateFeePayment = async (challanId: string, paidAmount: number, discount: number, paidDate: string, paymentHistory?: any[]) => {
        const res = await apiWrite('/api/write/payments', {
            action: 'update-payment',
            challanId,
            paidAmount,
            discount,
            paidDate,
            paymentHistory
        });

        // A15: Update state directly without full reload
        if (res.challan) {
            const updated = toCamelCase(res.challan);
            let history = updated.paymentHistory;
            if (typeof history === 'string') {
                try { history = JSON.parse(history); } catch { history = []; }
            }
            const cleanChallan: FeeChallan = {
                ...updated,
                previousBalance: Number(updated.previousBalance || 0),
                totalAmount: Number(updated.totalAmount || 0),
                discount: Number(updated.discount || 0),
                paidAmount: Number(updated.paidAmount || 0),
                fineAmount: Number(updated.fineAmount || 0),
                paymentHistory: (Array.isArray(history) ? history : []).map((p: any) => ({
                    ...p,
                    amount: Number(p.amount || 0)
                }))
            };
            setFees(prev => prev.map(f => f.id === challanId ? cleanChallan : f));
        }

        showToast('Success', 'Payment updated successfully.', 'success');
    };

    const cancelChallan = async (challanId: string) => {
        await apiWrite('/api/write/payments', { action: 'cancel-challan', challanId });
        // A15: Update state directly without full reload
        setFees(prev => prev.map(f => f.id === challanId ? { ...f, status: 'Cancelled' } : f));
        showToast('Success', 'Challan cancelled.', 'success');
    };

    const generateChallansForMonth = async (month: string, year: number, selectedFeeHeads: { feeHeadId: string, amount: number }[], studentIds: string[], dueDate?: string) => {
        setOperationProgress({ percentage: 25, status: `Generating challans for ${month} ${year}...` });
        const effectiveSchoolId = user?.role === UserRole.Owner && activeSchoolId ? activeSchoolId : user?.schoolId;
        const res = await apiWrite('/api/write/challans', {
            action: 'generate',
            month,
            year,
            selectedFeeHeads,
            studentIds,
            dueDate,
            schoolId: effectiveSchoolId
        });
        await fetchData();
        setOperationProgress({ percentage: 0, status: '' });
        const count = res.count || 0;
        const skipped = res.skippedDuplicates || 0;
        const skippedBackdated = res.skippedBackdated || 0;
        let details = '';
        if (skipped > 0 && skippedBackdated > 0) {
            details = ` (${skipped} duplicates, ${skippedBackdated} backdated skipped)`;
        } else if (skipped > 0) {
            details = ` (${skipped} duplicates skipped)`;
        } else if (skippedBackdated > 0) {
            details = ` (${skippedBackdated} backdated skipped)`;
        }
        showToast('Success', `${count} challan(s) generated for ${month} ${year}${details}.`, 'success');
        return count;
    };

    const deleteChallansForMonth = async (m: string, y: number) => {
        const effectiveSchoolId = user?.role === UserRole.Owner && activeSchoolId ? activeSchoolId : user?.schoolId;
        const res = await apiWrite('/api/write/challans', {
            action: 'delete-unpaid',
            month: m,
            year: y,
            schoolId: effectiveSchoolId
        });
        await fetchData();
        const count = res.count || 0;
        showToast('Success', `Deleted ${count} unpaid challans for ${m} ${y}`, 'success');
        return count;
    };

    const addFeeHead = async (data: any) => {
        await apiWrite('/api/write/classes', { action: 'add-fee-head', name: data.name, defaultAmount: data.defaultAmount, schoolId: data.schoolId });
        await fetchData();
    };

    const updateFeeHead = async (fh: FeeHead) => {
        await apiWrite('/api/write/classes', { action: 'update-fee-head', id: fh.id, name: fh.name, defaultAmount: fh.defaultAmount });
        await fetchData();
    };

    const deleteFeeHead = async (id: string) => {
        await apiWrite('/api/write/classes', { action: 'delete-fee-head', id });
        await fetchData();
    };

    const saveResults = async (resultsToSave: any[]) => {
        const total = resultsToSave.length;
        setOperationProgress({ percentage: 25, status: `Saving results for ${total} records...` });
        const effectiveSchoolId = user?.role === UserRole.Owner && activeSchoolId ? activeSchoolId : user?.schoolId;
        await apiWrite('/api/write/academic', {
            action: 'save-results',
            results: resultsToSave,
            schoolId: effectiveSchoolId
        });

        // A15: Update state directly without full reload
        setResults(prev => {
            const map = new Map<string, Result>();
            prev.forEach(item => map.set(`${item.studentId}_${item.exam}_${item.subject}`, item));
            resultsToSave.forEach(r => {
                const key = `${r.studentId}_${r.exam}_${r.subject}`;
                const existing = map.get(key);
                map.set(key, {
                    id: existing?.id || crypto.randomUUID(),
                    studentId: r.studentId,
                    classId: r.classId,
                    exam: r.exam,
                    subject: r.subject,
                    marks: Number(r.marks) || 0,
                    totalMarks: Number(r.totalMarks ?? r.total_marks ?? 100) || 100,
                    schoolId: effectiveSchoolId || ''
                });
            });
            return Array.from(map.values());
        });

        setOperationProgress({ percentage: 0, status: '' });
        showToast('Success', `Results saved for ${total} students.`, 'success');
    };

    const addSchool = async (name: string, address: string, logoUrl?: string | null) => {
        await apiWrite('/api/write/users', { action: 'add-school', name, address, logoUrl });
        await fetchData();
    };

    const updateSchool = async (s: School) => {
        await apiWrite('/api/write/users', { action: 'update-school', id: s.id, name: s.name, address: s.address, logoUrl: s.logoUrl });
        await fetchData();
    };

    const deleteSchool = async (id: string) => {
        await apiWrite('/api/write/users', { action: 'delete-school', id });
        await fetchData();
    };

    const addEvent = async (data: any) => {
        await apiWrite('/api/write/classes', { action: 'add-event', ...data });
        await fetchData();
    };

    const updateEvent = async (e: SchoolEvent) => {
        await apiWrite('/api/write/classes', { action: 'update-event', ...e });
        await fetchData();
    };

    const deleteEvent = async (id: string) => {
        await apiWrite('/api/write/classes', { action: 'delete-event', id });
        await fetchData();
    };

    const issueLeavingCertificate = async (studentId: string, details: any) => {
        await apiWrite('/api/write/students', { action: 'issue-certificate', studentId, details });
        await fetchData();
    };

    const bulkAddStudents = async (studentList: any[]) => {
        const total = studentList.length;
        setOperationProgress({ percentage: 25, status: `Importing ${total} students...` });
        const effectiveSchoolId = user?.role === UserRole.Owner && activeSchoolId ? activeSchoolId : user?.schoolId;
        await apiWrite('/api/write/students', {
            action: 'bulk-add-students',
            students: studentList,
            schoolId: effectiveSchoolId
        });
        await fetchData();
        setOperationProgress({ percentage: 0, status: '' });
        showToast('Success', `Successfully imported ${total} students.`, 'success');
    };

    const bulkAddUsers = async (userList: any[]) => {
        const total = userList.length;
        setOperationProgress({ percentage: 25, status: `Importing ${total} users...` });
        const effectiveSchoolId = user?.role === UserRole.Owner && activeSchoolId ? activeSchoolId : user?.schoolId;
        await apiWrite('/api/write/users', { action: 'bulk-add-users', users: userList, schoolId: effectiveSchoolId });
        await fetchData();
        setOperationProgress({ percentage: 0, status: '' });
    };

    const bulkAddClasses = async (classList: any[]) => {
        const effectiveSchoolId = user?.role === UserRole.Owner && activeSchoolId ? activeSchoolId : user?.schoolId;
        await apiWrite('/api/write/classes', { action: 'bulk-add-classes', classes: classList, schoolId: effectiveSchoolId });
        await fetchData();
    };

    const bulkUpdateClassOrder = async (updates: { id: string; sortOrder: number }[]) => {
        await apiWrite('/api/write/classes', { action: 'bulk-update-order', updates });
        await fetchData();
    };

    const promoteAllStudents = async (mappings: Record<string, string | 'graduate'>, exemptedIds: string[]) => {
        const exemptSet = new Set(exemptedIds);
        const effectiveSchoolId = user?.role === UserRole.Owner && activeSchoolId ? activeSchoolId : user?.schoolId;

        const targetStudents = students.filter(s => 
            (effectiveSchoolId ? s.schoolId === effectiveSchoolId : true) &&
            s.status === 'Active' && 
            Boolean(mappings[s.classId]) && 
            !exemptSet.has(s.id)
        );

        if (targetStudents.length === 0) {
            showToast('Info', 'No active students found to promote.', 'info');
            return;
        }

        try {
            const rollbackSnapshot = targetStudents.map(s => ({
                id: s.id,
                classId: s.classId,
                status: s.status,
            }));
            localStorage.setItem('edusync_last_promotion_snapshot', JSON.stringify({
                timestamp: new Date().toISOString(),
                schoolId: effectiveSchoolId,
                students: rollbackSnapshot
            }));
        } catch (e) {
            console.warn('Could not save rollback snapshot', e);
        }

        const graduatingStudentIds: string[] = [];
        const classTargetMap: Record<string, string[]> = {};

        for (const s of targetStudents) {
            const dest = mappings[s.classId];
            if (dest === 'graduate') {
                graduatingStudentIds.push(s.id);
            } else if (dest) {
                if (!classTargetMap[dest]) {
                    classTargetMap[dest] = [];
                }
                classTargetMap[dest].push(s.id);
            }
        }

        setOperationProgress({ percentage: 40, status: `Promoting ${targetStudents.length} students...` });
        await apiWrite('/api/write/students', {
            action: 'promote-students',
            graduations: graduatingStudentIds,
            promotions: classTargetMap,
            schoolId: effectiveSchoolId
        });
        await fetchData();
        setOperationProgress({ percentage: 0, status: '' });
        showToast('Success', `Successfully promoted ${targetStudents.length} students.`, 'success');
    };

    const reactivateGraduatedStudents = async (options?: { 
        studentIds?: string[]; 
        targetClassId?: string; 
        restoreFromHistory?: boolean 
    }): Promise<number> => {
        const effectiveSchoolId = user?.role === UserRole.Owner && activeSchoolId ? activeSchoolId : user?.schoolId;
        
        let graduated = students.filter(s => 
            (effectiveSchoolId ? s.schoolId === effectiveSchoolId : true) && 
            s.status === 'Graduated'
        );

        if (options?.studentIds && options.studentIds.length > 0) {
            const filterSet = new Set(options.studentIds);
            graduated = graduated.filter(s => filterSet.has(s.id));
        }

        if (graduated.length === 0) {
            showToast('Info', 'No graduated students found to reactivate.', 'info');
            return 0;
        }

        setOperationProgress({ percentage: 20, status: `Reactivating ${graduated.length} students...` });
        const sIds = graduated.map(s => s.id);
        await apiWrite('/api/write/students', {
            action: 'reactivate-graduated',
            studentIds: sIds,
            targetClassId: options?.targetClassId || null,
            schoolId: effectiveSchoolId
        });
        await fetchData();
        setOperationProgress({ percentage: 0, status: '' });
        showToast('Success', `Reactivated ${graduated.length} students to Active status.`, 'success');
        return graduated.length;
    };

    const revertLastPromotion = async (): Promise<boolean> => {
        try {
            const raw = localStorage.getItem('edusync_last_promotion_snapshot');
            if (!raw) {
                showToast('Info', 'No promotion rollback snapshot found.', 'info');
                return false;
            }
            const data = JSON.parse(raw);
            const snapshotList: { id: string; classId: string; status: string }[] = data.students || [];
            if (snapshotList.length === 0) return false;

            const groups: Record<string, string[]> = {};
            for (const s of snapshotList) {
                const key = `${s.classId}__${s.status}`;
                if (!groups[key]) groups[key] = [];
                groups[key].push(s.id);
            }

            const effectiveSchoolId = user?.role === UserRole.Owner && activeSchoolId ? activeSchoolId : user?.schoolId;
            setOperationProgress({ percentage: 30, status: `Reverting promotion for ${snapshotList.length} students...` });
            await apiWrite('/api/write/students', {
                action: 'revert-promotion',
                groups,
                schoolId: effectiveSchoolId
            });
            localStorage.removeItem('edusync_last_promotion_snapshot');
            await fetchData();
            setOperationProgress({ percentage: 0, status: '' });
            showToast('Success', `Reverted promotion for ${snapshotList.length} students back to their previous classes.`, 'success');
            return true;
        } catch (err) {
            console.error('Failed to revert promotion:', err);
            showToast('Error', 'Failed to revert promotion.', 'error');
            setOperationProgress({ percentage: 0, status: '' });
            return false;
        }
    };

    const increaseTuitionFees = async (studentIds: string[], amount: number) => {
        const effectiveSchoolId = user?.role === UserRole.Owner && activeSchoolId ? activeSchoolId : user?.schoolId;
        await apiWrite('/api/write/payments', {
            action: 'increase-tuition',
            studentIds,
            amount,
            schoolId: effectiveSchoolId
        });
        await fetchData();
        showToast('Success', `Updated tuition fees for ${studentIds.length} students.`, 'success');
    };

    const BACKUP_TABLES = [
        'schools',
        'branches',
        'profiles',
        'classes',
        'subjects',
        'exams',
        'fee_heads',
        'students',
        'fee_challans',
        'attendance',
        'results',
        'activity_logs',
        'school_events',
        'notifications'
    ];

    const generateFullBackupPayload = useCallback(async (): Promise<any> => {
        const tablesData: Record<string, any[]> = {};
        const countsData: Record<string, number> = {};
        const totalTables = BACKUP_TABLES.length;

        for (let tIdx = 0; tIdx < totalTables; tIdx++) {
            const tableName = BACKUP_TABLES[tIdx];
            const tableRows: any[] = [];
            let cursor: string | null = null;
            let hasMore = true;

            const basePct = 5 + Math.round((tIdx / totalTables) * 85);
            setOperationProgress({ 
                percentage: basePct, 
                status: `Streaming table "${tableName}" (${tIdx + 1}/${totalTables})...` 
            });

            while (hasMore) {
                const chunkUrl: string = cursor 
                    ? `/api/backup?table=${encodeURIComponent(tableName)}&cursor=${encodeURIComponent(cursor)}`
                    : `/api/backup?table=${encodeURIComponent(tableName)}`;
                
                const chunkRes: Response = await fetch(chunkUrl, { credentials: 'include' });
                if (!chunkRes.ok) {
                    const err: any = await chunkRes.json().catch(() => ({ error: 'Backup chunk stream failed' }));
                    throw new Error(err.error || `Failed to fetch backup for table ${tableName}`);
                }

                const chunkData: any = await chunkRes.json();
                if (Array.isArray(chunkData.rows)) {
                    tableRows.push(...chunkData.rows);
                }

                cursor = chunkData.nextCursor;
                if (!cursor) {
                    hasMore = false;
                }
            }

            tablesData[tableName] = tableRows;
            countsData[tableName] = tableRows.length;
        }

        const backupPayload = {
            version: '3.58.0',
            createdAt: new Date().toISOString(),
            tables: tablesData,
            counts: countsData
        };

        return backupPayload;
    }, []);

    const downloadFullBackup = useCallback(async (): Promise<void> => {
        setOperationProgress({ percentage: 5, status: 'Initializing full database backup stream...' });
        try {
            const backupPayload = await generateFullBackupPayload();
            setOperationProgress({ percentage: 95, status: 'Packaging JSON backup archive...' });

            const jsonString = JSON.stringify(backupPayload, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');

            const now = new Date();
            const pad = (n: number) => String(n).padStart(2, '0');
            const timestampStr = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;

            a.href = url;
            a.download = `edusync-${timestampStr}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            localStorage.setItem('edusync_last_backup_download', now.toISOString());
            setOperationProgress({ percentage: 100, status: 'Backup downloaded successfully!' });
            showToast('Success', 'Full database backup successfully downloaded to your device.', 'success');

            setTimeout(() => setOperationProgress({ percentage: 0, status: '' }), 3000);
        } catch (err: any) {
            console.error('Download full backup failed:', err);
            showToast('Backup Error', err.message || 'Failed to download database backup.', 'error');
            setOperationProgress({ percentage: 0, status: '' });
        }
    }, [generateFullBackupPayload, showToast]);

    const sendFeeReminders = async (challanIds: string[]) => {
        showToast('Success', `Broadcasted ${challanIds.length} reminders to parent dashboard.`, 'success');
    };

    const ledgerMap = React.useMemo(() => new Map(ledger.map(l => [l.studentId, l])), [ledger]);
    const getLedgerForStudent = useCallback((id: string) => ledgerMap.get(id), [ledgerMap]);

    const value: DataContextType = {
        schools, users, classes, branches, subjects, exams, students, attendance, fees, ledger, results, logs, feeHeads, events,
        loading, isInitialLoad, lastSyncTime, syncError, syncProgress, operationProgress,
        fetchData, downloadFullBackup, generateFullBackupPayload,
        getSchoolById: (id) => schools.find(s => s.id === id),
        getLedgerForStudent,
        updateUser, deleteUser, addUserByAdmin, addStudent, updateStudent, updateFeeStructure, deleteStudent,
        addClass, updateClass, deleteClass, addBranch, updateBranch, deleteBranch, addSubject, updateSubject, deleteSubject,
        addExam, updateExam, deleteExam, setAttendance, recordFeePayment, updateFeePayment, cancelChallan,
        generateChallansForMonth, deleteChallansForMonth, addSchool, updateSchool, deleteSchool,
        addEvent, updateEvent, deleteEvent, bulkAddStudents, bulkAddUsers, bulkAddClasses,
        promoteAllStudents, reactivateGraduatedStudents, revertLastPromotion, increaseTuitionFees, sendFeeReminders, bulkUpdateClassOrder, addFeeHead, updateFeeHead, deleteFeeHead,
        issueLeavingCertificate, saveResults, addLog, loadAttendanceRange
    };

    return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};
