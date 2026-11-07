
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
    <div className="min-h-screen flex items-center justify-center bg-secondary-50 dark:bg-secondary-900">
        <div className="w-8 h-8 border-3 border-primary-600 border-t-transparent rounded-full animate-spin dark:border-primary-400 dark:border-t-transparent" />
    </div>
);
import { NotificationProvider } from './context/NotificationContext';
import { Analytics } from '@vercel/analytics/react';
import { UpdateChecker } from './components/common/UpdateChecker';

type AuthView = 'login' | 'register' | 'requestReset';

const AppContent: React.FC = () => {
    const { user, authEvent } = useAuth();
    const [authView, setAuthView] = useState<AuthView>('login');
    const { isPrinting } = usePrint();
    const { theme } = useTheme();

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
