import React, { useState, useEffect } from 'react';
import { Sparkles, X, Download } from 'lucide-react';
import { version as currentVersion } from '../../../package.json';

interface VersionInfo {
    version: string;
    releaseDate: string;
    changelog: string[];
}

export const UpdateChecker: React.FC = () => {
    const [latestVersion, setLatestVersion] = useState<VersionInfo | null>(null);
    const [showBanner, setShowBanner] = useState(false);

    useEffect(() => {
        // Run update check on mount
        checkForUpdates();
    }, []);

    const checkForUpdates = async () => {
        try {
            // Fetch version.json with a cache buster
            const response = await fetch(`/version.json?cb=${Date.now()}`);
            if (!response.ok) throw new Error('Failed to fetch version info');
            
            const data: VersionInfo = await response.json();
            setLatestVersion(data);

            if (data.version !== currentVersion) {
                setShowBanner(true);
            }
        } catch (error) {
            console.error('Update check failed:', error);
        }
    };

    const handleUpdate = () => {
        // Force reload from server to bust browser cache
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistrations().then((registrations) => {
                for (const registration of registrations) {
                    registration.unregister();
                }
            });
        }
        setTimeout(() => {
            window.location.reload();
        }, 800);
    };

    if (!showBanner || !latestVersion) return null;

    return (
        <div className="fixed bottom-4 right-4 z-50 max-w-sm w-full bg-white dark:bg-secondary-800 rounded-xl shadow-2xl border border-secondary-100 dark:border-secondary-700 p-4 transition-all duration-300 transform translate-y-0 animate-in slide-in-from-bottom-5">
            <div className="flex items-start gap-3">
                <div className="p-2 bg-primary-50 dark:bg-primary-950/30 rounded-lg text-primary-600 dark:text-primary-400">
                    <Sparkles className="w-5 h-5 animate-pulse" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-secondary-900 dark:text-white text-sm">
                            New Update Available!
                        </h3>
                        <button 
                            onClick={() => setShowBanner(false)}
                            className="text-secondary-400 hover:text-secondary-600 dark:hover:text-secondary-200 transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                    <p className="text-xs text-secondary-500 dark:text-secondary-400 mt-1">
                        Version <span className="font-semibold">{latestVersion.version}</span> is now available. (You are running v{currentVersion})
                    </p>
                    
                    <div className="mt-3 bg-secondary-50 dark:bg-secondary-900/40 rounded-lg p-2 max-h-24 overflow-y-auto">
                        <p className="text-[11px] font-medium text-secondary-600 dark:text-secondary-300">What's new:</p>
                        <ul className="list-disc list-inside text-[10px] text-secondary-500 dark:text-secondary-400 mt-1 space-y-1">
                            {latestVersion.changelog.map((item, idx) => (
                                <li key={idx} className="truncate">{item}</li>
                            ))}
                        </ul>
                    </div>

                    <div className="flex items-center gap-2 mt-4">
                        <button
                            onClick={handleUpdate}
                            className="flex-1 flex items-center justify-center gap-1 text-xs font-medium bg-primary-600 hover:bg-primary-700 text-white py-2 px-3 rounded-lg shadow-sm transition-colors"
                        >
                            <Download className="w-3.5 h-3.5" />
                            Update Now
                        </button>
                        <button
                            onClick={() => setShowBanner(false)}
                            className="flex-1 text-xs font-medium bg-secondary-100 hover:bg-secondary-200 dark:bg-secondary-700 dark:hover:bg-secondary-600 text-secondary-700 dark:text-secondary-200 py-2 px-3 rounded-lg transition-colors text-center"
                        >
                            Later
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
