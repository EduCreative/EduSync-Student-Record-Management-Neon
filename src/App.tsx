
import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DataProvider } from './context/DataContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import LoginPage from './components/auth/LoginPage';
import Layout from './components/layout/Layout';
import { ToastProvider } from './context/ToastContext';
import { PrintProvider, usePrint } from './context/PrintContext';
import PrintPreview from './components/common/PrintPreview';
import { PWAInstallProvider } from './context/PWAInstallContext';
import { SyncProvider } from './context/SyncContext';

const RegisterPage = React.lazy(() => import('./components/auth/RegisterPage'));
const RequestPasswordResetPage = React.lazy(() => import('./components/auth/RequestPasswordResetPage'));
const ResetPasswordPage = React.lazy(() => import('./components/auth/ResetPasswordPage'));

const AuthLoadingFallback: React.FC = () => (
    <div className="fixed inset-0 bg-[#081745] flex flex-col items-center justify-center z-50">
        <div className="flex flex-col items-center animate-pulse">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-20 h-20 mb-6 drop-shadow-[0_0_20px_rgba(0,243,255,0.5)]">
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2V3z" stroke="#1d4ed8" fill="#fde68a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path>
                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7V3z" stroke="#1d4ed8" fill="#fde68a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path>
                <g transform="rotate(-15 12 11)">
                    <path d="M4 10l8-4 8 4-8 4-8-4z" stroke="#00f3ff" fill="#475569" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"></path>
                    <path d="M8 12v4c2 2 6 2 8 0v-4" stroke="#00f3ff" fill="#475569" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"></path>
                    <path d="M17.5 10V8" stroke="#00f3ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path>
                </g>
            </svg>
            <h1 className="text-white text-3xl font-extrabold tracking-tight mb-2">EduSync</h1>
            <span className="text-[#00f3ff] text-xs font-bold tracking-[0.25em] uppercase">Student Record Management System</span>
        </div>
        <div className="absolute bottom-12 flex items-center space-x-2">
            <div className="w-2 h-2 bg-[#00f3ff] rounded-full animate-bounce"></div>
            <div className="w-2 h-2 bg-[#fde68a] rounded-full animate-bounce [animation-delay:0.2s]"></div>
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:0.4s]"></div>
        </div>
    </div>
);
import { NotificationProvider } from './context/NotificationContext';
import { Analytics } from '@vercel/analytics/react';
import { UpdateChecker } from './components/common/UpdateChecker';

type AuthView = 'login' | 'register' | 'requestReset';

const AppContent: React.FC = () => {
    const { user, loading, authEvent } = useAuth();
    const [authView, setAuthView] = useState<AuthView>('login');
    const { isPrinting } = usePrint();
    const { theme } = useTheme();

    if (loading) {
        return <AuthLoadingFallback />;
    }

    // FIX: Temporarily switch to light mode during print preview to ensure
    // content with forced white backgrounds remains legible in dark mode.
    useEffect(() => {
        const root = document.documentElement;
        if (isPrinting && theme === 'dark') {
            root.classList.remove('dark');
            return () => {
                // Restore dark mode when print preview is closed
                root.classList.add('dark');
            };
        }
    }, [isPrinting, theme]);

    if (user && authEvent === 'PASSWORD_RECOVERY') {
        return (
            <React.Suspense fallback={<AuthLoadingFallback />}>
                <ResetPasswordPage onResetSuccess={() => setAuthView('login')} />
            </React.Suspense>
        );
    }

    if (!user) {
        switch (authView) {
            case 'login':
                return <LoginPage onSwitchToRegister={() => setAuthView('register')} onForgotPassword={() => setAuthView('requestReset')} />;
            case 'register':
                return (
                    <React.Suspense fallback={<AuthLoadingFallback />}>
                        <RegisterPage onSwitchToLogin={() => setAuthView('login')} />
                    </React.Suspense>
                );
            case 'requestReset':
                return (
                    <React.Suspense fallback={<AuthLoadingFallback />}>
                        <RequestPasswordResetPage onSwitchToLogin={() => setAuthView('login')} />
                    </React.Suspense>
                );
            default:
                 return <LoginPage onSwitchToRegister={() => setAuthView('register')} onForgotPassword={() => setAuthView('requestReset')} />;
        }
    }

    return (
        <>
            {isPrinting && <PrintPreview />}
            <div className={isPrinting ? 'no-print' : ''}>
                <Layout />
            </div>
        </>
    );
};

const App: React.FC = () => {
  return (
    <ThemeProvider>
      <SyncProvider>
        <AuthProvider>
            <ToastProvider>
                <DataProvider>
                    <NotificationProvider>
                        <PrintProvider>
                            <PWAInstallProvider>
                                <AppContent />
                                <UpdateChecker />
                                <Analytics />
                            </PWAInstallProvider>
                        </PrintProvider>
                    </NotificationProvider>
                </DataProvider>
            </ToastProvider>
        </AuthProvider>
      </SyncProvider>
    </ThemeProvider>
  );
};

export default App;
