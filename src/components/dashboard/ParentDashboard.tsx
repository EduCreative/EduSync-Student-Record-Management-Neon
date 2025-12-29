import React, { useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { Student, Result } from '../../types';
import Avatar from '../common/Avatar';
import StatCard from '../common/StatCard';
import BarChart from '../charts/BarChart';

const ParentDashboard: React.FC = () => {
    const { user } = useAuth();
    const { students, results, loading } = useData();

    const myChildren = useMemo(() => {
        if (!user || !user.childStudentIds) return [];
        return students.filter((s: Student) => user.childStudentIds!.includes(s.id));
    }, [user, students]);
    
    if (loading) {
        return (
            <div className="space-y-8">
                <div className="skeleton-bg h-9 w-64 rounded"></div>
                <div className="space-y-6">
                    {[...Array(2)].map((_, i) => (
                        <div key={i} className="bg-white dark:bg-secondary-800 p-6 rounded-xl shadow-lg">
                            <div className="flex items-center space-x-4 mb-4">
                                <div className="skeleton-bg w-16 h-16 rounded-full"></div>
                                <div className="space-y-2">
                                    <div className="skeleton-bg h-7 w-40 rounded"></div>
                                    <div className="skeleton-bg h-5 w-52 rounded"></div>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                <div className="skeleton-bg h-20 rounded-lg"></div>
                                <div className="skeleton-bg h-20 rounded-lg"></div>
                                <div className="skeleton-bg h-20 rounded-lg"></div>
                                <div className="skeleton-bg h-20 rounded-lg"></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )
    }
    
    if (!user) return null;

    if (myChildren.length === 0) {
        return (
             <div>
                <h1 className="text-3xl font-bold">Parent's Dashboard</h1>
                <div className="mt-8 bg-white dark:bg-secondary-800 p-8 text-center rounded-lg">
                    <h2 className="text-xl font-semibold">No Children Linked</h2>
                    <p className="text-secondary-500 mt-2">Your account is not yet linked to any students. Please contact the school administration to link your children to your profile.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <h1 className="text-3xl font-bold text-secondary-900 dark:text-white">Parent's Dashboard</h1>
            <div className="space-y-6">
                {myChildren.map(child => (
                    <ChildCard key={child.id} student={child} results={results} />
                ))}
            </div>
        </div>
    );
};

const ChildCard: React.FC<{ student: Student; results: Result[] }> = ({ student, results }) => {
    
    const recentExamPerformance = useMemo(() => {
        const studentResults = results.filter((r: Result) => r.studentId === student.id);
        const allExams = [...new Set(studentResults.map((r: Result) => r.exam))];
        if (allExams.length === 0) return { data: [], title: "No Exam Data" };
        
        const latestExam = allExams.sort().pop() || "Recent Exam";
    
        const data = studentResults
            .filter((r: Result) => r.exam === latestExam)
            .map((r: Result) => ({
                label: r.subject,
                value: r.totalMarks > 0 ? Math.round((r.marks / r.totalMarks) * 100) : 0,
            }));
        
        return { data, title: `${latestExam} Performance (%)`};
    }, [results, student]);

    return (
        <div className="bg-white dark:bg-secondary-800 p-6 rounded-xl shadow-lg space-y-4">
            <div className="flex items-center space-x-4">
                <Avatar student={student} className="w-16 h-16"/>
                <div>
                    <h2 className="text-2xl font-bold">{student.name}</h2>
                    <p className="text-secondary-500">Class: Class Name | <span className="font-bold text-primary-700 dark:text-primary-400">ID: {student.rollNumber}</span></p>
                </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard title="Attendance" value="95%" color="bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-300" icon={<CheckCircleIcon />} />
                <StatCard title="Overall Grade" value="A" color="bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300" icon={<AwardIcon />} />
                <StatCard title="Fee Status" value="Paid" color="bg-yellow-100 dark:bg-yellow-900/50 text-yellow-600 dark:text-yellow-300" icon={<DollarSignIcon />} />
                <button className="h-full flex items-center justify-center p-4 bg-secondary-50 dark:bg-secondary-700 rounded-lg hover:bg-secondary-100 dark:hover:bg-secondary-600">
                    <span className="font-semibold">View Full Details &rarr;</span>
                </button>
            </div>
            {recentExamPerformance.data.length > 0 && (
                 <div className="pt-4 border-t dark:border-secondary-700">
                    <BarChart title={recentExamPerformance.title} data={recentExamPerformance.data} multiColor={true} />
                 </div>
            )}
        </div>
    );
};

// Icons
const CheckCircleIcon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>;
const AwardIcon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="7" /><polyline points="8.21 13.89 7 23 12 17 17 23 15.79 13.88" /></svg>;
const DollarSignIcon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" x2="12" y1="2" y2="22" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>;


export default ParentDashboard;