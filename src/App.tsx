import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DataProvider } from './context/DataContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import LoginPage from './components/auth/LoginPage';
import RegisterPage from './components/auth/RegisterPage';
import Layout from './components/layout/Layout';
import { ToastProvider } from './context/ToastContext';
import { PrintProvider, usePrint } from './context/PrintContext';
import PrintPreview from './components/common/PrintPreview';
import RequestPasswordResetPage from './components/auth/RequestPasswordResetPage';
import ResetPasswordPage from './components/auth/ResetPasswordPage';
import { PWAInstallProvider } from './context/PWAInstallContext';
import { SyncProvider } from './context/SyncContext';

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
        return <ResetPasswordPage onResetSuccess={() => setAuthView('login')} />;
    }

    if (!user) {
        switch (authView) {
            case 'login':
                return <LoginPage onSwitchToRegister={() => setAuthView('register')} onForgotPassword={() => setAuthView('requestReset')} />;
            case 'register':
                return <RegisterPage onSwitchToLogin={() => setAuthView('login')} />;
            case 'requestReset':
                return <RequestPasswordResetPage onSwitchToLogin={() => setAuthView('login')} />;
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
                    <PrintProvider>
                        <PWAInstallProvider>
                            <AppContent />
                        </PWAInstallProvider>
                    </PrintProvider>
                </DataProvider>
            </ToastProvider>
        </AuthProvider>
      </SyncProvider>
    </ThemeProvider>
  );
};

export default App;
