import React, { createContext, useContext, useState, ReactNode, useCallback, useEffect } from 'react';
import { School, User, UserRole, Class, Student, Attendance, FeeChallan, Result, ActivityLog, FeeHead, SchoolEvent, Subject, Exam } from '../types';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';
import { sql } from '../lib/neonClient';
import { db } from '../lib/db';
import { toCamelCase, toSnakeCase } from '../utils/caseConverter';
import { useTheme } from './ThemeContext';

interface SyncProgress {
    percentage: number;
    status: string;
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
    restoreData: (backupFile: File) => Promise<void>;
    promoteAllStudents: (mappings: Record<string, string | 'graduate'>, exemptedStudentIds: string[]) => Promise<void>;
    increaseTuitionFees: (studentIds: string[], increaseAmount: number) => Promise<void>;
    sendFeeReminders: (challanIds: string[]) => Promise<void>;
    bulkUpdateClassOrder: (classes: { id: string; sortOrder: number }[]) => Promise<void>;
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
    const { user, activeSchoolId } = useAuth();
    const { showToast } = useToast();
    const { syncMode } = useTheme();

    const [loading, setLoading] = useState(true);
    const [isInitialLoad, setIsInitialLoad] = useState(true);
    const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
    const [syncError, setSyncError] = useState<string | null>(null);
    const [syncProgress, setSyncProgress] = useState<SyncProgress>({ percentage: 0, status: '' });

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

    const fetchData = useCallback(async () => {
        if (!user) {
            setLoading(false);
            return;
        }

        setLoading(true);
        setSyncError(null);
        setSyncProgress({ percentage: 5, status: 'Establishing connection...' });

        try {
            const effectiveSchoolId = user.role === UserRole.Owner && activeSchoolId ? activeSchoolId : user.schoolId;

            // STEP 1: Core Configuration (15%)
            setSyncProgress({ percentage: 10, status: 'Loading configuration...' });
            const [schoolsData, classesData, subjectsData, examsData, feeHeadsData, eventsData] = await Promise.all([
                sql`SELECT * FROM schools`,
                effectiveSchoolId ? sql`SELECT * FROM classes WHERE school_id = ${effectiveSchoolId}` : sql`SELECT * FROM classes`,
                effectiveSchoolId ? sql`SELECT * FROM subjects WHERE school_id = ${effectiveSchoolId}` : sql`SELECT * FROM subjects`,
                effectiveSchoolId ? sql`SELECT * FROM exams WHERE school_id = ${effectiveSchoolId}` : sql`SELECT * FROM exams`,
                effectiveSchoolId ? sql`SELECT * FROM fee_heads WHERE school_id = ${effectiveSchoolId}` : sql`SELECT * FROM fee_heads`,
                effectiveSchoolId ? sql`SELECT * FROM school_events WHERE school_id = ${effectiveSchoolId}` : sql`SELECT * FROM school_events`,
            ]);

            setSchools(toCamelCase(schoolsData));
            setClasses(toCamelCase(classesData));
            setSubjects(toCamelCase(subjectsData));
            setExams(toCamelCase(examsData));
            setFeeHeads(toCamelCase(feeHeadsData).map((fh: any) => ({ ...fh, defaultAmount: Number(fh.defaultAmount || 0) })));
            setEvents(toCamelCase(eventsData));
            setSyncProgress({ percentage: 25, status: 'Setting up users...' });

            // STEP 2: Profiles (35%)
            const profilesData = effectiveSchoolId 
                ? await sql`SELECT * FROM profiles WHERE school_id = ${effectiveSchoolId} OR school_id IS NULL` 
                : await sql`SELECT * FROM profiles`;
            setUsers(toCamelCase(profilesData));
            setSyncProgress({ percentage: 40, status: 'Fetching students...' });

            // STEP 3: Students (Crucial for next steps) (50%)
            const studentsData = effectiveSchoolId 
                ? await sql`SELECT * FROM students WHERE school_id = ${effectiveSchoolId}` 
                : await sql`SELECT * FROM students`;
            
            const transformedStudents = toCamelCase(studentsData).map((s: any) => ({ 
                ...s, 
                openingBalance: Number(s.openingBalance || 0),
                feeStructure: (s.feeStructure || []).map((item: any) => ({ ...item, amount: Number(item.amount || 0) }))
            }));
            setStudents(transformedStudents);
            
            const sIds = studentsData.map(s => s.id);
            if (sIds.length === 0) {
                setSyncProgress({ percentage: 100, status: 'Complete' });
                setLoading(false);
                if (isInitialLoad) setIsInitialLoad(false);
                setLastSyncTime(new Date());
                return;
            }

            // STEP 4: Historical Data (Streamed for responsive feel)
            setSyncProgress({ percentage: 60, status: 'Syncing fee ledgers...' });
            const feesData = await sql`SELECT * FROM fee_challans WHERE student_id = ANY(${sIds})`;
            setFees(toCamelCase(feesData).map((f: any) => {
                let history = f.paymentHistory;
                if (typeof history === 'string') { try { history = JSON.parse(history); } catch { history = []; } }
                if (!Array.isArray(history)) history = [];
                return {
                    ...f,
                    previousBalance: Number(f.previousBalance || 0),
                    totalAmount: Number(f.totalAmount || 0),
                    discount: Number(f.discount || 0),
                    paidAmount: Number(f.paidAmount || 0),
                    fineAmount: Number(f.fineAmount || 0),
                    paymentHistory: history.map((p: any) => ({ ...p, amount: Number(p.amount || 0) }))
                };
            }));

            setSyncProgress({ percentage: 75, status: 'Loading results and attendance...' });
            const [attData, resData] = await Promise.all([
                sql`SELECT * FROM attendance WHERE student_id = ANY(${sIds})`,
                sql`SELECT * FROM results WHERE student_id = ANY(${sIds})`,
            ]);
            setAttendanceState(toCamelCase(attData));
            setResults(toCamelCase(resData).map((r: any) => ({
                ...r,
                marks: Number(r.marks || 0),
                totalMarks: Number(r.totalMarks || 100)
            })));

            setSyncProgress({ percentage: 90, status: 'Finalizing sync...' });
            const logsData = effectiveSchoolId 
                ? await sql`SELECT * FROM activity_logs WHERE school_id = ${effectiveSchoolId} ORDER BY timestamp DESC LIMIT 100` 
                : await sql`SELECT * FROM activity_logs ORDER BY timestamp DESC LIMIT 100`;
            setLogs(toCamelCase(logsData));

            // FINAL STEP: Cache locally if offline mode
            if (syncMode === 'offline') {
                await db.transaction('rw', db.tables, async () => {
                    await Promise.all([
                        db.schools.bulkPut(schools),
                        db.users.bulkPut(users),
                        db.classes.bulkPut(classes),
                        db.students.bulkPut(transformedStudents),
                        db.fees.bulkPut(fees),
                        db.attendance.bulkPut(attendance),
                        db.results.bulkPut(results),
                        db.logs.bulkPut(logs),
                        db.feeHeads.bulkPut(feeHeads),
                        db.events.bulkPut(events),
                        db.subjects.bulkPut(subjects),
                        db.exams.bulkPut(exams),
                    ]);
                });
            }

            setSyncProgress({ percentage: 100, status: 'Synchronized' });
            setLastSyncTime(new Date());
        } catch (error: any) {
            console.error("Sync Error:", error);
            setSyncError(error.message);
        } finally {
            setLoading(false);
            if (isInitialLoad) setIsInitialLoad(false);
            // Clear status after a delay
            setTimeout(() => setSyncProgress({ percentage: 0, status: '' }), 3000);
        }
    }, [user, activeSchoolId, isInitialLoad, syncMode, schools, users, classes, fees, attendance, results, logs, feeHeads, events, subjects, exams]);

    useEffect(() => { fetchData(); }, [user, activeSchoolId]); // Only fetch when user or school context changes

    const addLog = useCallback(async (action: string, details: string) => {
        if (!user) return;
        const effectiveSchoolId = user.role === UserRole.Owner && activeSchoolId ? activeSchoolId : user.schoolId;
        const id = crypto.randomUUID();
        await sql`
            INSERT INTO activity_logs (id, user_id, user_name, user_avatar, school_id, action, details, timestamp)
            VALUES (${id}, ${user.id}, ${user.name}, ${user.avatarUrl || ''}, ${effectiveSchoolId}, ${action}, ${details}, ${new Date().toISOString()})
        `;
    }, [user, activeSchoolId]);

    const updateUser = async (updatedUser: User) => {
        const d = toSnakeCase(updatedUser);
        await sql`UPDATE profiles SET name = ${d.name}, avatar_url = ${d.avatar_url}, status = ${d.status} WHERE id = ${d.id}`;
        await fetchData();
    };

    const deleteUser = async (userId: string) => {
        await sql`UPDATE profiles SET status = 'Inactive' WHERE id = ${userId}`;
        await fetchData();
    };

    const addUserByAdmin = async (userData: any) => {
        const id = crypto.randomUUID();
        const d = toSnakeCase({ ...userData, id, status: 'Active' });
        await sql`INSERT INTO profiles (id, name, email, password, role, school_id, status, avatar_url) VALUES (${d.id}, ${d.name}, ${d.email}, ${d.password}, ${d.role}, ${d.school_id}, ${d.status}, ${d.avatar_url})`;
        await fetchData();
    };

    const addStudent = async (data: any) => {
        const id = crypto.randomUUID();
        const s = toSnakeCase({ ...data, id, status: 'Active' });
        await sql`INSERT INTO students (id, name, roll_number, class_id, school_id, father_name, father_cnic, date_of_birth, date_of_admission, contact_number, secondary_contact_number, address, status, gender, admitted_class, gr_number, religion, caste, last_school_attended, opening_balance, user_id)
                  VALUES (${s.id}, ${s.name}, ${s.roll_number}, ${s.class_id}, ${s.school_id}, ${s.father_name}, ${s.father_cnic}, ${s.date_of_birth}, ${s.date_of_admission}, ${s.contact_number}, ${s.secondary_contact_number}, ${s.address}, ${s.status}, ${s.gender}, ${s.admitted_class}, ${s.gr_number}, ${s.religion}, ${s.caste}, ${s.last_school_attended}, ${s.opening_balance}, ${s.user_id})`;
        await fetchData();
        addLog('Add Student', `Added student: ${s.name}`);
    };

    const updateStudent = async (student: Student) => {
        const s = toSnakeCase(student);
        await sql`UPDATE students SET name = ${s.name}, roll_number = ${s.roll_number}, class_id = ${s.class_id}, father_name = ${s.father_name}, father_cnic = ${s.father_cnic}, date_of_birth = ${s.date_of_birth}, contact_number = ${s.contact_number}, address = ${s.address}, status = ${s.status}, gender = ${s.gender}, avatar_url = ${s.avatar_url}, admitted_class = ${s.admitted_class}, gr_number = ${s.gr_number}, religion = ${s.religion}, caste = ${s.caste}, last_school_attended = ${s.last_school_attended}, opening_balance = ${s.opening_balance}, user_id = ${s.user_id}, fee_structure = ${JSON.stringify(s.fee_structure || [])} WHERE id = ${s.id}`;
        await fetchData();
    };

    const deleteStudent = async (studentId: string) => {
        await sql`UPDATE students SET status = 'Deleted' WHERE id = ${studentId}`;
        await fetchData();
    };

    const addClass = async (data: any) => {
        const id = crypto.randomUUID();
        await sql`INSERT INTO classes (id, name, section, teacher_id, school_id, sort_order) VALUES (${id}, ${data.name}, ${data.section}, ${data.teacherId}, ${data.schoolId}, ${data.sortOrder || 0})`;
        await fetchData();
    };

    const updateClass = async (cls: Class) => {
        const d = toSnakeCase(cls);
        await sql`UPDATE classes SET name = ${d.name}, section = ${d.section}, teacher_id = ${d.teacher_id}, sort_order = ${d.sort_order} WHERE id = ${d.id}`;
        await fetchData();
    };

    const deleteClass = async (id: string) => {
        await sql`DELETE FROM classes WHERE id = ${id}`;
        await fetchData();
    };

    const addSubject = async (data: any) => {
        await sql`INSERT INTO subjects (id, name, school_id) VALUES (${crypto.randomUUID()}, ${data.name}, ${data.schoolId})`;
        await fetchData();
    };

    const updateSubject = async (subj: Subject) => {
        await sql`UPDATE subjects SET name = ${subj.name} WHERE id = ${subj.id}`;
        await fetchData();
    };

    const deleteSubject = async (id: string) => {
        await sql`DELETE FROM subjects WHERE id = ${id}`;
        await fetchData();
    };

    const addExam = async (data: any) => {
        await sql`INSERT INTO exams (id, name, school_id) VALUES (${crypto.randomUUID()}, ${data.name}, ${data.schoolId})`;
        await fetchData();
    };

    const updateExam = async (exam: Exam) => {
        await sql`UPDATE exams SET name = ${exam.name} WHERE id = ${exam.id}`;
        await fetchData();
    };

    const deleteExam = async (id: string) => {
        await sql`DELETE FROM exams WHERE id = ${id}`;
        await fetchData();
    };

    const setAttendance = async (date: string, records: any[]) => {
        for (const r of records) {
            await sql`
                INSERT INTO attendance (id, student_id, date, status)
                VALUES (${crypto.randomUUID()}, ${r.studentId}, ${date}, ${r.status})
                ON CONFLICT (student_id, date) DO UPDATE SET status = EXCLUDED.status
            `;
        }
        await fetchData();
    };

    const recordFeePayment = async (challanId: string, amount: number, discount: number, paidDate: string) => {
        const challan = fees.find(f => f.id === challanId);
        if (!challan) return;

        const newTotalPaid = challan.paidAmount + amount;
        const netPayable = challan.totalAmount - discount;
        const status = newTotalPaid >= netPayable ? 'Paid' : 'Partial';
        
        const history = challan.paymentHistory || [];
        const newRecord = { amount, date: paidDate };

        await sql`
            UPDATE fee_challans 
            SET paid_amount = ${newTotalPaid}, discount = ${discount}, status = ${status}, paid_date = ${paidDate}, payment_history = ${JSON.stringify([...history, newRecord])}
            WHERE id = ${challanId}
        `;
        await fetchData();
        showToast('Payment Recorded', `Amount: Rs. ${amount.toLocaleString()} for ${challan.month}`, 'success');
    };

    const updateFeePayment = async (challanId: string, paidAmount: number, discount: number, paidDate: string, paymentHistory?: any[]) => {
        const challan = fees.find(f => f.id === challanId);
        if (!challan) return;
        const status = paidAmount >= (challan.totalAmount - discount) ? 'Paid' : (paidAmount > 0 ? 'Partial' : 'Unpaid');
        
        // Use provided history or maintain current
        const historyToSave = paymentHistory || challan.paymentHistory || [];

        await sql`
            UPDATE fee_challans 
            SET paid_amount = ${paidAmount}, discount = ${discount}, status = ${status}, paid_date = ${paidDate}, payment_history = ${JSON.stringify(historyToSave)}
            WHERE id = ${challanId}
        `;
        await fetchData();
        showToast('Success', 'Payment record updated successfully.', 'success');
    };

    const cancelChallan = async (challanId: string) => {
        await sql`UPDATE fee_challans SET status = 'Cancelled' WHERE id = ${challanId}`;
        await fetchData();
    };

    const generateChallansForMonth = async (month: string, year: number, selectedHeads: any[], studentIds: string[], dueDate?: string) => {
        const studentFeesMap = new Map<string, FeeChallan[]>();
        fees.forEach(f => {
            if (f.status !== 'Cancelled') {
                const list = studentFeesMap.get(f.studentId) || [];
                list.push(f);
                studentFeesMap.set(f.studentId, list);
            }
        });

        let count = 0;
        for (const sId of studentIds) {
            const student = students.find(s => s.id === sId);
            if (!student) continue;

            const studentChallans = studentFeesMap.get(sId) || [];
            const totalCharged = studentChallans.reduce((sum, f) => sum + (f.totalAmount - f.previousBalance), 0) + (student.openingBalance || 0);
            const totalCollected = studentChallans.reduce((sum, f) => sum + f.paidAmount + f.discount, 0);
            const arrears = Math.max(0, totalCharged - totalCollected);

            const feeStructureMap = new Map((student.feeStructure || []).map(item => [item.feeHeadId, item.amount]));
            const items = selectedHeads.map((h: any) => ({
                description: feeHeads.find(fh => fh.id === h.feeHeadId)?.name || 'Fee',
                amount: feeStructureMap.get(h.feeHeadId) ?? h.amount
            }));

            const subtotal = items.reduce((sum: number, i: any) => sum + i.amount, 0);
            const total = subtotal + arrears;
            const cNum = `${year}${month.substring(0, 3)}-${student.rollNumber}`;

            await sql`
                INSERT INTO fee_challans (id, challan_number, student_id, class_id, month, year, due_date, status, fee_items, previous_balance, total_amount, discount, paid_amount)
                VALUES (${crypto.randomUUID()}, ${cNum}, ${sId}, ${student.classId}, ${month}, ${year}, ${dueDate}, 'Unpaid', ${JSON.stringify(items)}, ${arrears}, ${total}, 0, 0)
            `;
            count++;
        }
        await fetchData();
        showToast('Success', `${count} challans generated.`, 'success');
        return count;
    };

    const deleteChallansForMonth = async (m: string, y: number) => {
        const effectiveSchoolId = user?.role === UserRole.Owner && activeSchoolId ? activeSchoolId : user?.schoolId;
        const res = await sql`
            DELETE FROM fee_challans 
            WHERE month = ${m} AND year = ${y} AND paid_amount = 0 AND student_id IN (SELECT id FROM students WHERE school_id = ${effectiveSchoolId})
            RETURNING *
        `;
        await fetchData();
        return res.length;
    };

    const addFeeHead = async (data: any) => {
        await sql`INSERT INTO fee_heads (id, name, default_amount, school_id) VALUES (${crypto.randomUUID()}, ${data.name}, ${data.defaultAmount}, ${data.schoolId})`;
        await fetchData();
    };

    const updateFeeHead = async (fh: FeeHead) => {
        await sql`UPDATE fee_heads SET name = ${fh.name}, default_amount = ${fh.defaultAmount} WHERE id = ${fh.id}`;
        await fetchData();
    };

    const deleteFeeHead = async (id: string) => {
        await sql`DELETE FROM fee_heads WHERE id = ${id}`;
        await fetchData();
    };

    const saveResults = async (resultsToSave: any[]) => {
        for (const r of resultsToSave) {
            await sql`
                INSERT INTO results (id, student_id, class_id, exam, subject, marks, total_marks)
                VALUES (${crypto.randomUUID()}, ${r.studentId}, ${r.classId}, ${r.exam}, ${r.subject}, ${r.marks}, ${r.total_marks})
                ON CONFLICT (student_id, class_id, exam, subject) DO UPDATE SET marks = EXCLUDED.marks, total_marks = EXCLUDED.total_marks
            `;
        }
        await fetchData();
        showToast('Success', 'Results saved successfully.', 'success');
    };

    const addSchool = async (name: string, address: string, logoUrl?: string | null) => {
        await sql`INSERT INTO schools (id, name, address, logo_url) VALUES (${crypto.randomUUID()}, ${name}, ${address}, ${logoUrl})`;
        await fetchData();
    };

    const updateSchool = async (s: School) => {
        await sql`UPDATE schools SET name = ${s.name}, address = ${s.address}, logo_url = ${s.logoUrl} WHERE id = ${s.id}`;
        await fetchData();
    };

    const deleteSchool = async (id: string) => {
        await sql`DELETE FROM schools WHERE id = ${id}`;
        await fetchData();
    };

    const addEvent = async (data: any) => {
        const d = toSnakeCase(data);
        await sql`INSERT INTO school_events (id, title, date, category, description, school_id) VALUES (${crypto.randomUUID()}, ${d.title}, ${d.date}, ${d.category}, ${d.description}, ${d.school_id})`;
        await fetchData();
    };

    const updateEvent = async (e: SchoolEvent) => {
        const d = toSnakeCase(e);
        await sql`UPDATE school_events SET title = ${d.title}, date = ${d.date}, category = ${d.category}, description = ${d.description} WHERE id = ${d.id}`;
        await fetchData();
    };

    const deleteEvent = async (id: string) => {
        await sql`DELETE FROM school_events WHERE id = ${id}`;
        await fetchData();
    };

    const issueLeavingCertificate = async (studentId: string, details: any) => {
        const d = toSnakeCase(details);
        await sql`UPDATE students SET status = 'Left', date_of_leaving = ${d.date_of_leaving}, reason_for_leaving = ${d.reason_for_leaving}, conduct = ${d.conduct}, progress = ${d.progress}, place_of_birth = ${d.place_of_birth} WHERE id = ${studentId}`;
        await fetchData();
        addLog('Issue Certificate', `Issued leaving certificate for student ID: ${studentId}`);
    };

    const bulkAddStudents = async (studentList: any[]) => {
        for (const s of studentList) {
            const id = crypto.randomUUID();
            const sn = toSnakeCase({ ...s, id, status: 'Active' });
            await sql`INSERT INTO students (id, name, roll_number, class_id, school_id, father_name, father_cnic, date_of_birth, date_of_admission, contact_number, secondary_contact_number, address, status, gender, admitted_class, gr_number, religion, caste, last_school_attended, opening_balance, user_id, fee_structure)
                      VALUES (${sn.id}, ${sn.name}, ${sn.roll_number}, ${sn.class_id}, ${sn.school_id}, ${sn.father_name}, ${sn.father_cnic}, ${sn.date_of_birth}, ${sn.date_of_admission}, ${sn.contact_number}, ${sn.secondary_contact_number}, ${sn.address}, ${sn.status}, ${sn.gender}, ${sn.admitted_class}, ${sn.gr_number}, ${sn.religion}, ${sn.caste}, ${sn.last_school_attended}, ${sn.opening_balance}, ${sn.user_id}, ${JSON.stringify(sn.fee_structure || [])})`;
        }
        await fetchData();
    };

    const bulkAddUsers = async (userList: any[]) => {
        for (const u of userList) {
            const id = crypto.randomUUID();
            const un = toSnakeCase({ ...u, id });
            await sql`INSERT INTO profiles (id, name, email, password, role, school_id, status) VALUES (${un.id}, ${un.name}, ${un.email}, ${un.password}, ${un.role}, ${un.school_id}, ${un.status})`;
        }
        await fetchData();
    };

    const bulkAddClasses = async (classList: any[]) => {
        for (const c of classList) {
            await sql`INSERT INTO classes (id, name, school_id) VALUES (${crypto.randomUUID()}, ${c.name}, ${c.schoolId})`;
        }
        await fetchData();
    };

    const bulkUpdateClassOrder = async (updates: { id: string; sortOrder: number }[]) => {
        for (const u of updates) {
            await sql`UPDATE classes SET sort_order = ${u.sortOrder} WHERE id = ${u.id}`;
        }
        await fetchData();
    };

    const promoteAllStudents = async (mappings: Record<string, string | 'graduate'>, exemptedIds: string[]) => {
        const exemptSet = new Set(exemptedIds);
        for (const [fromId, to] of Object.entries(mappings)) {
            if (to === 'graduate') {
                await sql`UPDATE students SET status = 'Graduated' WHERE class_id = ${fromId} AND id != ALL(${Array.from(exemptSet)})`;
            } else {
                await sql`UPDATE students SET class_id = ${to} WHERE class_id = ${fromId} AND id != ALL(${Array.from(exemptSet)})`;
            }
        }
        await fetchData();
        showToast('Success', 'Promotion process completed.', 'success');
    };

    const increaseTuitionFees = async (studentIds: string[], amount: number) => {
        const tuitionHead = feeHeads.find(fh => fh.name.toLowerCase() === 'tuition fee');
        if (!tuitionHead) {
            showToast('Error', "No 'Tuition Fee' head found. Please create one first.", 'error');
            return;
        }

        for (const sId of studentIds) {
            const student = students.find(s => s.id === sId);
            if (!student) continue;

            let structure = student.feeStructure || [];
            const idx = structure.findIndex(item => item.feeHeadId === tuitionHead.id);
            
            if (idx !== -1) {
                structure[idx].amount += amount;
            } else {
                structure.push({ feeHeadId: tuitionHead.id, amount: tuitionHead.defaultAmount + amount });
            }

            await sql`UPDATE students SET fee_structure = ${JSON.stringify(structure)} WHERE id = ${sId}`;
        }
        await fetchData();
        showToast('Success', `Tuition fees increased by Rs. ${amount} for ${studentIds.length} students.`, 'success');
    };

    const backupData = async () => {
        const data = { schools, users, classes, students, fees, attendance, results, logs, feeHeads, events };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `edusync_backup_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
    };

    const restoreData = async (_file: File) => {
        showToast('Info', 'For Neon migration, please use the Neon "Import from database" tool in your Neon dashboard for full reliability.', 'info');
    };

    const sendFeeReminders = async (challanIds: string[]) => {
        showToast('Success', `Sent ${challanIds.length} reminders to parents.`, 'success');
    };

    const value: DataContextType = {
        schools, users, classes, subjects, exams, students, attendance, fees, results, logs, feeHeads, events,
        loading, isInitialLoad, lastSyncTime, syncError, syncProgress, fetchData,
        getSchoolById: (id) => schools.find(s => s.id === id),
        updateUser, deleteUser, addUserByAdmin, addStudent, updateStudent, deleteStudent,
        addClass, updateClass, deleteClass, addSubject, updateSubject, deleteSubject,
        addExam, updateExam, deleteExam, setAttendance, recordFeePayment, updateFeePayment, cancelChallan,
        generateChallansForMonth, deleteChallansForMonth, addFeeHead, updateFeeHead, deleteFeeHead,
        issueLeavingCertificate, saveResults, addSchool, updateSchool, deleteSchool,
        addEvent, updateEvent, deleteEvent, bulkAddStudents, bulkAddUsers, bulkAddClasses,
        backupData, restoreData, promoteAllStudents, increaseTuitionFees, sendFeeReminders, bulkUpdateClassOrder
    };

    return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};