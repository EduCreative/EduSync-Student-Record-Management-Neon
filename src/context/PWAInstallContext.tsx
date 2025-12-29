import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';

// Define the type for the BeforeInstallPromptEvent, which is not standard in all TS lib versions.
interface BeforeInstallPromptEvent extends Event {
    readonly platforms: string[];
    readonly userChoice: Promise<{
        outcome: 'accepted' | 'dismissed';
        platform: string;
    }>;
    prompt(): Promise<void>;
}

interface PWAInstallContextType {
    installPrompt: BeforeInstallPromptEvent | null;
    clearInstallPrompt: () => void;
}

const PWAInstallContext = createContext<PWAInstallContextType | undefined>(undefined);

export const PWAInstallProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);

    useEffect(() => {
        const handler = (e: Event) => {
            // Prevent the mini-infobar from appearing on mobile
            e.preventDefault();
            // Stash the event so it can be triggered later.
            setInstallPrompt(e as BeforeInstallPromptEvent);
        };

        window.addEventListener('beforeinstallprompt', handler);

        return () => {
            window.removeEventListener('beforeinstallprompt', handler);
        };
    }, []);

    const clearInstallPrompt = () => {
        setInstallPrompt(null);
    };

    const value = { installPrompt, clearInstallPrompt };

    return (
        <PWAInstallContext.Provider value={value}>
            {children}
        </PWAInstallContext.Provider>
    );
};

export const usePWAInstall = (): PWAInstallContextType => {
    const context = useContext(PWAInstallContext);
    if (!context) {
        throw new Error('usePWAInstall must be used within a PWAInstallProvider');
    }
    return context;
};
