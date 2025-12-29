import React, { useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { UserRole, FeeChallan, Attendance, Student } from '../../types';
import DoughnutChart from '../charts/DoughnutChart';
import BarChart from '../charts/BarChart';
import StatCard from '../common/StatCard';
import { ActiveView } from '../layout/Layout';
import StatCardSkeleton from '../common/skeletons/StatCardSkeleton';
import ChartSkeleton from '../common/skeletons/ChartSkeleton';
import LineChart from '../charts/LineChart';
import Modal from '../common/Modal';
import Avatar from '../common/Avatar';
import { getClassLevel } from '../../utils/sorting';
import DivergingBarChart, { DivergingBarChartData } from '../charts/DivergingBarChart';

const QuickAction: React.FC<{ title: string; icon: React.ReactElement; onClick?: () => void; }> = ({ title, icon, onClick }) => (
     <button 
        onClick={onClick} 
        disabled={!onClick}
        className="flex flex-col items-center justify-center space-y-2 p-4 bg-secondary-50 dark:bg-secondary-700 dark:bg-opacity-50 rounded-lg hover:bg-primary-100 dark:hover:bg-primary-900 dark:hover:bg-opacity-50 hover:text-primary-600 transition-all text-center disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:bg-secondary-50 dark:disabled:hover:bg-secondary-700"
    >
        {icon}
        <span className="text-sm font-medium">{title}</span>
    </button>
);

interface AdminDashboardProps {
    setActiveView: (view: ActiveView) => void;
}

const timeAgo = (timestamp?: string): string => {
    if (!timestamp) return 'Just now';
    const now = new Date();
    const past = new Date(timestamp);
    const seconds = Math.floor((now.getTime() - past.getTime()) / 1000);

    let interval = seconds / 31536000;
    if (interval > 1) return `${Math.floor(interval)} years ago`;
    interval = seconds / 2592000;
    if (interval > 1) return `${Math.floor(interval)} months ago`;
    interval = seconds / 86400;
    if (interval > 1) return `${Math.floor(interval)} days ago`;
    interval = seconds / 3600;
    if (interval > 1) return `${Math.floor(interval)} hours ago`;
    interval = seconds / 60;
    if (interval > 1) return `${Math.floor(interval)} minutes ago`;
    return `${Math.floor(seconds)} seconds ago`;
};

const getActivityIcon = (action: string) => {
    const lowerAction = action.toLowerCase();
    if (lowerAction.includes('fee') || lowerAction.includes('challan') || lowerAction.includes('payment')) {
        return <DollarSignIcon className="w-4 h-4 text-green-600 dark:text-green-300"/>;
    }
    if (lowerAction.includes('student') || lowerAction.includes('user')) {
        return <UserPlusIcon className="w-4 h-4 text-blue-600 dark:text-blue-300"/>;
    }
    if (lowerAction.includes('attendance') || lowerAction.includes('result')) {
        return <CheckCircleIcon className="w-4 h-4 text-indigo-600 dark:text-indigo-300"/>
    }
    if (lowerAction.includes('class') || lowerAction.includes('school')) {
        return <SchoolIcon className="w-4 h-4 text-purple-600 dark:text-purple-300"/>
    }
    return <BellIcon className="w-4 h-4 text-yellow-600 dark:text-yellow-300"/>;
};

const getIconBgColor = (action: string) => {
    const lowerAction = action.toLowerCase();
    if (lowerAction.includes('fee') || lowerAction.includes('challan') || lowerAction.includes('payment')) {
        return 'bg-green-100 dark:bg-green-900/50';
    }
    if (lowerAction.includes('student') || lowerAction.includes('user')) {
        return 'bg-blue-100 dark:bg-blue-900/50';
    }
    if (lowerAction.includes('attendance') || lowerAction.includes('result')) {
        return 'bg-indigo-100 dark:bg-indigo-900/50';
    }
    if (lowerAction.includes('class') || lowerAction.includes('school')) {
        return 'bg-purple-100 dark:bg-purple-900/50';
    }
    return 'bg-yellow-100 dark:bg-yellow-900/50';
};

const FeeChartHeader: React.FC<{
    title: string;
    chartType: 'line' | 'bar';
    onChartTypeChange: (type: 'line' | 'bar') => void;
    period: 'week' | '15days' | 'month' | '30days';
    onPeriodChange: (period: 'week' | '15days' | 'month' | '30days') => void;
}> = ({ title, chartType, onChartTypeChange, period, onPeriodChange }) => (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <h2 className="text-xl font-semibold">{title}</h2>
        <div className="flex items-center gap-2">
            <select
                value={period}
                onChange={(e) => onPeriodChange(e.target.value as 'week' | '15days' | 'month' | '30days')}
                className="input-field py-1 text-sm w-36"
            >
                <option value="week">This Week</option>
                <option value="15days">Last 15 Days</option>
                <option value="month">This Month</option>
                <option value="30days">Last 30 Days</option>
            </select>
            <div className="flex items-center space-x-1 rounded-lg bg-secondary-100 dark:bg-secondary-700 p-1">
                <button 
                    onClick={() => onChartTypeChange('line')} 
                    className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${chartType === 'line' ? 'bg-white dark:bg-secondary-600 shadow-sm' : 'text-secondary-600 dark:text-secondary-300'}`}
                >
                    Line
                </button>
                <button 
                    onClick={() => onChartTypeChange('bar')} 
                    className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${chartType === 'bar' ? 'bg-white dark:bg-secondary-600 shadow-sm' : 'text-secondary-600 dark:text-secondary-300'}`}
                >
                    Bar
                </button>
            </div>
        </div>
    </div>
);


const AdminDashboard: React.FC<AdminDashboardProps> = ({ setActiveView }) => {
    const { user, activeSchoolId } = useAuth();
    const { users, students, getSchoolById, fees, attendance, loading, logs, classes } = useData();
    
    const [modalDetails, setModalDetails] = useState<{ title: string; items: { id: string; avatar: React.ReactNode; primary: string; secondary: React.ReactNode }[] } | null>(null);
    const [feeChartType, setFeeChartType] = useState<'line' | 'bar'>('line');
    const [feePeriod, setFeePeriod] = useState<'week' | '15days' | 'month' | '30days'>('week');

    if (!user) return null;
    
    const effectiveSchoolId = user.role === UserRole.Owner && activeSchoolId ? activeSchoolId : user.schoolId;
    const school = effectiveSchoolId != null ? getSchoolById(effectiveSchoolId) : null;
    
    const schoolStudents = useMemo(() => students.filter(s => s.schoolId === effectiveSchoolId && s.status === 'Active'), [students, effectiveSchoolId]);
    const schoolTeachers = useMemo(() => users.filter(u => u.schoolId === effectiveSchoolId && u.role === UserRole.Teacher), [users, effectiveSchoolId]);
    const schoolUsers = useMemo(() => users.filter(u => u.schoolId === effectiveSchoolId && u.id !== user.id), [users, effectiveSchoolId, user.id]);

    const stats = useMemo(() => {
        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        const schoolFees = fees.filter(fee => {
            const student = students.find(s => s.id === fee.studentId);
            return student?.schoolId === effectiveSchoolId;
        });

        const feesCollectedToday = schoolFees
            .filter(f => f.paidDate === todayStr)
            .reduce((sum, f) => sum + f.paidAmount, 0);

        const collectedThisMonth = schoolFees
            .filter(f => f.paidDate && new Date(f.paidDate).getMonth() === currentMonth && new Date(f.paidDate).getFullYear() === currentYear)
            .reduce((sum, f) => sum + f.paidAmount, 0);

        const outstandingChallans = schoolFees.filter(f => f.status === 'Unpaid' || f.status === 'Partial');
        const totalOutstandingDues = outstandingChallans.reduce((sum, f) => {
            const balance = f.totalAmount - f.discount - f.paidAmount;
            return sum + balance;
        }, 0);
            
        const pendingApprovals = schoolUsers.filter(u => u.status === 'Pending Approval').length;
        const totalPaidChallans = schoolFees.filter(f => f.status === 'Paid').length;
        
        return {
            feesCollectedToday: `Rs. ${feesCollectedToday.toLocaleString()}`,
            pendingApprovals: pendingApprovals.toString(),
            collectedThisMonth: `Rs. ${collectedThisMonth.toLocaleString()}`,
            totalPaidChallans: totalPaidChallans.toLocaleString(),
            totalOutstandingDues: `Rs. ${totalOutstandingDues.toLocaleString()}`,
            totalUnpaidChallans: outstandingChallans.length.toLocaleString(),
        };
    }, [fees, students, schoolUsers, effectiveSchoolId]);


    const feeStatusData = useMemo(() => {
        const schoolFees = fees.filter(fee => {
            const student = students.find(s => s.id === fee.studentId);
            return student?.schoolId === effectiveSchoolId;
        });

        const statusCounts = schoolFees.reduce((acc, fee) => {
            acc[fee.status] = (acc[fee.status] || 0) + 1;
            return acc;
        }, {} as Record<FeeChallan['status'], number>);
        
        const statusColors: Record<FeeChallan['status'], string> = {
            Paid: '#10b981',
            Unpaid: '#ef4444',
            Partial: '#f59e0b',
            Cancelled: '#64748b'
        };

        return (['Paid', 'Unpaid', 'Partial'] as const).map(status => ({
            label: status,
            value: statusCounts[status] || 0,
            color: statusColors[status]
        }));

    }, [fees, students, effectiveSchoolId]);

    const attendanceData = useMemo(() => {
        const todayStr = new Date().toISOString().split('T')[0];
        const todaysAttendance = attendance.filter(a => a.date === todayStr);
        const attendanceMap = new Map(todaysAttendance.map(a => [a.studentId, a.status]));
    
        const statusCounts = { Present: 0, Absent: 0, Leave: 0, Pending: 0 };
        schoolStudents.forEach(student => {
            const status = attendanceMap.get(student.id);
            if (status) {
                statusCounts[status]++;
            } else {
                statusCounts.Pending++;
            }
        });
    
        return [
            { label: 'Present', value: statusCounts.Present, color: '#10b981' },
            { label: 'Absent', value: statusCounts.Absent, color: '#ef4444' },
            { label: 'Leave', value: statusCounts.Leave, color: '#f59e0b' },
            { label: 'Pending', value: statusCounts.Pending, color: '#64748b' },
        ];
    }, [attendance, schoolStudents]);

    const feeCollectionData = useMemo(() => {
        const schoolFees = fees.filter(fee => students.find(s => s.id === fee.studentId)?.schoolId === effectiveSchoolId);
        const collectionsByDay: Record<string, number> = {};
        schoolFees.forEach(fee => {
            if (fee.paidDate) {
                collectionsByDay[fee.paidDate] = (collectionsByDay[fee.paidDate] || 0) + fee.paidAmount;
            }
        });

        const toYMD = (date: Date) => {
            return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        };
    
        if (feePeriod === 'week') {
            const now = new Date();
            const currentDay = now.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
            const firstDayOfWeek = new Date(now);
            firstDayOfWeek.setDate(now.getDate() - currentDay);
            firstDayOfWeek.setHours(0, 0, 0, 0); // Normalize to start of the day
    
            const weekDays = [...Array(7)].map((_, i) => {
                const d = new Date(firstDayOfWeek);
                d.setDate(firstDayOfWeek.getDate() + i);
                return d;
            });
            
            return weekDays.map(date => {
                const dateStr = toYMD(date);
                return {
                    label: `${date.getDate()}/${date.getMonth() + 1}`,
                    value: collectionsByDay[dateStr] || 0
                };
            });
        }
        
        if (feePeriod === '15days') {
            const last15Days = [...Array(15)].map((_, i) => {
                const d = new Date();
                d.setDate(d.getDate() - i);
                return d;
            }).reverse();
    
            return last15Days.map(date => {
                const dateStr = toYMD(date);
                return {
                    label: date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' }),
                    value: collectionsByDay[dateStr] || 0
                };
            });
        }
    
        if (feePeriod === 'month') {
            const now = new Date();
            const year = now.getFullYear();
            const month = now.getMonth();
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            const monthDays = [...Array(daysInMonth)].map((_, i) => new Date(year, month, i + 1));
    
            return monthDays.map(date => {
                const dateStr = toYMD(date);
                return {
                    label: String(date.getDate()),
                    value: collectionsByDay[dateStr] || 0
                };
            });
        }
    
        // Default to '30days'
        const last30Days = [...Array(30)].map((_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - i);
            return d;
        }).reverse();
    
        return last30Days.map(date => {
            const dateStr = toYMD(date);
            return {
                label: date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' }),
                value: collectionsByDay[dateStr] || 0
            };
        });
    }, [fees, students, effectiveSchoolId, feePeriod]);
    
    const classStrengthData = useMemo(() => {
        if (!effectiveSchoolId) return [];
        const schoolClasses = classes.filter(c => c.schoolId === effectiveSchoolId);

        const sortedClasses = [...schoolClasses].sort((a, b) => (a.sortOrder ?? Infinity) - (b.sortOrder ?? Infinity) || getClassLevel(a.name) - getClassLevel(b.name));
    
        return sortedClasses.map(c => {
                const studentsInClass = schoolStudents.filter(s => s.classId === c.id);
                const maleCount = studentsInClass.filter(s => s.gender === 'Male').length;
                const femaleCount = studentsInClass.filter(s => s.gender === 'Female').length;
                
                return {
                    id: c.id,
                    label: `${c.name}${c.section ? `-${c.section}` : ''}`,
                    value1: maleCount,
                    value2: femaleCount,
                };
            });
    }, [classes, schoolStudents, effectiveSchoolId]);

    const recentLogs = useMemo(() => {
        return logs.slice(0, 5);
    }, [logs]);

    const handleFeeStatusClick = (item: { label: string }) => {
        const status = item.label as FeeChallan['status'];
        const relevantChallans = fees.filter(f => {
            const student = students.find(s => s.id === f.studentId);
            return student?.schoolId === effectiveSchoolId && f.status === status;
        });

        const items = relevantChallans.map(c => {
            const student = students.find(s => s.id === c.studentId);
            return {
                id: c.id,
                avatar: <Avatar student={student} className="w-9 h-9" />,
                primary: student?.name || 'Unknown Student',
                secondary: <>{c.month} {c.year} - Balance: Rs. {(c.totalAmount - c.discount - c.paidAmount).toLocaleString()}</>,
            };
        });

        setModalDetails({ title: `${status} Challans`, items });
    };

    const handleAttendanceClick = (item: { label: string }) => {
        const status = item.label;
        const todayStr = new Date().toISOString().split('T')[0];
        const todaysAttendanceRecords = attendance.filter(a => a.date === todayStr);
        const todaysAttendanceMap = new Map(todaysAttendanceRecords.map(a => [a.studentId, a.status]));

        let relevantStudents: Student[] = [];
        if (status === 'Pending') {
            relevantStudents = schoolStudents.filter(s => !todaysAttendanceMap.has(s.id));
        } else {
            relevantStudents = schoolStudents.filter(s => todaysAttendanceMap.get(s.id) === (status as Attendance['status']));
        }

        const items = relevantStudents.map(s => ({
            id: s.id,
            avatar: <Avatar student={s} className="w-9 h-9" />,
            primary: s.name,
            secondary: <>ID: <span className="font-bold text-primary-700 dark:text-primary-400">{s.rollNumber}</span></>,
        }));

        setModalDetails({ title: `Students: ${status}`, items });
    };

    const handleClassStrengthClick = (item: DivergingBarChartData) => {
        setActiveView({ view: 'students', payload: { classFilter: item.id } });
    };

    if (loading) {
        return (
            <div className="space-y-8">
                <div>
                    <div className="skeleton-bg h-9 w-64 mb-2 rounded"></div>
                    <div className="skeleton-bg h-5 w-80 rounded"></div>
                </div>
               
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {[...Array(8)].map((_, i) => <StatCardSkeleton key={i} />)}
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <ChartSkeleton />
                    <ChartSkeleton />
                </div>
    
                <div className="bg-white dark:bg-secondary-800 p-6 rounded-xl shadow-lg">
                    <div className="skeleton-bg h-6 w-48 mb-4 rounded"></div>
                    <div className="skeleton-bg h-48 w-full rounded"></div>
                </div>
            </div>
        );
    }

    return (
        <>
            <Modal isOpen={!!modalDetails} onClose={() => setModalDetails(null)} title={modalDetails?.title || ''}>
                <div className="max-h-[60vh] overflow-y-auto">
                    <ul className="divide-y dark:divide-secondary-700">
                        {modalDetails?.items.map(item => (
                            <li key={item.id} className="py-3 flex items-center space-x-4">
                                {item.avatar}
                                <div>
                                    <p className="font-medium text-secondary-800 dark:text-secondary-100">{item.primary}</p>
                                    <div className="text-sm text-secondary-500">{item.secondary}</div>
                                </div>
                            </li>
                        ))}
                        {modalDetails?.items.length === 0 && (
                            <p className="text-secondary-500 text-center py-4">No records found.</p>
                        )}
                    </ul>
                </div>
            </Modal>
            <div className="space-y-8">
                <div>
                    <h1 className="text-3xl font-bold text-secondary-900 dark:text-white">Admin Dashboard</h1>
                    <p className="text-secondary-500 dark:text-secondary-400">Welcome back, {user.name}. Here's what's happening at {school?.name}.</p>
                </div>
            
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    <StatCard title="Total Students" value={schoolStudents.length.toString()} color="bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300" icon={<UsersIcon />} />
                    <StatCard title="Total Teachers" value={schoolTeachers.length.toString()} color="bg-cyan-100 dark:bg-cyan-900/50 text-cyan-600 dark:text-cyan-300" icon={<BriefcaseIcon />} />
                    <StatCard title="Pending Approvals" value={stats.pendingApprovals} color="bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-300" icon={<UserCheckIcon />} />
                    <StatCard title="Fees Collected Today" value={stats.feesCollectedToday} color="bg-orange-100 dark:bg-orange-900/50 text-orange-600 dark:text-orange-300" icon={<DollarSignIcon />} />
                    
                    <StatCard title="Collected This Month" value={stats.collectedThisMonth} color="bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-300" icon={<TrendingUpIcon />} />
                    <StatCard title="Total Outstanding Dues" value={stats.totalOutstandingDues} color="bg-yellow-100 dark:bg-yellow-900/50 text-yellow-600 dark:text-yellow-300" icon={<FileTextIcon />} />
                    <StatCard title="Paid Challans" value={stats.totalPaidChallans} color="bg-teal-100 dark:bg-teal-900/50 text-teal-600 dark:text-teal-300" icon={<CheckSquareIcon />} />
                    <StatCard title="Unpaid Challans" value={stats.totalUnpaidChallans} color="bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-300" icon={<AlertCircleIcon />} />
                </div>

                <div className="bg-white dark:bg-secondary-800 p-6 rounded-xl shadow-lg">
                    <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                        <QuickAction title="Add Student" icon={<UserPlusIcon className="w-8 h-8"/>} onClick={() => setActiveView({ view: 'students' })} />
                        <QuickAction title="Mark Attendance" icon={<CheckCircleIcon className="w-8 h-8"/>} onClick={() => setActiveView({ view: 'attendance' })} />
                        <QuickAction title="Generate Challans" icon={<FilePlusIcon className="w-8 h-8"/>} onClick={() => setActiveView({ view: 'fees' })} />
                        <QuickAction title="Enter Results" icon={<BarChartIcon className="w-8 h-8"/>} onClick={() => setActiveView({ view: 'results' })} />
                        <QuickAction title="Scan & Pay" icon={<ScanIcon className="w-8 h-8"/>} onClick={() => setActiveView({ view: 'scan-pay' })} />
                        <QuickAction title="View Reports" icon={<FileTextIcon className="w-8 h-8"/>} onClick={() => setActiveView({ view: 'reports' })} />
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                    <div className="lg:col-span-3">
                        {feeChartType === 'line' ? (
                            <LineChart
                                title={<FeeChartHeader title="Fee Collection" chartType={feeChartType} onChartTypeChange={setFeeChartType} period={feePeriod} onPeriodChange={setFeePeriod} />}
                                data={feeCollectionData}
                                color="#10b981"
                            />
                        ) : (
                             <BarChart
                                title={<FeeChartHeader title="Fee Collection" chartType={feeChartType} onChartTypeChange={setFeeChartType} period={feePeriod} onPeriodChange={setFeePeriod} />}
                                data={feeCollectionData}
                                color="#10b981"
                            />
                        )}
                    </div>
                    <div className="lg:col-span-2">
                         <DoughnutChart
                            title="Fee Status Overview"
                            data={feeStatusData}
                            onClick={handleFeeStatusClick}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                    <div className="lg:col-span-3">
                        <DivergingBarChart
                            title="Class Strength (Male vs Female)"
                            data={classStrengthData}
                            labels={{ value1: 'Male', value2: 'Female' }}
                            colors={{ value1: '#3b82f6', value2: '#ec4899' }}
                            onClick={handleClassStrengthClick}
                        />
                    </div>
                     <div className="lg:col-span-2">
                        <DoughnutChart
                            title="Today's Attendance Snapshot"
                            data={attendanceData}
                            onClick={handleAttendanceClick}
                        />
                    </div>
                </div>

                <div className="bg-white dark:bg-secondary-800 p-6 rounded-xl shadow-lg">
                    <h2 className="text-xl font-semibold mb-4">Recent Activity</h2>
                    <ul className="divide-y dark:divide-secondary-700">
                        {recentLogs.map(log => (
                            <li key={log.id} className="py-3 flex items-center space-x-4">
                                <span className={`p-2 rounded-full ${getIconBgColor(log.action)}`}>
                                    {getActivityIcon(log.action)}
                                </span>
                                <div className="flex-1">
                                    <p className="font-medium text-sm text-secondary-800 dark:text-secondary-100">{log.action}</p>
                                    <p className="text-xs text-secondary-500">{log.details}</p>
                                </div>
                                <div className="text-xs text-secondary-400 text-right">
                                    <p>{log.userName}</p>
                                    <p>{timeAgo(log.timestamp)}</p>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </>
    );
};

// Icons
const UsersIcon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9"cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
const BriefcaseIcon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="7" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>;
const UserCheckIcon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><polyline points="16 11 18 13 22 9"/></svg>;
const DollarSignIcon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" x2="12" y1="2" y2="22" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>;
const TrendingUpIcon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>;
const FileTextIcon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" /><line x1="16" x2="8" y1="13" y2="13" /><line x1="16" x2="8" y1="17" y2="17" /><line x1="10" x2="8" y1="9" y2="9" /></svg>;
const CheckSquareIcon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>;
const AlertCircleIcon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>;
const UserPlusIcon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" x2="19" y1="8" y2="14"/><line x1="22" x2="16" y1="11" y2="11"/></svg>;
const CheckCircleIcon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>;
const FilePlusIcon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" /><line x1="12" y1="18" x2="12" y2="12" /><line x1="9" y1="15" x2="15" y2="15" /></svg>;
const BarChartIcon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" x2="12" y1="20" y2="10" /><line x1="18" x2="18" y1="20" y2="4" /><line x1="6" x2="6" y1="20" y2="16" /></svg>;
const ScanIcon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><path d="M7 12h10"/></svg>;
const SchoolIcon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m4 6 8-4 8 4"/><path d="m18 10 4 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-8l4-2"/><path d="M14 22v-4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v4"/><path d="M18 5v17"/><path d="M6 5v17"/><circle cx="12" cy="9" r="2"/></svg>;
const BellIcon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>;

export default AdminDashboard;