import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useData } from '../../context/DataContext';
import { UserRole } from '../../types';
import { ActiveView } from './Layout';
import Avatar from '../common/Avatar';
import { EduSyncLogo } from '../../constants';
import { useSync } from '../../context/SyncContext';

const SyncIcon: React.FC<{className?: string}> = ({className}) => <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>;
const CheckCircleIcon: React.FC<{className?: string}> = ({className}) => <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>;
const CloudOffIcon: React.FC<{className?: string}> = ({className}) => <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22.61 16.95A5 5 0 0 0 18 10h-1.26a8 8 0 0 0-7.05-6M5 5a8 8 0 0 0 4 15h9a5 5 0 0 0 1.7-.3"/><line x1="1" y1="1" x2="23" y2="23"/></svg>;
const AlertTriangleIcon: React.FC<{className?: string}> = ({className}) => <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>;


const timeAgo = (date: Date | null): string => {
    if (!date) return '';
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 5) return 'just now';
    if (seconds < 60) return `${seconds} seconds ago`;

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;

    const days = Math.floor(hours / 24);
    return `${days} day${days > 1 ? 's' : ''} ago`;
};

const SyncStatus: React.FC = () => {
    // FIX: Destructure `syncError` from useData to display non-critical sync failures in the UI.
    const { loading, isInitialLoad, lastSyncTime, schools, syncError } = useData();
    const { isOnline } = useSync();

    const isSyncing = loading && !isInitialLoad;

    if (syncError) {
        return (
            <div className="flex items-center gap-1 text-xs font-medium text-red-600 dark:text-red-400" title={`Sync Error: ${syncError}`}>
                <AlertTriangleIcon className="w-3.5 h-3.5" />
                <span>Sync Failed</span>
            </div>
        );
    }

    if (isSyncing) {
        return (
            <div className="flex items-center gap-1 text-xs font-medium text-primary-600 dark:text-primary-400">
                <SyncIcon className="w-3.5 h-3.5 animate-spin" />
                <span>Syncing...</span>
            </div>
        );
    }

    if (lastSyncTime) {
        return (
            <div className="flex items-center gap-1 text-xs font-medium text-secondary-500 dark:text-secondary-400">
                <CheckCircleIcon className="w-3.5 h-3.5 text-green-500" />
                <span>Synced: {timeAgo(lastSyncTime)}</span>
            </div>
        );
    }
    
    if (!isOnline && schools.length > 0) {
        return (
            <div className="flex items-center gap-1 text-xs font-medium text-yellow-600 dark:text-yellow-400">
                <CloudOffIcon className="w-3.5 h-3.5" />
                <span>Cached data</span>
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
    const { schools, getSchoolById, fetchData, loading, isInitialLoad } = useData();
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
            <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
                {/* Header: Left side */}
                <div className="flex items-center gap-4">
                    {/* Hamburger button */}
                    <button
                        className="text-secondary-500 hover:text-secondary-600 lg:hidden"
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
                    <div className="flex items-center gap-2">
                        {user?.role === UserRole.Owner ? (
                            activeSchoolId ? (
                                <>
                                    {school?.logoUrl ? (
                                        <img src={school.logoUrl} alt={`${school.name} Logo`} className="h-8 w-auto max-w-[100px] object-contain" />
                                    ) : (
                                        <EduSyncLogo className="h-8 w-auto text-primary-600 dark:text-primary-400" />
                                    )}
                                    <div className="flex flex-col">
                                        <h1 className="text-lg font-semibold leading-tight">{school?.name}</h1>
                                        <button onClick={handleReturnToOwnerView} className="text-xs text-primary-600 hover:underline text-left">
                                            &larr; Owner View
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <div className="relative" ref={schoolSwitcherRef}>
                                    <button 
                                        className="flex items-center gap-2 text-lg font-semibold text-secondary-800 dark:text-secondary-200"
                                        onClick={() => setSchoolSwitcherOpen(prev => !prev)}
                                    >
                                        <span>Owner Overview</span>
                                        <ChevronDownIcon className={`h-5 w-5 transition-transform ${schoolSwitcherOpen ? 'rotate-180' : ''}`} />
                                    </button>
                                    {schoolSwitcherOpen && (
                                        <div className="origin-top-left absolute left-0 mt-2 w-64 rounded-md shadow-lg py-1 bg-white dark:bg-secondary-800 ring-1 ring-black ring-opacity-5 focus:outline-none">
                                            <div className="px-4 py-2 text-xs text-secondary-500 uppercase font-semibold">Switch School View</div>
                                            {schools.map(s => (
                                                <button
                                                    key={s.id}
                                                    onClick={() => handleSchoolSelect(s.id)}
                                                    className="w-full text-left flex items-center gap-3 px-4 py-2 text-sm text-secondary-700 dark:text-secondary-200 hover:bg-secondary-100 dark:hover:bg-secondary-700 transition-colors"
                                                >
                                                    {s.logoUrl ? <img src={s.logoUrl} alt={`${s.name} logo`} className="w-6 h-6 object-contain rounded-sm bg-white" /> : <div className="w-6 h-6 bg-secondary-200 dark:bg-secondary-700 rounded-sm flex items-center justify-center text-xs">?</div>}
                                                    <span>{s.name}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )
                        ) : (
                            <>
                                {school?.logoUrl ? (
                                    <img src={school.logoUrl} alt={`${school.name} Logo`} className="h-8 w-auto max-w-[100px] object-contain" />
                                 ) : (
                                    <EduSyncLogo className="h-8 w-auto text-primary-600 dark:text-primary-400" />
                                )}
                                <h1 className="text-lg font-semibold">{school?.name || 'EduSync'}</h1>
                            </>
                        )}
                    </div>
                </div>

                {/* Header: Right side */}
                <div className="flex items-center gap-3 md:gap-4">
                    <SyncStatus />
                    <div className="flex items-center gap-2 text-xs font-medium text-secondary-600 dark:text-secondary-400">
                        <span className={`h-2.5 w-2.5 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`}></span>
                        <span>{isOnline ? 'Online' : 'Offline'}</span>
                    </div>

                    <button
                        onClick={() => fetchData()}
                        disabled={isSyncing}
                        className="p-2 rounded-full text-secondary-500 hover:bg-secondary-100 dark:text-secondary-400 dark:hover:bg-secondary-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Refresh Data"
                    >
                        <SyncIcon className={`w-5 h-5 ${isSyncing ? 'animate-spin' : ''}`} />
                    </button>

                    <button onClick={toggleTheme} className="p-2 rounded-full text-secondary-500 hover:bg-secondary-100 dark:text-secondary-400 dark:hover:bg-secondary-700" title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}>
                       {theme === 'dark' ? <SunIcon/> : <MoonIcon/>}
                    </button>
                    
                    <div className="relative" ref={profileDropdownRef}>
                         <button
                            className="flex items-center gap-2"
                            onClick={(e) => { e.stopPropagation(); setProfileOpen(!profileOpen); }}
                            title="Open user menu"
                        >
                            <Avatar user={user} className="h-9 w-9" />
                            <div className="hidden md:block text-left">
                                <span className="font-semibold text-sm">{user?.name}</span>
                                <span className="block text-xs text-secondary-500">{user?.role}</span>
                            </div>
                        </button>
                        {profileOpen && (
                            <div className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg py-1 bg-white dark:bg-secondary-800 ring-1 ring-black ring-opacity-5 focus:outline-none">
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
