
import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { User, UserRole } from '../types';
import { sql } from '../lib/neonClient';
import { Permission, ROLE_PERMISSIONS } from '../permissions';
import { toCamelCase } from '../utils/caseConverter';

interface AuthContextType {
    user: User | null;
    login: (email: string, pass: string) => Promise<{ success: boolean; error?: string }>;
    logout: () => void;
    register: (name: string, email: string, pass: string, role: UserRole) => Promise<{ success: boolean; error?: string }>;
    updateUserPassword: (newPassword: string) => Promise<{ success: boolean; error?: string }>;
    sendPasswordResetEmail: (email: string) => Promise<{ success: boolean; error?: string }>;
    activeSchoolId: string | null;
    switchSchoolContext: (schoolId: string | null) => void;
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

    useEffect(() => {
        const checkInitialSession = async () => {
            try {
                const storedUser = localStorage.getItem('edusync_user');
                if (storedUser) {
                    const userProfile = JSON.parse(storedUser) as User;
                    setUser(userProfile);
                    if (userProfile.role !== UserRole.Owner) {
                        setActiveSchoolId(userProfile.schoolId);
                    }
                }
            } catch (error) {
                console.error("Auth hydration failed:", error);
            } finally {
                setLoading(false);
            }
        };
        
        checkInitialSession();
    }, []);


    const login = async (email: string, pass: string): Promise<{ success: boolean; error?: string }> => {
        try {
            // Note: In a production app, password comparison MUST happen server-side with hashing.
            // For this migration, we check the database directly.
            const results = await sql`SELECT * FROM profiles WHERE email = ${email} AND password = ${pass} LIMIT 1`;
            
            if (results.length === 0) {
                return { success: false, error: 'Invalid email or password.' };
            }

            const profile = results[0];

            if (profile.status === 'Pending Approval') {
                return { success: false, error: 'Your account is pending approval.' };
            }
            
            if (profile.status === 'Suspended' || profile.status === 'Inactive') {
                return { success: false, error: 'Your account is inactive.' };
            }

            const userProfile = toCamelCase(profile) as User;
            setUser(userProfile);
            localStorage.setItem('edusync_user', JSON.stringify(userProfile));

            if (userProfile.role !== UserRole.Owner) {
                setActiveSchoolId(userProfile.schoolId);
            }

            await sql`UPDATE profiles SET last_login = ${new Date().toISOString()} WHERE id = ${profile.id}`;
            
            setAuthEvent('SIGNED_IN');
            return { success: true };
        } catch (err: any) {
            return { success: false, error: 'Connection failed. Please try again.' };
        }
    };
    
    const logout = () => {
        setUser(null);
        setActiveSchoolId(null);
        localStorage.removeItem('edusync_user');
        window.location.reload();
    };
    
    const register = async (name: string, email: string, pass: string, role: UserRole): Promise<{ success: boolean; error?: string }> => {
        try {
            const existing = await sql`SELECT id FROM profiles WHERE email = ${email}`;
            if (existing.length > 0) {
                return { success: false, error: "Email already registered." };
            }

            const userId = crypto.randomUUID();
            await sql`
                INSERT INTO profiles (id, name, email, password, role, status)
                VALUES (${userId}, ${name}, ${email}, ${pass}, ${role}, 'Pending Approval')
            `;
    
            return { success: true };
        } catch (err: any) {
            return { success: false, error: "Registration failed." };
        }
    };
    
    const sendPasswordResetEmail = async (email: string): Promise<{ success: boolean; error?: string }> => {
        // Neon doesn't have built-in email auth service like Supabase
        return { success: false, error: 'Password reset via email is currently unavailable. Please contact an Admin.' };
    };

    const updateUserPassword = async (newPassword: string): Promise<{ success: boolean; error?: string }> => {
        if (!user) return { success: false, error: 'Not authenticated.' };
        try {
            await sql`UPDATE profiles SET password = ${newPassword} WHERE id = ${user.id}`;
            return { success: true };
        } catch (err: any) {
            return { success: false, error: err.message };
        }
    };

    const switchSchoolContext = (schoolId: string | null) => {
        if (user?.role === UserRole.Owner) {
            setActiveSchoolId(schoolId);
        }
    };

    const effectiveRole = user?.role === UserRole.Owner && activeSchoolId ? UserRole.Admin : user?.role || null;

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
        return <div className="flex items-center justify-center h-screen bg-secondary-50 dark:bg-secondary-900 text-primary-500">Loading...</div>;
    }

    return (
        <AuthContext.Provider value={{ user, login, logout, register, updateUserPassword, sendPasswordResetEmail, activeSchoolId, switchSchoolContext, effectiveRole, hasPermission, authEvent }}>
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
