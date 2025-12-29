import React, { useState } from 'react';
import ReportCardModal from './ReportCardModal';
import BulkChallanReportModal from './BulkChallanReportModal';
import ClassListReportModal from './ClassListReportModal';
import DefaulterReportModal from './DefaulterReportModal';
import FeeCollectionReportModal from './FeeCollectionReportModal';
import { useAuth } from '../../context/AuthContext';
import { Permission } from '../../permissions';
import ChallanRangeReportModal from './ChallanRangeReportModal';
import StudentIdCardModal from './StudentIdCardModal';
import AttendanceReportModal from './AttendanceReportModal';
import MissingDataReportModal from './MissingDataReportModal';

type ReportType = 'feeCollection' | 'defaulter' | 'classList' | 'bulkChallan' | 'reportCard' | 'challanRange' | 'studentIdCard' | 'attendance' | 'missingData';

interface ReportsPageProps {}

const ReportCard: React.FC<{ title: string; description: string; icon: React.ReactElement; onGenerate: () => void; }> = ({ title, description, icon, onGenerate }) => (
    <div className="bg-white dark:bg-secondary-800 p-6 rounded-xl shadow-lg border border-secondary-200 dark:border-secondary-700">
        <div className="flex items-start space-x-4">
            <div className="p-3 rounded-full bg-primary-100 dark:bg-primary-900/50 text-primary-600 dark:text-primary-300">
                {icon}
            </div>
            <div>
                <h3 className="text-lg font-semibold">{title}</h3>
                <p className="text-sm text-secondary-500 dark:text-secondary-400 mt-1">{description}</p>
                 <button onClick={onGenerate} className="mt-4 text-sm font-medium text-primary-600 hover:underline">
                    Generate Report &rarr;
                </button>
            </div>
        </div>
    </div>
);


const ReportsPage: React.FC<ReportsPageProps> = () => {
    const [activeReport, setActiveReport] = useState<ReportType | null>(null);
    const { hasPermission } = useAuth();
    
    const allReports = [
        { 
            id: 'feeCollection' as ReportType,
            title: "Fee Collection Report", 
            description: "View total fees collected within a specific date range.", 
            icon: <DollarSignIcon className="w-6 h-6" />,
        },
        { 
            id: 'defaulter' as ReportType,
            title: "Fee Defaulter Report", 
            description: "List all students with unpaid or partially paid fees.", 
            icon: <AlertTriangleIcon className="w-6 h-6" />,
        },
        { 
            id: 'classList' as ReportType,
            title: "Printable Class Lists", 
            description: "Generate and print lists of students for any class.", 
            icon: <UsersIcon className="w-6 h-6" />,
        },
        { 
            id: 'attendance' as ReportType,
            title: "Attendance Report",
            description: "Generate an attendance sheet for a class over a date range.",
            icon: <CheckSquareIcon className="w-6 h-6" />,
        },
         { 
            id: 'bulkChallan' as ReportType,
            title: "Bulk Fee Challans", 
            description: "Print three-part fee challans for an entire class.", 
            icon: <FileTextIcon className="w-6 h-6" />,
        },
        { 
            id: 'challanRange' as ReportType,
            title: "Print Challan Range",
            description: "Print a specific range of fee challans by number.",
            icon: <PrinterIcon className="w-6 h-6" />,
        },
         { 
            id: 'reportCard' as ReportType,
            title: "Student Report Cards", 
            description: "Generate and print detailed report cards for students.", 
            icon: <AwardIcon className="w-6 h-6" />,
        },
        { 
            id: 'studentIdCard' as ReportType,
            title: "Student ID Cards",
            description: "Generate and print professional ID cards for an entire class.",
            icon: <IdCardIcon className="w-6 h-6" />,
        },
        { 
            id: 'missingData' as ReportType,
            title: "Missing Data Report",
            description: "Identify students with incomplete profile information.",
            icon: <FileWarningIcon className="w-6 h-6" />,
        },
    ];

    const availableReports = allReports.filter(report => {
        switch (report.id) {
            case 'feeCollection':
            case 'defaulter':
                return hasPermission(Permission.CAN_VIEW_FINANCIAL_REPORTS);
            case 'classList':
            case 'missingData':
                return hasPermission(Permission.CAN_VIEW_STUDENTS);
            case 'bulkChallan':
            case 'challanRange':
                return hasPermission(Permission.CAN_MANAGE_FEES);
            case 'reportCard':
            case 'attendance':
                return hasPermission(Permission.CAN_VIEW_ACADEMIC_REPORTS);
            case 'studentIdCard':
                return hasPermission(Permission.CAN_GENERATE_ID_CARDS);
            default:
                return false;
        }
    });

    return (
        <>
            <FeeCollectionReportModal isOpen={activeReport === 'feeCollection'} onClose={() => setActiveReport(null)} />
            <DefaulterReportModal isOpen={activeReport === 'defaulter'} onClose={() => setActiveReport(null)} />
            <ClassListReportModal isOpen={activeReport === 'classList'} onClose={() => setActiveReport(null)} />
            <BulkChallanReportModal isOpen={activeReport === 'bulkChallan'} onClose={() => setActiveReport(null)} />
            <ChallanRangeReportModal isOpen={activeReport === 'challanRange'} onClose={() => setActiveReport(null)} />
            <ReportCardModal isOpen={activeReport === 'reportCard'} onClose={() => setActiveReport(null)} />
            <StudentIdCardModal isOpen={activeReport === 'studentIdCard'} onClose={() => setActiveReport(null)} />
            <AttendanceReportModal isOpen={activeReport === 'attendance'} onClose={() => setActiveReport(null)} />
            <MissingDataReportModal isOpen={activeReport === 'missingData'} onClose={() => setActiveReport(null)} />

            <div className="space-y-6">
                <h1 className="text-3xl font-bold text-secondary-900 dark:text-white">Reports Center</h1>
                <p className="text-secondary-600 dark:text-secondary-400">
                    Generate, view, and print important school documents from one place.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {availableReports.map(report => (
                        <ReportCard key={report.title} {...report} onGenerate={() => setActiveReport(report.id)} />
                    ))}
                </div>
            </div>
        </>
    );
};

// Icons
const DollarSignIcon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="2" x2="12" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>;
const AlertTriangleIcon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>;
const UsersIcon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
const FileTextIcon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/><line x1="10" x2="8" y1="9" y2="9"/></svg>;
const AwardIcon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 17 17 23 15.79 13.88"/></svg>;
const PrinterIcon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect width="12" height="8" x="6" y="14" /></svg>;
const IdCardIcon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><circle cx="8" cy="10" r="2"/><path d="M14 14a2 2 0 0 0-2-2h-2"/><path d="M14 10h4"/><path d="M14 14h4"/></svg>;
const CheckSquareIcon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>;
const FileWarningIcon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>;


export default ReportsPage;