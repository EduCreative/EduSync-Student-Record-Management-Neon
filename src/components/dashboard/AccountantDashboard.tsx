import React, { useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import StatCard from '../common/StatCard';
import StatCardSkeleton from '../common/skeletons/StatCardSkeleton';
import BarChart from '../charts/BarChart';
import DoughnutChart from '../charts/DoughnutChart';
import ChartSkeleton from '../common/skeletons/ChartSkeleton';

const QuickAction: React.FC<{ title: string; icon: React.ReactElement; }> = ({ title, icon }) => (
     <button className="flex flex-col items-center justify-center space-y-2 p-4 bg-secondary-50 dark:bg-secondary-700 dark:bg-opacity-50 rounded-lg hover:bg-primary-100 dark:hover:bg-primary-900 dark:hover:bg-opacity-50 hover:text-primary-600 transition-all text-center">
        {icon}
        <span className="text-sm font-medium">{title}</span>
    </button>
);


const AccountantDashboard: React.FC = () => {
    const { user } = useAuth();
    const { getSchoolById, fees, students, loading } = useData();

    if (!user) return null;
    const school = user.schoolId != null ? getSchoolById(user.schoolId) : null;

    const stats = useMemo(() => {
        const schoolFees = fees.filter(fee => {
            const student = students.find(s => s.id === fee.studentId);
            return student?.schoolId === user.schoolId;
        });

        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        const collectedThisMonth = schoolFees
            .filter(f => f.paidDate && new Date(f.paidDate).getMonth() === currentMonth && new Date(f.paidDate).getFullYear() === currentYear)
            .reduce((sum, f) => sum + f.paidAmount, 0);

        const unpaidChallans = schoolFees.filter(f => f.status === 'Unpaid' || f.status === 'Partial');
        
        const overdueInvoices = unpaidChallans.filter(f => new Date(f.dueDate) < now).length;
        
        const totalStudentsInSchool = students.filter(s => s.schoolId === user.schoolId).length;

        return {
            collectedThisMonth: `Rs. ${collectedThisMonth.toLocaleString()}`,
            totalUnpaidChallans: unpaidChallans.length.toString(),
            overdueInvoices: overdueInvoices.toString(),
            totalStudentsInSchool: totalStudentsInSchool.toString(),
        };
    }, [fees, students, user.schoolId]);

    const monthlyCollection = useMemo(() => {
        const schoolFees = fees.filter(fee => students.find(s => s.id === fee.studentId)?.schoolId === user.schoolId);
        const collections: Record<string, number> = {};
    
        for (let i = 5; i >= 0; i--) {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            const monthKey = d.toLocaleString('default', { month: 'short', year: '2-digit' });
            collections[monthKey] = 0;
        }
    
        schoolFees.forEach(fee => {
            if(fee.paidDate) {
                const d = new Date(fee.paidDate);
                const monthKey = d.toLocaleString('default', { month: 'short', year: '2-digit' });
                if (monthKey in collections) {
                    collections[monthKey] += fee.paidAmount;
                }
            }
        });
    
        return Object.entries(collections).map(([label, value]) => ({ label, value }));
    }, [fees, students, user.schoolId]);
    
    const outstandingFees = useMemo(() => {
        const schoolFees = fees.filter(fee => students.find(s => s.id === fee.studentId)?.schoolId === user.schoolId);
        const unpaid = schoolFees.filter(f => f.status === 'Unpaid').length;
        const partial = schoolFees.filter(f => f.status === 'Partial').length;
        return [
            { label: 'Unpaid', value: unpaid, color: '#ef4444' },
            { label: 'Partial', value: partial, color: '#f59e0b' },
        ];
    }, [fees, students, user.schoolId]);

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
                    <div className="skeleton-bg h-6 w-48 mb-4 rounded"></div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="skeleton-bg h-24 rounded-lg"></div>
                        <div className="skeleton-bg h-24 rounded-lg"></div>
                        <div className="skeleton-bg h-24 rounded-lg"></div>
                        <div className="skeleton-bg h-24 rounded-lg"></div>
                    </div>
                </div>
            </div>
        );
    }


    return (
        <div className="space-y-8">
             <div>
                 <h1 className="text-3xl font-bold text-secondary-900 dark:text-white">Accountant Dashboard</h1>
                 <p className="text-secondary-500 dark:text-secondary-400">Manage finances for {school?.name}.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard title="Collected This Month" value={stats.collectedThisMonth} color="bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-300" icon={<DollarSignIcon />} />
                <StatCard title="Total Unpaid Challans" value={stats.totalUnpaidChallans} color="bg-yellow-100 dark:bg-yellow-900/50 text-yellow-600 dark:text-yellow-300" icon={<FileTextIcon />} />
                <StatCard title="Overdue Invoices" value={stats.overdueInvoices} color="bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-300" icon={<AlertCircleIcon />} />
                <StatCard title="Total Students" value={stats.totalStudentsInSchool} color="bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300" icon={<UsersIcon />} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <BarChart title="Monthly Fee Collection (Last 6 Months)" data={monthlyCollection} multiColor={true} />
                <DoughnutChart title="Outstanding Fees" data={outstandingFees} />
            </div>

            <div className="bg-white dark:bg-secondary-800 p-6 rounded-xl shadow-lg">
                <h2 className="text-xl font-semibold mb-4">Financial Actions</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <QuickAction title="Generate Challans" icon={<FilePlusIcon className="w-8 h-8"/>} />
                    <QuickAction title="Record Payment" icon={<CreditCardIcon className="w-8 h-8"/>} />
                    <QuickAction title="Defaulters Report" icon={<BarChartIcon className="w-8 h-8"/>} />
                    <QuickAction title="Issue Certificate" icon={<AwardIcon className="w-8 h-8"/>} />
                </div>
            </div>
        </div>
    );
};

// Icons
const DollarSignIcon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" x2="12" y1="2" y2="22" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>;
const FileTextIcon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" /><line x1="16" x2="8" y1="13" y2="13" /><line x1="16" x2="8" y1="17" y2="17" /><line x1="10" x2="8" y1="9" y2="9" /></svg>;
const AlertCircleIcon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>;
const UsersIcon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
const FilePlusIcon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" /><line x1="12" y1="18" x2="12" y2="12" /><line x1="9" y1="15" x2="15" y2="15" /></svg>;
const CreditCardIcon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="5" rx="2" /><line x1="2" x2="22" y1="10" y2="10" /></svg>;
const BarChartIcon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" x2="12" y1="20" y2="10" /><line x1="18" x2="18" y1="20" y2="4" /><line x1="6" x2="6" y1="20" y2="16" /></svg>;
const AwardIcon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="7" /><polyline points="8.21 13.89 7 23 12 17 17 23 15.79 13.88" /></svg>;

export default AccountantDashboard;