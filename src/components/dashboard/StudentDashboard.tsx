import React, { useMemo, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { Student, Class, Result } from '../../types';
import Avatar from '../common/Avatar';
import StatCard from '../common/StatCard';
import StatCardSkeleton from '../common/skeletons/StatCardSkeleton';
import BarChart from '../charts/BarChart';
import ChartSkeleton from '../common/skeletons/ChartSkeleton';
import { getGrade } from '../students/StudentResults';
import { getKarachiDateOffset, getTodayKarachi } from '../../utils/dates';

const StudentDashboard: React.FC = () => {
    const { user } = useAuth();
    const { students, classes, results, attendance, getLedgerForStudent, loadAttendanceRange, loading } = useData();

    const thirtyDaysAgo = useMemo(() => getKarachiDateOffset(-30), []);
    const today = useMemo(() => getTodayKarachi(), []);

    useEffect(() => {
        loadAttendanceRange(thirtyDaysAgo, today);
    }, [thirtyDaysAgo, today, loadAttendanceRange]);

    // Find the student profile that matches the logged-in user.
    const studentProfile = useMemo(() => {
        if (!user) return undefined;
        return students.find((s: Student) => s.userId === user.id);
    }, [students, user]);
    
    const studentClass = studentProfile ? classes.find((c: Class) => c.id === studentProfile.classId) : null;
    const studentClassName = studentClass ? `${studentClass.name}${studentClass.section ? ' - ' + studentClass.section : ''}` : 'N/A';

    const attendanceStat = useMemo(() => {
        if (!studentProfile) return 'N/A';
        const records = attendance.filter(a => a.studentId === studentProfile.id && a.date >= thirtyDaysAgo && a.date <= today);
        if (records.length === 0) return 'N/A';
        const present = records.filter(a => a.status === 'Present').length;
        return `${Math.round((present / records.length) * 100)}%`;
    }, [attendance, studentProfile, thirtyDaysAgo, today]);

    const studentResults = useMemo(() => {
        if (!studentProfile) return [];
        return results.filter((r: Result) => r.studentId === studentProfile.id);
    }, [results, studentProfile]);

    const distinctExamNames = useMemo(() => {
        return [...new Set(studentResults.map((r: Result) => r.exam))];
    }, [studentResults]);

    const examsTakenCount = distinctExamNames.length;

    const overallGrade = useMemo(() => {
        if (distinctExamNames.length === 0) return 'N/A';
        const latestExam = [...distinctExamNames].sort().pop();
        if (!latestExam) return 'N/A';
        const examResults = studentResults.filter((r: Result) => r.exam === latestExam);
        const totalMarks = examResults.reduce((sum, r) => sum + r.marks, 0);
        const totalMaxMarks = examResults.reduce((sum, r) => sum + r.totalMarks, 0);
        if (totalMaxMarks === 0) return 'N/A';
        const grade = getGrade(totalMarks, totalMaxMarks);
        return grade === '-' ? 'N/A' : grade;
    }, [distinctExamNames, studentResults]);

    const feeStatus = useMemo(() => {
        if (!studentProfile) return { label: 'N/A', color: 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-600 dark:text-yellow-300' };
        const ledger = getLedgerForStudent(studentProfile.id);
        if (!ledger) return { label: 'N/A', color: 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-600 dark:text-yellow-300' };
        if (ledger.balance <= 0.01) {
            return {
                label: 'Paid',
                color: 'bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-300'
            };
        }
        return {
            label: `Rs. ${Math.round(ledger.balance).toLocaleString()} due`,
            color: 'bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-300'
        };
    }, [getLedgerForStudent, studentProfile]);

    const recentExamPerformance = useMemo(() => {
        if (distinctExamNames.length === 0) return [];
        const latestExam = [...distinctExamNames].sort().pop();
        return studentResults
            .filter((r: Result) => r.exam === latestExam)
            .map((r: Result) => ({
                label: r.subject,
                value: r.totalMarks > 0 ? Math.round((r.marks / r.totalMarks) * 100) : 0
            }));
    }, [distinctExamNames, studentResults]);

    if (loading) {
        return (
            <div className="space-y-8">
                <div className="flex items-center space-x-4">
                     <div className="skeleton-bg w-20 h-20 rounded-full"></div>
                     <div className="space-y-2">
                        <div className="skeleton-bg h-9 w-48 rounded"></div>
                        <div className="skeleton-bg h-5 w-64 rounded"></div>
                     </div>
                </div>
    
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                     {[...Array(4)].map((_, i) => <StatCardSkeleton key={i} />)}
                </div>
    
                <ChartSkeleton />
            </div>
        )
    }

    if (!user || !studentProfile) return null;

    return (
        <div className="space-y-8">
            <div className="flex items-center space-x-4">
                 <Avatar student={studentProfile} className="w-20 h-20" />
                 <div>
                    <h1 className="text-3xl font-bold text-secondary-900 dark:text-white">Welcome, {user.name}!</h1>
                    <p className="text-secondary-500 dark:text-secondary-400">
                        {studentClassName} | <span className="font-bold text-primary-700 dark:text-primary-400">ID: {studentProfile.rollNumber}</span>
                    </p>
                 </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                 <StatCard title="My Attendance" value={attendanceStat} color="bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-300" icon={<CheckCircleIcon />} />
                 <StatCard title="Overall Grade" value={overallGrade} color="bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300" icon={<AwardIcon />} />
                 <StatCard title="Fee Status" value={feeStatus.label} color={feeStatus.color} icon={<DollarSignIcon />} />
                 <StatCard title="Exams Taken" value={examsTakenCount.toString()} color="bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-300" icon={<EditIcon />} />
            </div>
            
            <BarChart title="Recent Exam Performance (%)" data={recentExamPerformance} multiColor={true} />
        </div>
    );
};

// Icons
const CheckCircleIcon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>;
const AwardIcon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="7" /><polyline points="8.21 13.89 7 23 12 17 17 23 15.79 13.88" /></svg>;
const DollarSignIcon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" x2="12" y1="2" y2="22" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>;
const EditIcon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>;


export default StudentDashboard;