
import type { SVGProps, ReactElement } from 'react';
import { UserRole } from './types';

export function EduSyncLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      {/* Book Paths */}
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2V3z" stroke="#1d4ed8" fill="#fde68a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path>
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7V3z" stroke="#1d4ed8" fill="#fde68a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path>
      {/* Tilted Graduation Cap */}
      <g transform="rotate(-15 12 11)">
        {/* Cap top */}
        <path d="M4 10l8-4 8 4-8 4-8-4z" stroke="#00f3ff" fill="#475569" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-neon-pulse"></path>
        {/* Cap body */}
        <path d="M8 12v4c2 2 6 2 8 0v-4" stroke="#00f3ff" fill="#475569" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"></path>
        {/* Tassel */}
        <path d="M17.5 10V8" stroke="#00f3ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path>
      </g>
    </svg>
  );
}

// FIX: Corrected viewBox attribute from "0 0 24" to "0 0 24 24".
function DashboardIcon(props: SVGProps<SVGSVGElement>) {
  return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="7" height="9" x="3" y="3" rx="1" /><rect width="7" height="5" x="14" y="3" rx="1" /><rect width="7" height="9" x="14" y="12" rx="1" /><rect width="7" height="5" x="3" y="16" rx="1" /></svg>
}

// FIX: Corrected malformed viewBox attribute from "0 0 24" 24"" to "0 0 24 24" to fix parsing errors.
function SchoolIcon(props: SVGProps<SVGSVGElement>) {
  return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m4 6 8-4 8 4" /><path d="m18 10 4 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-8l4-2" /><path d="M14 22v-4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v4" /><path d="M18 5v17" /><path d="M6 5v17" /><circle cx="12" cy="9" r="2" /></svg>
}

function UsersIcon(props: SVGProps<SVGSVGElement>) {
  return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
}

function SettingsIcon(props: SVGProps<SVGSVGElement>) {
    return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 0 2l-.15.08a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l-.22-.38a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1 0-2l.15-.08a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" /></svg>
}

function DollarSignIcon(props: SVGProps<SVGSVGElement>) {
    return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" x2="12" y1="2" y2="22" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
}

function CheckCircleIcon(props: SVGProps<SVGSVGElement>) {
    return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
}

function BarChartIcon(props: SVGProps<SVGSVGElement>) {
    return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" x2="12" y1="20" y2="10" /><line x1="18" x2="18" y1="20" y2="4" /><line x1="6" x2="6" y1="20" y2="16" /></svg>
}

function EditIcon(props: SVGProps<SVGSVGElement>) {
    return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
}

function MegaphoneIcon(props: SVGProps<SVGSVGElement>) {
    return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 11 18-5v12L3 13v-2Z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-0.8"/></svg>
}

function FileTextIcon(props: SVGProps<SVGSVGElement>) {
    return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" /><line x1="16" x2="8" y1="13" y2="13" /><line x1="16" x2="8" y1="17" y2="17" /><line x1="10" x2="8" y1="9" y2="9" /></svg>;
}

function FileCheckIcon(props: SVGProps<SVGSVGElement>) {
    return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" /><path d="m9 15 2 2 4-4" /></svg>
}

export function PrinterIcon(props: SVGProps<SVGSVGElement>) {
    return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect width="12" height="8" x="6" y="14" /></svg>
}

function CalendarIcon(props: SVGProps<SVGSVGElement>) {
    return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2" /><line x1="16" x2="16" y1="2" y2="6" /><line x1="8" x2="8" y1="2" y2="6" /><line x1="3" x2="21" y1="10" y2="10" /></svg>
}

function ScanIcon(props: SVGProps<SVGSVGElement>) {
  return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><path d="M7 12h10"/></svg>
}

export function DownloadIcon(props: SVGProps<SVGSVGElement>) {
    return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
}

export function UploadIcon(props: SVGProps<SVGSVGElement>) {
    return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
}

export const NAV_LINKS: Record<UserRole, { name: string; path: string; icon: ReactElement }[]> = {
    [UserRole.Owner]: [
        { name: 'Overview', path: '/overview', icon: <DashboardIcon /> },
        { name: 'Schools', path: '/schools', icon: <SchoolIcon /> },
        { name: 'Users', path: '/users', icon: <UsersIcon /> },
        { name: 'Announcements', path: '/announcements', icon: <MegaphoneIcon /> },
        { name: 'Settings', path: '/settings', icon: <SettingsIcon /> },
    ],
    [UserRole.Admin]: [
        { name: 'Dashboard', path: '/dashboard', icon: <DashboardIcon /> },
        { name: 'Class Management', path: '/classes', icon: <SchoolIcon /> },
        { name: 'Students', path: '/students', icon: <UsersIcon /> },
        { name: 'Fee Management', path: '/fees', icon: <DollarSignIcon /> },
        { name: 'Scan & Pay', path: '/scan-pay', icon: <ScanIcon /> },
        { name: 'Attendance', path: '/attendance', icon: <CheckCircleIcon /> },
        { name: 'Results', path: '/results', icon: <BarChartIcon /> },
        { name: 'Reports', path: '/reports', icon: <FileTextIcon /> },
        { name: 'Announcements', path: '/announcements', icon: <MegaphoneIcon /> },
        { name: 'User Accounts', path: '/users', icon: <UsersIcon /> },
        { name: 'User Logs', path: '/logs', icon: <FileCheckIcon /> },
        { name: 'Settings', path: '/settings', icon: <SettingsIcon /> },
    ],
    [UserRole.Accountant]: [
        { name: 'Dashboard', path: '/dashboard', icon: <DashboardIcon /> },
        { name: 'Fee Management', path: '/fees', icon: <DollarSignIcon /> },
        { name: 'Scan & Pay', path: '/scan-pay', icon: <ScanIcon /> },
        { name: 'Reports', path: '/reports', icon: <FileTextIcon /> },
        { name: 'Announcements', path: '/announcements', icon: <MegaphoneIcon /> },
        { name: 'Students', path: '/students', icon: <UsersIcon /> },
    ],
    [UserRole.Teacher]: [
        { name: 'Dashboard', path: '/dashboard', icon: <DashboardIcon /> },
        { name: 'Class Management', path: '/classes', icon: <SchoolIcon /> },
        { name: 'Attendance', path: '/attendance', icon: <CheckCircleIcon /> },
        { name: 'Enter Results', path: '/results', icon: <EditIcon /> },
        { name: 'Students', path: '/students', icon: <UsersIcon /> },
        { name: 'Announcements', path: '/announcements', icon: <MegaphoneIcon /> },
        { name: 'Calendar', path: '/calendar', icon: <CalendarIcon /> },
    ],
    [UserRole.Parent]: [
        { name: 'My Children', path: '/children', icon: <UsersIcon /> },
        { name: 'Fee Status', path: '/fees', icon: <DollarSignIcon /> },
        { name: 'Attendance', path: '/attendance', icon: <CheckCircleIcon /> },
        { name: 'Results', path: '/results', icon: <BarChartIcon /> },
        { name: 'Announcements', path: '/announcements', icon: <MegaphoneIcon /> },
        { name: 'Calendar', path: '/calendar', icon: <CalendarIcon /> },
    ],
    [UserRole.Student]: [
        { name: 'Dashboard', path: '/dashboard', icon: <DashboardIcon /> },
        { name: 'My Attendance', path: '/attendance', icon: <CheckCircleIcon /> },
        { name: 'My Results', path: '/results', icon: <BarChartIcon /> },
        { name: 'Fee Status', path: '/fees', icon: <DollarSignIcon /> },
        { name: 'Announcements', path: '/announcements', icon: <MegaphoneIcon /> },
        { name: 'Calendar', path: '/calendar', icon: <CalendarIcon /> },
    ],
};

export const formatDate = (dateString?: string | Date | null): string => {
    if (!dateString) return 'N/A';
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return 'Invalid Date';
        const options: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' };
        return date.toLocaleDateString('en-GB', options).replace(/ /g, '-');
    } catch (error) {
        return 'Invalid Date';
    }
};

/**
 * Standardizes month display to save space (e.g., "December" -> "Dec, 2025")
 */
export const formatMonthDisplay = (month: string, year?: number | string): string => {
    if (!month) return 'N/A';
    // Get first 3 letters of month
    const shortMonth = month.length > 3 ? month.substring(0, 3) : month;
    return year ? `${shortMonth}, ${year}` : shortMonth;
};

export const formatDateTime = (isoString?: string): string => {
    if (!isoString) return 'N/A';
    try {
        const date = new Date(isoString);
        if (isNaN(date.getTime())) return 'Invalid Date';
        const datePart = formatDate(date);
        const time = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
        return `${datePart}, ${time}`;
    } catch (error) {
        return 'Invalid Date';
    }
};
