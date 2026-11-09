import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { User, UserRole } from '../types';
import { Permission, ROLE_PERMISSIONS } from '../permissions';

interface AuthContextType {
    user: User | null;
    login: (email: string, pass: string) => Promise<{ success: boolean; error?: string }>;
    logout: () => void;
    register: (name: string, email: string, pass: string, role: UserRole) => Promise<{ success: boolean; error?: string }>;
    updateUserPassword: (newPassword: string, currentPassword?: string) => Promise<{ success: boolean; error?: string }>;
    sendPasswordResetEmail: (email: string) => Promise<{ success: boolean; error?: string }>;
    activeSchoolId: string | null;
    effectiveRole: UserRole | null;
    hasPermission: (permission: Permission) => boolean;
    authEvent: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeSchoolId, setActiveSchoolId] = useState<string | null>(null);
    const [authEvent, setAuthEvent] = useState<string | null>(null);

    // Hydrate session securely from serverless API /api/auth/me
    useEffect(() => {
        let isMounted = true;

        const verifySessionWithServer = async () => {
            try {
                const res = await fetch('/api/auth/me', {
                    method: 'GET',
                    credentials: 'include'
                });

                if (res.ok) {
                    const data = await res.json();
                    if (data?.user && isMounted) {
                        setUser(data.user);
                        setActiveSchoolId(data.user.schoolId || null);
                        return;
                    }
                }

                // If server returns 401/403 or invalid, clear local user state
                if (isMounted) {
                    setUser(null);
                }
            } catch (error) {
                console.warn("Auth server verification failed:", error);
                if (isMounted) {
                    setUser(null);
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        };

        verifySessionWithServer();

        return () => {
            isMounted = false;
        };
    }, []);

    const login = async (email: string, pass: string): Promise<{ success: boolean; error?: string }> => {
        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({ email, password: pass })
            });

            let data: any = null;
            const contentType = res.headers.get('content-type') || '';
            if (contentType.includes('application/json')) {
                data = await res.json().catch(() => null);
            }

            if (!res.ok) {
                if (res.status === 404) {
                    return {
                        success: false,
                        error: data?.error || 'Backend API not found (404). Please ensure vercel.json rewrites point to /api and the deployment is up to date.'
                    };
                }
                const errorMessage = data?.error || (await res.text().catch(() => '')) || `Authentication failed with status ${res.status}`;
                return {
                    success: false,
                    error: errorMessage
                };
            }

            if (!data || !data.success) {
                return { 
                    success: false, 
                    error: data?.error || 'Authentication failed. Please verify credentials.' 
                };
            }

            if (data.user) {
                setUser(data.user);
                setActiveSchoolId(data.user.schoolId || null);
            }

            setAuthEvent('SIGNED_IN');
            return { success: true };
        } catch (err: any) {
            console.error("Login request failed:", err);
            return { 
                success: false, 
                error: err?.message ? `Connection failed: ${err.message}` : 'Connection to authentication service failed. Please check network.' 
            };
        }
    };

    const logout = async () => {
        try {
            await fetch('/api/auth/logout', {
                method: 'POST',
                credentials: 'include'
            });
        } catch (err) {
            console.error("Logout API request error:", err);
        }

        setUser(null);
        setActiveSchoolId(null);
        window.location.reload();
    };

    const register = async (name: string, email: string, pass: string, role: UserRole): Promise<{ success: boolean; error?: string }> => {
        try {
            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name, email, password: pass, role })
            });

            const data = await res.json();
            if (!res.ok || !data.success) {
                return { success: false, error: data.error || 'Registration failed.' };
            }

            return { success: true };
        } catch (err: any) {
            console.error("Registration request error:", err);
            return { success: false, error: 'Registration service unreachable.' };
        }
    };

    const sendPasswordResetEmail = async (_email: string): Promise<{ success: boolean; error?: string }> => {
        return { success: false, error: 'Password reset via email is currently unavailable. Please contact an Administrator.' };
    };

    const updateUserPassword = async (newPassword: string, currentPassword?: string): Promise<{ success: boolean; error?: string }> => {
        if (!user) return { success: false, error: 'Not authenticated.' };

        try {
            const headers: Record<string, string> = {
                'Content-Type': 'application/json'
            };

            const res = await fetch('/api/auth/change-password', {
                method: 'POST',
                headers,
                credentials: 'include',
                body: JSON.stringify({
                    newPassword,
                    currentPassword,
                    targetUserId: user.id
                })
            });

            const data = await res.json();
            if (!res.ok || !data.success) {
                return { success: false, error: data.error || 'Failed to update password.' };
            }

            return { success: true };
        } catch (err: any) {
            console.error("Change password error:", err);
            return { success: false, error: 'Failed to communicate with password service.' };
        }
    };

    const effectiveRole = user?.role || null;

    const hasPermission = (permission: Permission): boolean => {
        if (!effectiveRole) return false;
        if (user?.role === UserRole.Owner) return true;
        if (user?.permissionsOverrides && user.permissionsOverrides[permission] !== undefined) {
            return user.permissionsOverrides[permission] as boolean;
        }
        const userPermissions = ROLE_PERMISSIONS[effectiveRole];
        return userPermissions?.includes(permission) || false;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen bg-secondary-50 dark:bg-secondary-900 text-primary-500">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-sm font-medium text-secondary-600 dark:text-secondary-300">Verifying session...</span>
                </div>
            </div>
        );
    }

    return (
        <AuthContext.Provider value={{
            user,
            login,
            logout,
            register,
            updateUserPassword,
            sendPasswordResetEmail,
            activeSchoolId,
            effectiveRole,
            hasPermission,
            authEvent
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
