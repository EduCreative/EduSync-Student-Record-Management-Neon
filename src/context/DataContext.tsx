
import React, { createContext, useContext, useState, ReactNode, useCallback, useEffect, useRef } from 'react';
import { School, User, UserRole, Class, Student, Attendance, FeeChallan, Result, ActivityLog, FeeHead, SchoolEvent, Subject, Exam } from '../types';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';
import { driveService } from '../utils/googleDriveService';

interface SyncProgress {
    percentage: number;
    status: string;
}

interface AutoBackupSettings {
    enabled: boolean;
    frequency: 'weekly' | 'monthly';
    lastBackup: string | null;
    lastBackupSize: string | null;
    includePhotos: boolean;
}

interface DataContextType {
    schools: School[];
    users: User[];
    classes: Class[];
    subjects: Subject[];
    exams: Exam[];
    students: Student[];
    attendance: Attendance[];
    fees: FeeChallan[];
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
    autoBackupSettings: AutoBackupSettings;
    updateAutoBackupSettings: (settings: Partial<AutoBackupSettings>) => void;
    fetchData: () => Promise<void>;
    getSchoolById: (schoolId: string) => School | undefined;
    updateUser: (updatedUser: User) => Promise<void>;
    deleteUser: (userId: string) => Promise<void>;
    addUserByAdmin: (userData: (Omit<User, 'id'> & { password?: string })) => Promise<void>;
    addStudent: (studentData: Omit<Student, 'id' | 'status'>) => Promise<void>;
    updateStudent: (updatedStudent: Student) => Promise<void>;
    deleteStudent: (studentId: string) => Promise<void>;
    addClass: (classData: Omit<Class, 'id'>) => Promise<void>;
    updateClass: (updatedClass: Class) => Promise<void>;
    deleteClass: (classId: string) => Promise<void>;
    addSubject: (subjectData: Omit<Subject, 'id'>) => Promise<void>;
    updateSubject: (updatedSubject: Subject) => Promise<void>;
    deleteSubject: (subjectId: string) => Promise<void>;
    addExam: (examData: Omit<Exam, 'id'>) => Promise<void>;
    updateExam: (updatedExam: Exam) => Promise<void>;
    deleteExam: (examId: string) => Promise<void>;
    setAttendance: (date: string, attendanceData: { studentId: string; status: 'Present' | 'Absent' | 'Leave' }[]) => Promise<void>;
    recordFeePayment: (challanId: string, amount: number, discount: number, paidDate: string) => Promise<void>;
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
    backupData: () => Promise<void>;
    backupToDrive: (silent?: boolean) => Promise<void>;
    restoreData: (backupFile: File) => Promise<void>;
    promoteAllStudents: (mappings: Record<string, string | 'graduate'>, exemptedStudentIds: string[]) => Promise<void>;
    reactivateGraduatedStudents: (options?: { studentIds?: string[]; targetClassId?: string; restoreFromHistory?: boolean }) => Promise<number>;
    revertLastPromotion: () => Promise<boolean>;
    increaseTuitionFees: (studentIds: string[], increaseAmount: number) => Promise<void>;
    sendFeeReminders: (challanIds: string[]) => Promise<void>;
    bulkUpdateClassOrder: (classes: { id: string; sortOrder: number }[]) => Promise<void>;
    addLog: (action: string, details: string) => Promise<void>;
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
    
    const [autoBackupSettings, setAutoBackupSettings] = useState<AutoBackupSettings>(() => {
        const saved = localStorage.getItem('edusync_autobackup');
        return saved ? JSON.parse(saved) : { 
            enabled: false, 
            frequency: 'weekly', 
            lastBackup: null, 
            lastBackupSize: null,
            includePhotos: true 
        };
    });

    const [schools, setSchools] = useState<School[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [classes, setClasses] = useState<Class[]>([]);
    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [exams, setExams] = useState<Exam[]>([]);
    const [students, setStudents] = useState<Student[]>([]);
    const [attendance, setAttendanceState] = useState<Attendance[]>([]);
    const [fees, setFees] = useState<FeeChallan[]>([]);
    const [results, setResults] = useState<Result[]>([]);
    const [logs, setLogs] = useState<ActivityLog[]>([]);
    const [feeHeads, setFeeHeads] = useState<FeeHead[]>([]);
    const [events, setEvents] = useState<SchoolEvent[]>([]);

    const isBackingUpRef = useRef(false);

    const updateAutoBackupSettings = useCallback((newSettings: Partial<AutoBackupSettings>) => {
        setAutoBackupSettings(prev => {
            const updated = { ...prev, ...newSettings };
            localStorage.setItem('edusync_autobackup', JSON.stringify(updated));
            return updated;
        });
    }, []);

    const backupToDrive = useCallback(async (silent = false) => {
        if (isBackingUpRef.current) return;
        isBackingUpRef.current = true;

        if (!silent) setOperationProgress({ percentage: 10, status: 'Preparing selective data backup...' });
        
        try {
            // Conditionally strip photos to save memory if requested
            const finalSchools = autoBackupSettings.includePhotos ? schools : schools.map(s => { const { logoUrl: _logo, ...rest } = s; return rest as School; });
            const finalUsers = autoBackupSettings.includePhotos ? users : users.map(u => { const { avatarUrl: _avatar, ...rest } = u; return rest as User; });
            const finalStudents = autoBackupSettings.includePhotos ? students : students.map(s => { const { avatarUrl: _avatar, ...rest } = s; return rest as Student; });

            const payload = {
                schools: finalSchools, 
                users: finalUsers, 
                classes, 
                students: finalStudents, 
                fees, 
                attendance, 
                results, 
                logs, 
                feeHeads, 
                events, 
                subjects, 
                exams
            };

            const jsonString = JSON.stringify(payload, null, 2);
            // Calculate size in MB
            const sizeInMB = (new Blob([jsonString]).size / (1024 * 1024)).toFixed(2) + ' MB';
            
            const fileName = `edusync_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
            
            if (!silent) setOperationProgress({ percentage: 40, status: `Handshaking with Google Drive... (${sizeInMB})` });
            
            await driveService.uploadFile(fileName, jsonString);
            
            updateAutoBackupSettings({ 
                lastBackup: new Date().toISOString(),
                lastBackupSize: sizeInMB
            });
            
            if (!silent) {
                setOperationProgress({ percentage: 100, status: 'Snapshot secured!' });
                showToast('Success', 'School database successfully backed up to your cloud.', 'success');
            }
        } catch (err: any) {
            console.error("Backup to drive failed:", err);
            if (!silent) {
                showToast('Cloud Error', err.message || 'Drive communication failed.', 'error');
                setOperationProgress({ percentage: 0, status: '' });
            } else if (err.message.includes('Identity') || err.message.includes('Token') || err.message.includes('expired')) {
                showToast('Backup Authorization Needed', 'Automatic backup is due. Please visit Settings to authorize Google Drive.', 'info');
            }
        } finally {
            isBackingUpRef.current = false;
            if (!silent) {
                setTimeout(() => setOperationProgress({ percentage: 0, status: '' }), 3000);
            }
        }
    }, [schools, users, classes, students, fees, attendance, results, logs, feeHeads, events, subjects, exams, showToast, updateAutoBackupSettings, autoBackupSettings.includePhotos]);

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
            setSubjects(data.subjects || []);
            setExams(data.exams || []);
            setFeeHeads(data.feeHeads || []);
            setEvents(data.events || []);
            setUsers(data.users || []);
            setStudents(data.students || []);
            setFees(data.fees || []);
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

    const lastCheckRef = useRef(0);
    useEffect(() => {
        if (!user || !autoBackupSettings.enabled) return;
        if (loading || isInitialLoad) return;

        const checkBackup = () => {
            const now = Date.now();
            if (now - lastCheckRef.current < 3600000) return;
            lastCheckRef.current = now;

            const last = autoBackupSettings.lastBackup ? new Date(autoBackupSettings.lastBackup) : new Date(0);
            const diffDays = Math.floor((now - last.getTime()) / (1000 * 3600 * 24));
            const threshold = autoBackupSettings.frequency === 'weekly' ? 7 : 30;

            if (diffDays >= threshold) {
                backupToDrive(true);
            }
        };

        checkBackup();
        const interval = setInterval(checkBackup, 3600000);
        return () => clearInterval(interval);
    }, [user, autoBackupSettings, loading, isInitialLoad, backupToDrive]);

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
            throw new Error(errorData.error || `Request failed with status ${res.status}`);
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
            status: updatedUser.status 
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
            avatarUrl: userData.avatarUrl
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
            sortOrder: cls.sortOrder 
        });
        await fetchData();
    };

    const deleteClass = async (id: string) => {
        await apiWrite('/api/write/classes', { action: 'delete-class', id });
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
        await fetchData();
        setOperationProgress({ percentage: 0, status: '' });
        showToast('Success', `Attendance recorded for ${total} students.`, 'success');
    };

    const recordFeePayment = async (challanId: string, amount: number, discount: number, paidDate: string) => {
        const challan = fees.find(f => f.id === challanId);
        if (!challan) return;
        const student = students.find(s => s.id === challan.studentId);

        await apiWrite('/api/write/payments', {
            action: 'record-payment',
            challanId,
            amount,
            discount,
            paidDate
        });
        await fetchData();
        showToast('Success', `Recorded payment of Rs. ${amount.toLocaleString()} for ${student?.name || 'Student'}`, 'success');
    };

    const updateFeePayment = async (challanId: string, paidAmount: number, discount: number, paidDate: string, paymentHistory?: any[]) => {
        await apiWrite('/api/write/payments', {
            action: 'update-payment',
            challanId,
            paidAmount,
            discount,
            paidDate,
            paymentHistory
        });
        await fetchData();
        showToast('Success', 'Payment updated successfully.', 'success');
    };

    const cancelChallan = async (challanId: string) => {
        await apiWrite('/api/write/payments', { action: 'cancel-challan', challanId });
        await fetchData();
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
        showToast('Success', `${count} challan(s) generated for ${month} ${year}${skipped > 0 ? ` (${skipped} duplicates skipped)` : ''}.`, 'success');
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
        await fetchData();
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

    const backupData = async () => {
        const data = { 
            schools, 
            users, 
            classes, 
            students, 
            fees, 
            attendance, 
            results, 
            logs, 
            feeHeads, 
            events, 
            subjects, 
            exams 
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `edusync_backup_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
    };

    const restoreData = async (file: File) => {
        if (!user) return;
        const isOwnerGlobalView = user.role === UserRole.Owner && !activeSchoolId;
        const effectiveSchoolId = user.role === UserRole.Owner && activeSchoolId ? activeSchoolId : user.schoolId;

        try {
            const text = await file.text();
            const rawData = JSON.parse(text);
            
            setOperationProgress({ percentage: 20, status: 'Restoring database in server atomic transaction...' });
            await apiWrite('/api/write/restore', {
                backupData: rawData,
                targetSchoolId: isOwnerGlobalView ? null : effectiveSchoolId
            });

            setOperationProgress({ percentage: 100, status: 'Reconstruction complete!' });
            showToast('Success', 'Database restoration successfully completed!', 'success');
            await fetchData();
        } catch (error: any) {
            console.error('Restore Crash:', error);
            showToast('Restore Failed', error.message || 'The snapshot file is invalid.', 'error');
            setOperationProgress({ percentage: 0, status: '' });
        } finally {
            setTimeout(() => setOperationProgress({ percentage: 0, status: '' }), 4000);
        }
    };

    const sendFeeReminders = async (challanIds: string[]) => {
        showToast('Success', `Broadcasted ${challanIds.length} reminders to parent dashboard.`, 'success');
    };

    const value: DataContextType = {
        schools, users, classes, subjects, exams, students, attendance, fees, results, logs, feeHeads, events,
        loading, isInitialLoad, lastSyncTime, syncError, syncProgress, operationProgress, 
        autoBackupSettings, updateAutoBackupSettings,
        fetchData, backupToDrive,
        getSchoolById: (id) => schools.find(s => s.id === id),
        updateUser, deleteUser, addUserByAdmin, addStudent, updateStudent, deleteStudent,
        addClass, updateClass, deleteClass, addSubject, updateSubject, deleteSubject,
        addExam, updateExam, deleteExam, setAttendance, recordFeePayment, updateFeePayment, cancelChallan,
        generateChallansForMonth, deleteChallansForMonth, addSchool, updateSchool, deleteSchool,
        addEvent, updateEvent, deleteEvent, bulkAddStudents, bulkAddUsers, bulkAddClasses,
        backupData, restoreData, promoteAllStudents, reactivateGraduatedStudents, revertLastPromotion, increaseTuitionFees, sendFeeReminders, bulkUpdateClassOrder, addFeeHead, updateFeeHead, deleteFeeHead,
        issueLeavingCertificate, saveResults, addLog
    };

    return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};
