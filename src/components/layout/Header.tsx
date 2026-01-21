
import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useData } from '../../context/DataContext';
import { UserRole } from '../../types';
import { ActiveView } from './Layout';
import Avatar from '../common/Avatar';
import { EduSyncLogo } from '../../constants';
import { useSync } from '../../context/SyncContext';
import NotificationBell from './NotificationBell';

const SyncIcon: React.FC<{className?: string}> = ({className}) => <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>;
const CheckCircleIcon: React.FC<{className?: string}> = ({className}) => <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>;
// FIX: Removed duplicate x2 attribute and corrected line coordinates for CloudOffIcon.
const CloudOffIcon: React.FC<{className?: string}> = ({className}) => <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22.61 16.95A5 5 0 0 0 18 10h-1.26a8 8 0 0 0-7.05-6M5 5a8 8 0 0 0 4 15h9a5 5 0 0 0 1.7-.3"/><line x1="1" y1="1" x2="23" y2="23"/></svg>;
const AlertTriangleIcon: React.FC<{className?: string}> = ({className}) => <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>;


const timeAgo = (date: Date | null): string => {
    if (!date) return '';
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 5) return 'just now';
    if (seconds < 60) return `${seconds}s ago`;

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;

    const days = Math.floor(hours / 24);
    return `${days}d ago`;
};

const SyncStatus: React.FC = () => {
    const { loading, isInitialLoad, lastSyncTime, schools, syncError, syncProgress } = useData();
    const { isOnline } = useSync();

    const isSyncing = loading && !isInitialLoad;

    if (syncError) {
        return (
            <div className="flex items-center gap-1 text-xs font-medium text-red-600 dark:text-red-400" title={`Sync Error: ${syncError}`}>
                <AlertTriangleIcon className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                <span className="hidden sm:inline">Sync Failed</span>
            </div>
        );
    }

    if (isSyncing || (syncProgress.percentage > 0 && syncProgress.percentage < 100)) {
        return (
            <div className="flex items-center gap-1 sm:gap-2 text-xs font-medium text-primary-600 dark:text-primary-400">
                <SyncIcon className="w-4 h-4 sm:w-3.5 sm:h-3.5 animate-spin" />
                <div className="hidden sm:flex flex-col">
                    <span className="leading-none">{syncProgress.status || 'Syncing...'}</span>
                    <span className="text-[10px] opacity-75">{syncProgress.percentage}% complete</span>
                </div>
                {/* On mobile show only % if syncing */}
                <span className="sm:hidden text-[10px]">{syncProgress.percentage}%</span>
            </div>
        );
    }

    if (lastSyncTime) {
        return (
            <div className="flex items-center gap-1 text-xs font-medium text-secondary-500 dark:text-secondary-400">
                <CheckCircleIcon className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-green-500" />
                <span className="hidden sm:inline">Synced: {timeAgo(lastSyncTime)}</span>
            </div>
        );
    }
    
    if (!isOnline && schools.length > 0) {
        return (
            <div className="flex items-center gap-1 text-xs font-medium text-yellow-600 dark:text-yellow-400">
                <CloudOffIcon className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                <span className="hidden sm:inline">Cached</span>
            </div>
        );
    }

    return null;
};

interface HeaderProps {
    setSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
    setActiveView: (view: ActiveView) => void;
    openAboutModal: () => void;
}

const Header: React.FC<HeaderProps> = ({ setSidebarOpen, setActiveView, openAboutModal }) => {
    const { user, logout, activeSchoolId, switchSchoolContext } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const { schools, getSchoolById, fetchData, loading, isInitialLoad, syncProgress } = useData();
    const { isOnline } = useSync();
    const [profileOpen, setProfileOpen] = useState(false);
    const [schoolSwitcherOpen, setSchoolSwitcherOpen] = useState(false);

    const profileDropdownRef = useRef<HTMLDivElement>(null);
    const schoolSwitcherRef = useRef<HTMLDivElement>(null);

    const isSyncing = loading && !isInitialLoad;

    // Close on click outside
    useEffect(() => {
        const clickHandler = ({ target }: MouseEvent) => {
            if (profileDropdownRef.current && profileOpen && !profileDropdownRef.current.contains(target as Node)) {
                setProfileOpen(false);
            }
            if (schoolSwitcherRef.current && schoolSwitcherOpen && !schoolSwitcherRef.current.contains(target as Node)) {
                setSchoolSwitcherOpen(false);
            }
        };
        document.addEventListener('click', clickHandler);
        return () => document.removeEventListener('click', clickHandler);
    }, [profileOpen, schoolSwitcherOpen]);

    const displaySchoolId = user?.role === UserRole.Owner && activeSchoolId ? activeSchoolId : user?.schoolId;
    const school = user ? getSchoolById(displaySchoolId as string) : null;
    
    const handleReturnToOwnerView = () => {
        switchSchoolContext(null);
        setActiveView({ view: 'overview' });
    };

    const handleSchoolSelect = (schoolId: string) => {
        switchSchoolContext(schoolId);
        setActiveView({ view: 'dashboard' });
        setSchoolSwitcherOpen(false);
    };

    return (
        <header className="sticky top-0 z-30 border-b border-secondary-200 bg-white dark:border-secondary-700 dark:bg-secondary-800 no-print transition-colors duration-300">
            {/* Sync Progress Bar */}
            {syncProgress.percentage > 0 && syncProgress.percentage < 100 && (
                <div className="absolute top-0 left-0 h-0.5 bg-neon-accent transition-all duration-500 ease-out z-[60]" style={{ width: `${syncProgress.percentage}%` }}></div>
            )}
            
            <div className="flex h-16 items-center justify-between px-2 sm:px-6 lg:px-8">
                {/* Header: Left side */}
                <div className="flex items-center gap-1 sm:gap-4 overflow-hidden">
                    {/* Hamburger button */}
                    <button
                        className="text-secondary-500 hover:text-secondary-600 lg:hidden p-1"
                        aria-controls="sidebar"
                        onClick={(e) => {
                            e.stopPropagation();
                            setSidebarOpen((old) => !old);
                        }}
                        title="Open sidebar"
                    >
                        <span className="sr-only">Open sidebar</span>
                        <svg className="h-6 w-6 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <rect x="4" y="5" width="16" height="2" />
                            <rect x="4" y="11" width="16" height="2" />
                            <rect x="4" y="17" width="16" height="2" />
                        </svg>
                    </button>

                    {/* Logo and School Name / Switcher */}
                    <div className="flex items-center gap-1.5 overflow-hidden">
                        {user?.role === UserRole.Owner ? (
                            activeSchoolId ? (
                                <>
                                    {school?.logoUrl ? (
                                        <img src={school.logoUrl} alt={`${school.name} Logo`} className="h-7 w-auto max-w-[40px] sm:max-w-[100px] object-contain" />
                                    ) : (
                                        <EduSyncLogo className="h-7 w-auto text-primary-600 dark:text-primary-400 neon-glow-primary shrink-0" />
                                    )}
                                    <div className="flex flex-col overflow-hidden">
                                        <div className="flex items-center gap-1 overflow-hidden">
                                            <h1 className="text-sm sm:text-lg font-semibold leading-tight truncate max-w-[80px] sm:max-w-none">{school?.name}</h1>
                                            <span className="bg-neon-accent/20 text-neon-accent text-[8px] sm:text-[10px] px-1 py-0.5 rounded font-bold border border-neon-accent/30 hidden xs:inline-block">NEON</span>
                                        </div>
                                        <button onClick={handleReturnToOwnerView} className="text-[10px] text-primary-600 hover:underline text-left truncate">
                                            &larr; <span className="hidden xs:inline">Owner</span>
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <div className="relative" ref={schoolSwitcherRef}>
                                    <button 
                                        className="flex items-center gap-1 text-sm sm:text-lg font-semibold text-secondary-800 dark:text-secondary-200"
                                        onClick={() => setSchoolSwitcherOpen(prev => !prev)}
                                    >
                                        <span className="truncate max-w-[100px] sm:max-w-none">Owner</span>
                                        <span className="bg-neon-accent text-secondary-900 text-[8px] sm:text-[10px] px-1 py-0.5 rounded font-bold hidden xs:inline-block">NEON</span>
                                        <ChevronDownIcon className={`h-4 w-4 transition-transform ${schoolSwitcherOpen ? 'rotate-180' : ''}`} />
                                    </button>
                                    {schoolSwitcherOpen && (
                                        <div className="origin-top-left absolute left-0 mt-2 w-64 rounded-md shadow-lg py-1 bg-white dark:bg-secondary-800 ring-1 ring-black ring-opacity-5 focus:outline-none z-[70]">
                                            <div className="px-4 py-2 text-xs text-secondary-500 uppercase font-semibold">Switch School View</div>
                                            {schools.map(s => (
                                                <button
                                                    key={s.id}
                                                    onClick={() => handleSchoolSelect(s.id)}
                                                    className="w-full text-left flex items-center gap-3 px-4 py-2 text-sm text-secondary-700 dark:text-secondary-200 hover:bg-secondary-100 dark:hover:bg-secondary-700 transition-colors"
                                                >
                                                    {s.logoUrl ? <img src={s.logoUrl} alt={`${s.name} logo`} className="w-6 h-6 object-contain rounded-sm bg-white" /> : <div className="w-6 h-6 bg-secondary-200 dark:bg-secondary-700 rounded-sm flex items-center justify-center text-xs">?</div>}
                                                    <span className="truncate">{s.name}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )
                        ) : (
                            <>
                                {school?.logoUrl ? (
                                    <img src={school.logoUrl} alt={`${school.name} Logo`} className="h-7 w-auto max-w-[40px] sm:max-w-[100px] object-contain" />
                                 ) : (
                                    <EduSyncLogo className="h-7 w-auto text-primary-600 dark:text-primary-400 neon-glow-primary shrink-0" />
                                )}
                                <div className="flex items-center gap-1 overflow-hidden">
                                    <h1 className="text-sm sm:text-lg font-semibold truncate max-w-[100px] sm:max-w-none">{school?.name || 'EduSync'}</h1>
                                    <span className="bg-neon-accent/20 text-neon-accent text-[8px] sm:text-[10px] px-1 py-0.5 rounded font-bold border border-neon-accent/30 hidden xs:inline-block">NEON</span>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* Header: Right side */}
                <div className="flex items-center gap-1 sm:gap-4 ml-auto">
                    <SyncStatus />
                    <div className="flex items-center gap-1 text-[10px] sm:text-xs font-medium text-secondary-600 dark:text-secondary-400" title={isOnline ? 'Online' : 'Offline'}>
                        <span className={`h-2 w-2 rounded-full ${isOnline ? 'bg-neon-accent animate-pulse shadow-[0_0_8px_#00f3ff]' : 'bg-red-500'}`}></span>
                        <span className="hidden sm:inline">{isOnline ? 'Online' : 'Offline'}</span>
                    </div>

                    <NotificationBell />

                    <button
                        onClick={() => fetchData()}
                        disabled={isSyncing}
                        className="p-1.5 sm:p-2 rounded-full text-secondary-500 hover:bg-secondary-100 dark:text-secondary-400 dark:hover:bg-secondary-700 disabled:opacity-50"
                        title="Refresh Data"
                    >
                        <SyncIcon className={`w-5 h-5 ${isSyncing ? 'animate-spin' : ''}`} />
                    </button>

                    <button onClick={toggleTheme} className="p-1.5 sm:p-2 rounded-full text-secondary-500 hover:bg-secondary-100 dark:text-secondary-400 dark:hover:bg-secondary-700" title="Toggle Theme">
                       {theme === 'dark' ? <SunIcon/> : <MoonIcon/>}
                    </button>
                    
                    <div className="relative" ref={profileDropdownRef}>
                         <button
                            className="flex items-center gap-1 sm:gap-2 p-1"
                            onClick={(e) => { e.stopPropagation(); setProfileOpen(!profileOpen); }}
                            title="Open user menu"
                        >
                            <Avatar user={user} className="h-8 w-8 sm:h-9 sm:w-9" />
                            <div className="hidden md:block text-left">
                                <span className="font-semibold text-sm">{user?.name}</span>
                                <span className="block text-xs text-secondary-500">{user?.role}</span>
                            </div>
                        </button>
                        {profileOpen && (
                            <div className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg py-1 bg-white dark:bg-secondary-800 ring-1 ring-black ring-opacity-5 focus:outline-none z-[70]">
                                <button
                                    onClick={() => {
                                        setActiveView({ view: 'userProfile' });
                                        setProfileOpen(false);
                                    }}
                                    className="w-full text-left block px-4 py-2 text-sm text-secondary-700 dark:text-secondary-200 hover:bg-secondary-100 dark:hover:bg-secondary-700"
                                >
                                    My Profile
                                </button>
                                <button
                                    onClick={() => {
                                        setActiveView({ view: 'settings' });
                                        setProfileOpen(false);
                                    }}
                                    className="w-full text-left block px-4 py-2 text-sm text-secondary-700 dark:text-secondary-200 hover:bg-secondary-100 dark:hover:bg-secondary-700"
                                >
                                    Settings
                                </button>
                                <button
                                    onClick={() => {
                                        openAboutModal();
                                        setProfileOpen(false);
                                    }}
                                    className="w-full text-left block px-4 py-2 text-sm text-secondary-700 dark:text-secondary-200 hover:bg-secondary-100 dark:hover:bg-secondary-700"
                                >
                                    About EduSync
                                </button>
                                <button
                                    onClick={() => {
                                        logout();
                                        setProfileOpen(false);
                                    }}
                                    className="w-full text-left block px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-secondary-100 dark:hover:bg-secondary-700"
                                >
                                    Logout
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
};

const SunIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>
);

const MoonIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
);

const ChevronDownIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
);


export default Header;
