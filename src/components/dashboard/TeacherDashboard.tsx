import React, { useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { Class, Student, Attendance, Result } from '../../types';
import StatCard from '../common/StatCard';
import StatCardSkeleton from '../common/skeletons/StatCardSkeleton';
import DoughnutChart from '../charts/DoughnutChart';
import BarChart from '../charts/BarChart';
import ChartSkeleton from '../common/skeletons/ChartSkeleton';

const TeacherDashboard: React.FC = () => {
    const { user } = useAuth();
    const { classes, students, attendance, results, loading } = useData();

    if (!user) return null;

    const assignedClasses = useMemo(() => classes.filter((c: Class) => c.teacherId === user.id), [classes, user.id]);
    
    const studentsInMyClasses = useMemo(() => {
        const classIds = new Set(assignedClasses.map(c => c.id));
        return students.filter((s: Student) => classIds.has(s.classId));
    }, [assignedClasses, students]);

    const stats = useMemo(() => {
        const studentIds = new Set(studentsInMyClasses.map(s => s.id));
        
        // Average Attendance
        const relevantAttendance = attendance.filter((a: Attendance) => studentIds.has(a.studentId));
        const presentCount = relevantAttendance.filter(a => a.status === 'Present').length;
        const averageAttendance = relevantAttendance.length > 0
            ? `${Math.round((presentCount / relevantAttendance.length) * 100)}%`
            : 'N/A';
        
        // Subjects Taught
        const relevantResults = results.filter((r: Result) => studentIds.has(r.studentId));
        const subjectsTaught = new Set(relevantResults.map((r: Result) => r.subject)).size;

        return {
            averageAttendance,
            subjectsTaught: subjectsTaught.toString(),
        };
    }, [studentsInMyClasses, attendance, results]);

    const attendanceSummary = useMemo(() => {
        const studentIds = new Set(studentsInMyClasses.map(s => s.id));
        const recentAttendance = attendance.filter((a: Attendance) => studentIds.has(a.studentId));
        const summary = { Present: 0, Absent: 0, Leave: 0 };
        recentAttendance.forEach(att => {
            summary[att.status]++;
        });
        return [
            { label: 'Present', value: summary.Present, color: '#10b981' },
            { label: 'Absent', value: summary.Absent, color: '#ef4444' },
            { label: 'Leave', value: summary.Leave, color: '#f59e0b' },
        ];
    }, [attendance, studentsInMyClasses]);
    
    const subjectPerformance = useMemo(() => {
        const studentIds = new Set(studentsInMyClasses.map(s => s.id));
        const allExams = [...new Set(results.filter((r: Result) => studentIds.has(r.studentId)).map((r: Result) => r.exam))];
        if (allExams.length === 0) return [];

        const latestExam = allExams.sort().pop();
        
        const latestExamResults = results.filter((r: Result) => studentIds.has(r.studentId) && r.exam === latestExam);
        const performanceBySubject: Record<string, { total: number, count: number }> = {};
    
        latestExamResults.forEach(r => {
            if (!performanceBySubject[r.subject]) {
                performanceBySubject[r.subject] = { total: 0, count: 0 };
            }
            const percentage = r.totalMarks > 0 ? (r.marks / r.totalMarks) * 100 : 0;
            performanceBySubject[r.subject].total += percentage;
            performanceBySubject[r.subject].count += 1;
        });
    
        return Object.entries(performanceBySubject).map(([subject, data]) => ({
            label: subject,
            value: Math.round(data.total / data.count)
        }));
    }, [results, studentsInMyClasses]);

    if (loading) {
        return (
            <div className="space-y-8">
                <div>
                    <div className="skeleton-bg h-9 w-64 mb-2 rounded"></div>
                    <div className="skeleton-bg h-5 w-80 rounded"></div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {[...Array(4)].map((_, i) => <StatCardSkeleton key={i} />)}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <ChartSkeleton />
                    <ChartSkeleton />
                </div>
                <div className="bg-white dark:bg-secondary-800 p-6 rounded-xl shadow-lg">
                    <div className="skeleton-bg h-6 w-32 mb-4 rounded"></div>
                    <div className="space-y-4">
                        <div className="skeleton-bg h-16 w-full rounded-lg"></div>
                        <div className="skeleton-bg h-16 w-full rounded-lg"></div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-secondary-900 dark:text-white">Teacher's Dashboard</h1>
                <p className="text-secondary-500 dark:text-secondary-400">Welcome, {user.name}. Here are your classes and tasks.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard title="Assigned Classes" value={assignedClasses.length.toString()} color="bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300" icon={<BookOpenIcon />} />
                <StatCard title="Total Students" value={studentsInMyClasses.length.toString()} color="bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-300" icon={<UsersIcon />} />
                <StatCard title="Average Attendance" value={stats.averageAttendance} color="bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-300" icon={<CheckCircleIcon />} />
                <StatCard title="Subjects Taught" value={stats.subjectsTaught} color="bg-yellow-100 dark:bg-yellow-900/50 text-yellow-600 dark:text-yellow-300" icon={<ClipboardListIcon />} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <DoughnutChart title="Overall Attendance Summary" data={attendanceSummary} />
                <BarChart title="Latest Exam Performance (Avg %)" data={subjectPerformance} multiColor={true} />
            </div>

            <div className="bg-white dark:bg-secondary-800 p-6 rounded-xl shadow-lg">
                <h2 className="text-xl font-semibold mb-4">My Classes</h2>
                <div className="space-y-4">
                    {assignedClasses.map(c => (
                        <div key={c.id} className="p-4 border dark:border-secondary-700 rounded-lg flex justify-between items-center">
                            <div>
                                <p className="font-semibold text-secondary-800 dark:text-secondary-100">{c.name}</p>
                                <p className="text-sm text-secondary-500">{students.filter((s: Student) => s.classId === c.id).length} Students</p>
                            </div>
                            <div className="flex space-x-2">
                                <button className="px-3 py-1 text-sm font-medium text-primary-700 bg-primary-100 dark:bg-primary-900 dark:text-primary-200 rounded-md hover:bg-primary-200">Take Attendance</button>
                                <button className="px-3 py-1 text-sm font-medium text-green-700 bg-green-100 dark:bg-green-900 dark:text-green-200 rounded-md hover:bg-green-200">Enter Results</button>
                            </div>
                        </div>
                    ))}
                    {assignedClasses.length === 0 && (
                        <p className="text-center text-secondary-500 dark:text-secondary-400 py-4">You are not currently assigned to any classes.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

// Icons
const BookOpenIcon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>;
const UsersIcon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
const ClipboardListIcon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/></svg>;
const CheckCircleIcon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>;

export default TeacherDashboard;