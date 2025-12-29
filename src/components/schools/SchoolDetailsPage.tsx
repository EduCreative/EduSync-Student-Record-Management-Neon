import React, { useMemo, useState } from 'react';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { ActiveView } from '../layout/Layout';
import Avatar from '../common/Avatar';
import StatCard from '../common/StatCard';
import { UserRole, Student, User, Class, FeeChallan } from '../../types';

const ArrowLeftIcon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>;
const UsersIcon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9"cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
const BriefcaseIcon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="7" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>;
const SchoolIcon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m4 6 8-4 8 4"/><path d="m18 10 4 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-8l4-2"/><path d="M14 22v-4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v4"/><path d="M18 5v17"/><path d="M6 5v17"/><circle cx="12" cy="9" r="2"/></svg>;
const DollarSignIcon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" x2="12" y1="2" y2="22" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>;


interface SchoolDetailsPageProps {
    schoolId: string;
    setActiveView: (view: ActiveView) => void;
}

type DetailsTab = 'students' | 'teachers' | 'classes';

const SchoolDetailsPage: React.FC<SchoolDetailsPageProps> = ({ schoolId, setActiveView }) => {
    const { getSchoolById, students, classes, users, fees } = useData();
    const { switchSchoolContext } = useAuth();
    const [activeTab, setActiveTab] = useState<DetailsTab>('students');
    
    const school = useMemo(() => getSchoolById(schoolId), [schoolId, getSchoolById]);

    const schoolData = useMemo(() => {
        if (!school) return null;
        const schoolStudents = students.filter((s: Student) => s.schoolId === school.id);
        const schoolTeachers = users.filter((u: User) => u.schoolId === school.id && u.role === UserRole.Teacher);
        const schoolClasses = classes.filter((c: Class) => c.schoolId === school.id);
        const schoolFees = fees.filter((f: FeeChallan) => schoolStudents.some(s => s.id === f.studentId));
        const totalCollection = schoolFees.reduce((sum, fee) => sum + fee.paidAmount, 0);

        return {
            students: schoolStudents,
            teachers: schoolTeachers,
            classes: schoolClasses,
            stats: {
                studentCount: schoolStudents.length,
                teacherCount: schoolTeachers.length,
                classCount: schoolClasses.length,
                totalCollection: `Rs. ${totalCollection.toLocaleString()}`,
            },
        };
    }, [school, students, classes, users, fees]);

    if (!school || !schoolData) {
        return <div className="p-8 text-center">School not found.</div>;
    }
    
    const handleViewAsAdmin = () => {
        switchSchoolContext(school.id);
        setActiveView({ view: 'dashboard' });
    };

    return (
        <div className="space-y-6">
            <button onClick={() => setActiveView({ view: 'schools' })} className="flex items-center text-sm font-medium text-secondary-600 hover:text-primary-600 dark:text-secondary-400">
                <ArrowLeftIcon className="w-4 h-4 mr-2" />
                Back to All Schools
            </button>
            
            <div className="bg-white dark:bg-secondary-800 rounded-lg shadow-md p-6">
                <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
                    {school.logoUrl ? (
                         <img src={school.logoUrl} alt={`${school.name} logo`} className="w-24 h-24 object-contain rounded-md bg-white p-2 border dark:border-secondary-700"/>
                    ) : (
                        <div className="w-24 h-24 bg-secondary-100 dark:bg-secondary-700 rounded-md flex items-center justify-center shrink-0">
                            <SchoolIcon className="w-12 h-12 text-secondary-400" />
                        </div>
                    )}
                    <div className="flex-1">
                        <h1 className="text-3xl font-bold text-secondary-900 dark:text-white">{school.name}</h1>
                        <p className="text-secondary-500 dark:text-secondary-400 mt-1">{school.address}</p>
                    </div>
                    <div>
                        <button onClick={handleViewAsAdmin} className="btn-primary">
                            View as Admin
                        </button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard title="Total Students" value={schoolData.stats.studentCount.toString()} color="bg-primary-100 dark:bg-primary-900/50 text-primary-600 dark:text-primary-300" icon={<UsersIcon />} />
                <StatCard title="Total Teachers" value={schoolData.stats.teacherCount.toString()} color="bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-300" icon={<BriefcaseIcon />} />
                <StatCard title="Total Classes" value={schoolData.stats.classCount.toString()} color="bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-300" icon={<SchoolIcon />} />
                <StatCard title="Fee Collection" value={schoolData.stats.totalCollection} color="bg-pink-100 dark:bg-pink-900/50 text-pink-600 dark:text-pink-300" icon={<DollarSignIcon />} />
            </div>

            <div className="bg-white dark:bg-secondary-800 rounded-lg shadow-md">
                <div className="border-b border-secondary-200 dark:border-secondary-700">
                    <nav className="-mb-px flex space-x-6 px-6" aria-label="Tabs">
                        <button onClick={() => setActiveTab('students')} className={`${activeTab === 'students' ? 'border-primary-500 text-primary-600' : 'border-transparent text-secondary-500 hover:text-secondary-700'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}>Students ({schoolData.students.length})</button>
                        <button onClick={() => setActiveTab('teachers')} className={`${activeTab === 'teachers' ? 'border-primary-500 text-primary-600' : 'border-transparent text-secondary-500 hover:text-secondary-700'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}>Teachers ({schoolData.teachers.length})</button>
                        <button onClick={() => setActiveTab('classes')} className={`${activeTab === 'classes' ? 'border-primary-500 text-primary-600' : 'border-transparent text-secondary-500 hover:text-secondary-700'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}>Classes ({schoolData.classes.length})</button>
                    </nav>
                </div>

                <div className="p-2 max-h-96 overflow-y-auto">
                    {activeTab === 'students' && (
                        <ul className="divide-y dark:divide-secondary-700">
                           {schoolData.students.map(student => (
                                <li key={student.id} className="p-3 flex items-center space-x-3">
                                    <Avatar student={student} className="w-9 h-9"/>
                                    <div>
                                        <p className="font-medium text-sm">{student.name}</p>
                                        <p className="text-xs text-secondary-500">Roll No: {student.rollNumber}</p>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                    {activeTab === 'teachers' && (
                        <ul className="divide-y dark:divide-secondary-700">
                           {schoolData.teachers.map(teacher => (
                                <li key={teacher.id} className="p-3 flex items-center space-x-3">
                                    <Avatar user={teacher} className="w-9 h-9"/>
                                    <div>
                                        <p className="font-medium text-sm">{teacher.name}</p>
                                        <p className="text-xs text-secondary-500">{teacher.email}</p>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                    {activeTab === 'classes' && (
                        <ul className="divide-y dark:divide-secondary-700">
                             {schoolData.classes.map(cls => (
                                <li key={cls.id} className="p-3">
                                    <p className="font-medium">{cls.name}</p>
                                </li>
                             ))}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SchoolDetailsPage;