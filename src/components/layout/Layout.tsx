
import React, { useState, Suspense, lazy } from 'react';
import Header from './Header';
import Sidebar from './Sidebar';
import Dashboard from '../dashboard/Dashboard';
import { useAuth } from '../../context/AuthContext';
import { useSync } from '../../context/SyncContext';
import { UserRole } from '../../types';
import ToastContainer from '../common/ToastContainer';
import AboutModal from '../common/AboutModal';
import { useData } from '../../context/DataContext';
import OperationProgressOverlay from '../common/OperationProgressOverlay';

// Lazy-loaded page components for fast initial load
const UserManagementPage = lazy(() => import('../users/UserManagementPage'));
const StudentManagementPage = lazy(() => import('../students/StudentManagementPage'));
const StudentProfilePage = lazy(() => import('../students/StudentProfilePage'));
const SettingsPage = lazy(() => import('../settings/SettingsPage'));
const AttendancePage = lazy(() => import('../attendance/AttendancePage'));
const FeeManagementPage = lazy(() => import('../fees/FeeManagementPage'));
const ResultsPage = lazy(() => import('../results/ResultsPage'));
const UserLogsPage = lazy(() => import('../user-logs/UserLogsPage'));
const CalendarPage = lazy(() => import('../calendar/CalendarPage'));
const LeavingCertificatePage = lazy(() => import('../students/LeavingCertificatePage'));
const ReportsPage = lazy(() => import('../reports/ReportsPage'));
const TeacherManagementPage = lazy(() => import('../teachers/TeacherManagementPage'));
const AccountantManagementPage = lazy(() => import('../accountants/AccountantManagementPage'));
const ClassManagementPage = lazy(() => import('../classes/ClassManagementPage'));
const UserProfilePage = lazy(() => import('../users/UserProfilePage'));
const ChallanScannerPage = lazy(() => import('../challan-scanner/ChallanScannerPage'));
const AnnouncementsPage = lazy(() => import('../announcements/AnnouncementsPage'));

const PageLoadingFallback: React.FC = () => (
    <div className="flex items-center justify-center p-12 min-h-[300px]">
        <div className="w-8 h-8 border-3 border-primary-600 border-t-transparent rounded-full animate-spin dark:border-primary-400 dark:border-t-transparent" />
    </div>
);

export type ViewType = 'dashboard' | 'overview' | 'users' | 'students' | 'studentProfile' | 'teachers' | 'accountants' | 'classes' | 'schools' | 'schoolDetails' | 'settings' | 'results' | 'logs' | 'attendance' | 'fees' | 'calendar' | 'leavingCertificate' | 'reports' | 'userProfile' | 'scan-pay' | 'announcements' | string;

export interface ActiveView {
    view: ViewType;
    payload?: any;
}

const Layout: React.FC = () => {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [activeView, setActiveView] = useState<ActiveView>({ view: 'dashboard' });
    const { effectiveRole } = useAuth();
    const { operationProgress } = useData();
    const { isOnline } = useSync();
    const [isAboutModalOpen, setIsAboutModalOpen] = useState(false);

    const renderContent = () => {
        switch (activeView.view) {
            case 'schools':
            case 'schoolDetails':
                return <SettingsPage />;
            case 'users':
                 if ([UserRole.Owner, UserRole.Admin].includes(effectiveRole as UserRole)) {
                    return <UserManagementPage payload={activeView.payload} />;
                }
                return <Dashboard setActiveView={setActiveView} />;
            case 'teachers':
                if ([UserRole.Owner, UserRole.Admin].includes(effectiveRole as UserRole)) {
                    return <TeacherManagementPage />;
                }
                return <Dashboard setActiveView={setActiveView} />;
            case 'accountants':
                if ([UserRole.Owner, UserRole.Admin].includes(effectiveRole as UserRole)) {
                    return <AccountantManagementPage />;
                }
                return <Dashboard setActiveView={setActiveView} />;
            case 'classes':
                if ([UserRole.Owner, UserRole.Admin, UserRole.Teacher].includes(effectiveRole as UserRole)) {
                    return <ClassManagementPage />;
                }
                return <Dashboard setActiveView={setActiveView} />;
            case 'students':
                if ([UserRole.Owner, UserRole.Admin, UserRole.Accountant, UserRole.Teacher].includes(effectiveRole as UserRole)) {
                     return <StudentManagementPage setActiveView={setActiveView} />;
                }
                return <Dashboard setActiveView={setActiveView} />;
            case 'studentProfile':
                if (activeView.payload?.studentId) {
                    return <StudentProfilePage studentId={activeView.payload.studentId} setActiveView={setActiveView} />;
                }
                return <StudentManagementPage setActiveView={setActiveView} />;
            case 'leavingCertificate':
                if (activeView.payload?.studentId && [UserRole.Owner, UserRole.Admin, UserRole.Accountant].includes(effectiveRole as UserRole)) {
                    return <LeavingCertificatePage studentId={activeView.payload.studentId} setActiveView={setActiveView} />;
                }
                return <Dashboard setActiveView={setActiveView} />;
            case 'attendance':
                if ([UserRole.Owner, UserRole.Admin, UserRole.Accountant, UserRole.Teacher, UserRole.Parent, UserRole.Student].includes(effectiveRole as UserRole)) {
                    return <AttendancePage />;
                }
                return <Dashboard setActiveView={setActiveView} />;
            case 'fees':
                if ([UserRole.Owner, UserRole.Admin, UserRole.Accountant, UserRole.Parent, UserRole.Student].includes(effectiveRole as UserRole)) {
                    return <FeeManagementPage />;
                }
                return <Dashboard setActiveView={setActiveView} />;
            case 'scan-pay':
                if ([UserRole.Owner, UserRole.Admin, UserRole.Accountant].includes(effectiveRole as UserRole)) {
                    return <ChallanScannerPage />;
                }
                return <Dashboard setActiveView={setActiveView} />;
            case 'reports':
                if ([UserRole.Owner, UserRole.Admin, UserRole.Accountant].includes(effectiveRole as UserRole)) {
                    return <ReportsPage />;
                }
                return <Dashboard setActiveView={setActiveView} />;
            case 'results':
                if ([UserRole.Owner, UserRole.Admin, UserRole.Teacher, UserRole.Parent, UserRole.Student].includes(effectiveRole as UserRole)) {
                    return <ResultsPage />;
                }
                return <Dashboard setActiveView={setActiveView} />;
            case 'calendar':
                 if ([UserRole.Owner, UserRole.Admin, UserRole.Teacher, UserRole.Parent, UserRole.Student].includes(effectiveRole as UserRole)) {
                    return <CalendarPage />;
                }
                return <Dashboard setActiveView={setActiveView} />;
            case 'logs':
                if ([UserRole.Owner, UserRole.Admin].includes(effectiveRole as UserRole)) {
                    return <UserLogsPage />;
                }
                return <Dashboard setActiveView={setActiveView} />;
            case 'announcements':
                return <AnnouncementsPage />;
            case 'settings':
                return <SettingsPage />;
            case 'userProfile':
                return <UserProfilePage />;
            case 'dashboard':
            case 'overview': // Treat owner's overview as dashboard
            default:
                return <Dashboard setActiveView={setActiveView} />;
        }
    };

    return (
        <div className="flex h-screen bg-secondary-100 dark:bg-secondary-900 text-secondary-800 dark:text-secondary-200 transition-colors duration-300">
            <ToastContainer />
            <OperationProgressOverlay progress={operationProgress} />
            <AboutModal isOpen={isAboutModalOpen} onClose={() => setIsAboutModalOpen(false)} />
            <Sidebar 
                sidebarOpen={sidebarOpen} 
                setSidebarOpen={setSidebarOpen} 
                activeView={activeView}
                setActiveView={setActiveView}
                effectiveRole={effectiveRole as UserRole}
            />
            <div className="flex flex-col flex-1 overflow-y-auto">
                <Header setSidebarOpen={setSidebarOpen} setActiveView={setActiveView} openAboutModal={() => setIsAboutModalOpen(true)} />
                {!isOnline && (
                    <div className="bg-amber-600 dark:bg-amber-700 text-white px-4 py-2.5 text-center text-sm font-medium shadow-sm flex items-center justify-center gap-2 transition-all animate-in fade-in duration-200">
                        <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <span>You are offline. Records cannot be saved until the connection returns.</span>
                    </div>
                )}
                <main className="p-4 md:p-8">
                    <Suspense fallback={<PageLoadingFallback />}>
                        {renderContent()}
                    </Suspense>
                </main>
            </div>
        </div>
    );
};

export default Layout;
