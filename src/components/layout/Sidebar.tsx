import React, { useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { NAV_LINKS, EduSyncLogo } from '../../constants';
import { ActiveView } from './Layout';
import { UserRole } from '../../types';
import { version } from '../../../package.json';
import { useToast } from '../../context/ToastContext';
import { usePWAInstall } from '../../context/PWAInstallContext';

interface SidebarProps {
    sidebarOpen: boolean;
    setSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
    activeView: ActiveView;
    setActiveView: (view: ActiveView) => void;
    effectiveRole: UserRole;
}

const ShareIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" /><polyline points="16 6 12 2 8 6" /><line x1="12" y1="2" x2="12" y2="15" /></svg>
);

const DownloadCloudIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M12 12v9"/><path d="m8 17 4 4 4-4"/></svg>
);

const Sidebar: React.FC<SidebarProps> = ({ sidebarOpen, setSidebarOpen, activeView, setActiveView, effectiveRole }) => {
    const { user } = useAuth();
    const { showToast } = useToast();
    const { installPrompt, clearInstallPrompt } = usePWAInstall();
    const sidebar = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const clickHandler = ({ target }: MouseEvent) => {
            if (!sidebar.current || !target) return;
            if (!sidebarOpen || sidebar.current.contains(target as Node)) return;
            setSidebarOpen(false);
        };
        document.addEventListener('click', clickHandler);
        return () => document.removeEventListener('click', clickHandler);
    }, [sidebarOpen, setSidebarOpen]);

    const navLinksForRole = user ? NAV_LINKS[effectiveRole] : [];
    // Filter links based on the user's specific disabledNavLinks property
    const visibleNavLinks = navLinksForRole.filter(link => !user?.disabledNavLinks?.includes(link.path));

    const handleLinkClick = (path: string) => {
        const viewName = path.substring(1); // remove leading '/'
        setActiveView({ view: viewName });
        setSidebarOpen(false);
    };

    const handleShare = async () => {
        const shareData = {
            title: 'EduSync - Student Record Management',
            text: 'Check out EduSync, a modern Student Record Management System!',
            url: window.location.origin,
        };
        try {
            if (navigator.share) {
                await navigator.share(shareData);
            } else {
                await navigator.clipboard.writeText(shareData.url);
                showToast('Link Copied!', 'The app link has been copied to your clipboard.', 'success');
            }
        } catch (error) {
            // AbortError is thrown when the user cancels the share dialog, so we can safely ignore it.
            if ((error as Error).name !== 'AbortError') {
                console.error('Error sharing:', error);
                showToast('Error', 'Could not share the app.', 'error');
            }
        }
    };
    
    const handleInstallPWA = async () => {
        if (!installPrompt) return;
        try {
            await installPrompt.prompt();
            const { outcome } = await installPrompt.userChoice;
            if (outcome === 'accepted') {
                showToast('Success', 'App installed successfully!', 'success');
            } else {
                showToast('Info', 'Installation was dismissed.', 'info');
            }
        } catch (e) {
            showToast('Error', 'App installation failed.', 'error');
        } finally {
            clearInstallPrompt();
        }
    };

    return (
        <div className="no-print">
            {/* Sidebar backdrop (mobile) */}
            <div className={`fixed inset-0 bg-secondary-900 bg-opacity-30 z-40 lg:hidden lg:z-auto transition-opacity duration-200 ${sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} aria-hidden="true"></div>

            <div
                ref={sidebar}
                className={`flex flex-col absolute z-40 left-0 top-0 lg:static lg:left-auto lg:top-auto lg:translate-x-0 h-screen overflow-y-auto w-64 lg:w-20 lg:hover:w-64 shrink-0 bg-primary-800 dark:bg-secondary-900 p-4 transition-all duration-300 ease-in-out group ${sidebarOpen ? 'translate-x-0' : '-translate-x-64'}`}
            >
                {/* Sidebar header */}
                <div className="flex justify-between mb-10 pr-3 sm:px-2">
                     <a href="/" className="flex items-center space-x-2">
                        <EduSyncLogo className="w-8 h-8 text-white" />
                        <h1 className="text-2xl font-bold text-white lg:opacity-0 group-hover:opacity-100 transition-opacity duration-200">EduSync</h1>
                    </a>
                </div>

                {/* Links */}
                <div className="space-y-2">
                    {visibleNavLinks.map((link) => {
                        const viewName = link.path.substring(1);
                        const isActive = activeView.view === viewName;
                        return (
                            <button
                                key={link.name}
                                onClick={() => handleLinkClick(link.path)}
                                className={`w-full flex items-center p-2 rounded-lg transition-colors group ${isActive ? 'bg-primary-600 text-white dark:bg-primary-700' : 'text-secondary-200 hover:bg-primary-700 dark:hover:bg-secondary-700'}`}
                            >
                                {React.cloneElement(link.icon as React.ReactElement<any>, { className: "w-6 h-6 shrink-0" })}
                                <span className="ml-3 lg:opacity-0 group-hover:opacity-100 transition-opacity duration-200">{link.name}</span>
                            </button>
                        );
                    })}
                </div>

                 <div className="mt-auto pt-4">
                    {installPrompt && (
                        <button
                            onClick={handleInstallPWA}
                            className="w-full flex items-center p-2 rounded-lg transition-colors group text-secondary-200 hover:bg-primary-700 dark:hover:bg-secondary-700 mb-2"
                        >
                            <DownloadCloudIcon className="w-6 h-6 shrink-0" />
                            <span className="ml-3 lg:opacity-0 group-hover:opacity-100 transition-opacity duration-200">Install App</span>
                        </button>
                    )}
                    <button
                        onClick={handleShare}
                        className="w-full flex items-center p-2 rounded-lg transition-colors group text-secondary-200 hover:bg-primary-700 dark:hover:bg-secondary-700 mb-2"
                    >
                        <ShareIcon className="w-6 h-6 shrink-0" />
                        <span className="ml-3 lg:opacity-0 group-hover:opacity-100 transition-opacity duration-200">Share App</span>
                    </button>
                    <div className="p-4 rounded-lg bg-primary-700 bg-opacity-50 dark:bg-secondary-800 dark:bg-opacity-50 lg:opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <p className="text-center text-xs text-secondary-400">
                            Version {version}
                        </p>
                    </div>
                 </div>
            </div>
        </div>
    );
};

export default Sidebar;
