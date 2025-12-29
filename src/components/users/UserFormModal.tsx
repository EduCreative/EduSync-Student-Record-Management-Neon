
import React, { useState, useEffect, useMemo } from 'react';
import { User, UserRole } from '../../types';
import Modal from '../common/Modal';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { NAV_LINKS } from '../../constants';
import ImageUpload from '../common/ImageUpload';
import { useToast } from '../../context/ToastContext';
import { Permission } from '../../permissions';

const LockIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
);

const EyeIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
        <circle cx="12" cy="12" r="3" />
    </svg>
);

const EyeOffIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
        <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
        <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
        <line x1="2" x2="22" y1="2" y2="22" />
    </svg>
);

interface UserFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (user: User | (Omit<User, 'id' | 'lastLogin' | 'disabledNavLinks' | 'permissionsOverrides'> & { disabledNavLinks?: string[], password?: string, permissionsOverrides?: Partial<Record<Permission, boolean>> })) => Promise<void>;
    userToEdit?: User | null;
    defaultRole?: UserRole;
    lockRole?: boolean;
}

const isValidEmail = (email: string): boolean => {
    if (!email) return false;
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email);
};

// Define permission groups for comprehensive display
const PERMISSION_GROUPS = [
    {
        title: 'Fees & Finance',
        permissions: [
            { key: Permission.CAN_MANAGE_FEES, label: 'Manage Fees (Challans/Payments)' },
            { key: Permission.CAN_MANAGE_FEE_HEADS, label: 'Manage Fee Heads' },
            { key: Permission.CAN_SEND_FEE_REMINDERS, label: 'Send Fee Reminders' },
            { key: Permission.CAN_VIEW_FINANCIAL_REPORTS, label: 'View Financial Reports' },
        ]
    },
    {
        title: 'Student Management',
        permissions: [
            { key: Permission.CAN_VIEW_STUDENTS, label: 'View Students' },
            { key: Permission.CAN_EDIT_STUDENTS, label: 'Create/Edit Students' },
            { key: Permission.CAN_DELETE_STUDENTS, label: 'Delete Students' },
            { key: Permission.CAN_PROMOTE_STUDENTS, label: 'Promote Students' },
            { key: Permission.CAN_GENERATE_ID_CARDS, label: 'Generate ID Cards' },
        ]
    },
    {
        title: 'Class Management',
        permissions: [
            { key: Permission.CAN_VIEW_CLASSES, label: 'View Classes' },
            { key: Permission.CAN_EDIT_CLASSES, label: 'Create/Edit Classes' },
            { key: Permission.CAN_DELETE_CLASSES, label: 'Delete Classes' },
        ]
    },
    {
        title: 'Academic',
        permissions: [
            { key: Permission.CAN_MANAGE_ATTENDANCE, label: 'Manage Attendance' },
            { key: Permission.CAN_MANAGE_RESULTS, label: 'Manage Results' },
            { key: Permission.CAN_VIEW_ACADEMIC_REPORTS, label: 'View Academic Reports' },
        ]
    },
    {
        title: 'User Administration',
        permissions: [
            { key: Permission.CAN_MANAGE_USERS, label: 'Manage Users' },
            { key: Permission.CAN_DELETE_USERS, label: 'Delete Users' },
        ]
    },
];

const UserFormModal: React.FC<UserFormModalProps> = ({ isOpen, onClose, onSave, userToEdit, defaultRole, lockRole = false }) => {
    const { user: currentUser, activeSchoolId } = useAuth();
    const { schools } = useData();
    const { showToast } = useToast();
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        role: defaultRole || UserRole.Student,
        schoolId: '',
        status: 'Pending Approval' as User['status'],
        avatarUrl: null as string | null | undefined,
    });
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isSendingReset, setIsSendingReset] = useState(false);
    const [disabledLinks, setDisabledLinks] = useState<Record<string, boolean>>({});
    const [permissionsOverrides, setPermissionsOverrides] = useState<Partial<Record<Permission, boolean>>>({});
    const [errors, setErrors] = useState<{ name?: string; email?: string; role?: string; schoolId?: string; password?: string; confirmPassword?: string; }>({});

    const isOwnerGlobalView = currentUser?.role === UserRole.Owner && !activeSchoolId;
    const effectiveSchoolId = currentUser?.role === UserRole.Owner && activeSchoolId ? activeSchoolId : currentUser?.schoolId;
    
    // Ensure links are consistently ordered as per NAV_LINKS definition
    const linksForRole = NAV_LINKS[formData.role] || [];

    useEffect(() => {
        if (isOpen) {
            if (userToEdit) {
                setFormData({
                    name: userToEdit.name,
                    email: userToEdit.email,
                    role: userToEdit.role,
                    schoolId: userToEdit.schoolId || '',
                    status: userToEdit.status,
                    avatarUrl: userToEdit.avatarUrl,
                });
                const initialDisabled: Record<string, boolean> = {};
                if (userToEdit.disabledNavLinks) {
                    userToEdit.disabledNavLinks.forEach(path => {
                        initialDisabled[path] = true;
                    });
                }
                setDisabledLinks(initialDisabled);
                setPermissionsOverrides(userToEdit.permissionsOverrides || {});
            } else {
                setFormData({
                    name: '',
                    email: '',
                    role: defaultRole || UserRole.Student,
                    schoolId: effectiveSchoolId || '',
                    status: 'Pending Approval',
                    avatarUrl: null,
                });
                setDisabledLinks({});
                setPermissionsOverrides({});
            }
            setPassword('');
            setConfirmPassword('');
            setErrors({});
        }
    }, [userToEdit, isOpen, currentUser, schools, defaultRole, effectiveSchoolId]);

    const validate = () => {
        const newErrors: { name?: string; email?: string; role?: string; schoolId?: string; password?: string; confirmPassword?: string; } = {};
        
        if (!formData.name.trim()) {
            newErrors.name = 'Full Name is required.';
        } else if (formData.name.trim().length < 3) {
            newErrors.name = 'Full name must be at least 3 characters.';
        }

        if (!formData.email.trim()) {
            newErrors.email = 'Email Address is required.';
        } else if (!isValidEmail(formData.email)) {
            newErrors.email = 'Email address is invalid.';
        }
        
        if (!userToEdit) {
            if (password.length < 6) {
                newErrors.password = 'Password must be at least 6 characters long.';
            } else if (password !== confirmPassword) {
                newErrors.confirmPassword = 'Passwords do not match.';
            }
        }

        if (!formData.role) {
            newErrors.role = 'A user role must be selected.';
        }

        if (isOwnerGlobalView && !formData.schoolId) {
            newErrors.schoolId = 'A school must be selected.';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (errors[name as keyof typeof errors]) {
            setErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[name as keyof typeof errors];
                return newErrors;
            });
        }
    };

    const handleLinkToggle = (path: string) => {
        setDisabledLinks(prev => ({
            ...prev,
            [path]: !prev[path],
        }));
    };

    const handleSendResetEmail = async () => {
        if (!userToEdit) return;
    
        setIsSendingReset(true);
        try {
            // Simplified reset email logic as custom Neon Auth doesn't have an automated emailer yet
            showToast('Info', `Feature coming soon. Please manually reset the password for ${userToEdit.email}.`, 'info');
        } catch (e: any) {
            showToast('Error', e.message || 'An unexpected error occurred.', 'error');
        } finally {
            setIsSendingReset(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validate()) {
            return;
        }

        setIsSaving(true);
        try {
            const disabledNavLinks = Object.entries(disabledLinks)
                .filter(([, isDisabled]) => isDisabled)
                .map(([path]) => path);

            if (userToEdit) {
                await onSave({ ...userToEdit, ...formData, disabledNavLinks, permissionsOverrides });
            } else {
                await onSave({ ...formData, password, disabledNavLinks, permissionsOverrides });
            }
            onClose();
        } catch (error) {
            console.error("Failed to save user:", error);
        } finally {
            setIsSaving(false);
        }
    };

    const availableRoles = useMemo(() => {
        if (!currentUser) return [];

        switch (currentUser.role) {
            case UserRole.Owner:
                return Object.values(UserRole);
            
            case UserRole.Admin:
                return Object.values(UserRole).filter(role => ![UserRole.Owner, UserRole.Admin].includes(role));

            case UserRole.Teacher:
            case UserRole.Accountant:
                return [UserRole.Parent, UserRole.Student];

            default:
                return [];
        }
    }, [currentUser]);

    const handlePermissionChange = (permission: Permission, value: string) => {
        setPermissionsOverrides(prev => {
            const newOverrides = { ...prev };
            if (value === 'default') {
                delete newOverrides[permission];
            } else {
                newOverrides[permission] = value === 'allow';
            }
            return newOverrides;
        });
    };
    
    const renderPermissionSelector = (permission: Permission, label: string) => {
        const override = permissionsOverrides[permission];
        let currentValue = 'default';
        if (override === true) {
            currentValue = 'allow';
        } else if (override === false) {
            currentValue = 'deny';
        }
    
        return (
            <div className="flex items-center justify-between py-1" key={permission}>
                <label htmlFor={`perm-${permission}`} className="text-sm text-secondary-800 dark:text-secondary-200">{label}</label>
                <select
                    id={`perm-${permission}`}
                    value={currentValue}
                    onChange={e => handlePermissionChange(permission, e.target.value)}
                    className="input-field text-xs py-1 px-2 w-32"
                >
                    <option value="default">Default</option>
                    <option value="allow">Allow</option>
                    <option value="deny">Deny</option>
                </select>
            </div>
        );
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={userToEdit ? 'Edit User' : 'Add New User'}>
            <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2" noValidate>
                <ImageUpload 
                  imageUrl={formData.avatarUrl}
                  onChange={(newAvatarUrl) => setFormData(prev => ({...prev, avatarUrl: newAvatarUrl}))}
                />
                <div>
                    <label htmlFor="name" className="input-label">Full Name</label>
                    <input type="text" name="name" id="name" value={formData.name} onChange={handleChange} required className="input-field" />
                    {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
                </div>
                <div>
                    <label htmlFor="email" className="input-label">Email Address</label>
                    <input type="email" name="email" id="email" value={formData.email} onChange={handleChange} required className="input-field" />
                    {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
                </div>
                {!userToEdit && (
                    <>
                        <div>
                            <label htmlFor="password" className="input-label">Set Initial Password</label>
                            <div className="relative">
                                <LockIcon className="pointer-events-none w-5 h-5 absolute top-1/2 transform -translate-y-1/2 left-3 text-secondary-400"/>
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    name="password"
                                    id="password"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    required
                                    className="input-field pl-10"
                                    placeholder="••••••••"
                                />
                                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 pr-3 flex items-center text-secondary-500 hover:text-secondary-700 dark:text-secondary-400 dark:hover:text-secondary-200" title={showPassword ? 'Hide password' : 'Show password'} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                                    {showPassword ? <EyeOffIcon className="w-5 h-5"/> : <EyeIcon className="w-5 h-5"/>}
                                </button>
                            </div>
                            {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
                        </div>
                        <div>
                            <label htmlFor="confirmPassword" className="input-label">Confirm Password</label>
                            <div className="relative">
                                <LockIcon className="pointer-events-none w-5 h-5 absolute top-1/2 transform -translate-y-1/2 left-3 text-secondary-400"/>
                                <input
                                    type={showConfirmPassword ? 'text' : 'password'}
                                    name="confirmPassword"
                                    id="confirmPassword"
                                    value={confirmPassword}
                                    onChange={e => setConfirmPassword(e.target.value)}
                                    required
                                    className="input-field pl-10"
                                    placeholder="••••••••"
                                />
                                <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute inset-y-0 right-0 pr-3 flex items-center text-secondary-500 hover:text-secondary-700 dark:text-secondary-400 dark:hover:text-secondary-200" title={showConfirmPassword ? 'Hide password' : 'Show password'} aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}>
                                    {showConfirmPassword ? <EyeOffIcon className="w-5 h-5"/> : <EyeIcon className="w-5 h-5"/>}
                                </button>
                            </div>
                            {errors.confirmPassword && <p className="text-red-500 text-xs mt-1">{errors.confirmPassword}</p>}
                        </div>
                    </>
                )}
                <div>
                    <label htmlFor="role" className="input-label">Role</label>
                    <select name="role" id="role" value={formData.role} onChange={handleChange} required className="input-field" disabled={lockRole}>
                        {availableRoles.map(role => (
                            <option key={role} value={role}>{role}</option>
                        ))}
                    </select>
                    {errors.role && <p className="text-red-500 text-xs mt-1">{errors.role}</p>}
                </div>
                {isOwnerGlobalView && (
                    <div>
                        <label htmlFor="schoolId" className="input-label">School</label>
                        <select name="schoolId" id="schoolId" value={formData.schoolId} onChange={handleChange} required className="input-field">
                            <option value="">Select a school</option>
                            {schools.map(school => (
                                <option key={school.id} value={school.id}>{school.name}</option>
                            ))}
                        </select>
                        {errors.schoolId && <p className="text-red-500 text-xs mt-1">{errors.schoolId}</p>}
                    </div>
                )}
                {userToEdit && (
                     <div>
                        <label htmlFor="status" className="input-label">Status</label>
                        <select name="status" id="status" value={formData.status} onChange={handleChange} className="input-field">
                            <option value="Active">Active</option>
                            <option value="Inactive">Inactive</option>
                            <option value="Pending Approval">Pending Approval</option>
                            <option value="Suspended">Suspended</option>
                        </select>
                    </div>
                )}
                 {currentUser?.role === UserRole.Owner && userToEdit && (
                    <div className="pt-2">
                        <label className="input-label mb-2">Menu Permissions</label>
                        <div className="space-y-2 max-h-40 overflow-y-auto p-3 bg-secondary-50 dark:bg-secondary-700 rounded-md border dark:border-secondary-600">
                             {linksForRole.length > 0 ? linksForRole.map(link => (
                                <label key={link.path} className="flex items-center space-x-3 cursor-pointer hover:bg-secondary-100 dark:hover:bg-secondary-600 p-1 rounded">
                                    <input
                                        type="checkbox"
                                        checked={!disabledLinks[link.path]}
                                        onChange={() => handleLinkToggle(link.path)}
                                        className="h-4 w-4 rounded border-secondary-300 text-primary-600 focus:ring-primary-500"
                                    />
                                    <span className="text-secondary-800 dark:text-secondary-200">{link.name}</span>
                                </label>
                            )) : (
                                <p className="text-sm text-secondary-500">No menu items available for this role.</p>
                            )}
                        </div>
                    </div>
                )}

                {(currentUser?.role === UserRole.Owner || currentUser?.role === UserRole.Admin) &&
                userToEdit && userToEdit.id !== currentUser.id && (
                    <div className="pt-2">
                        <label className="input-label mb-2 font-semibold">Fine-Grained Permissions</label>
                        <div className="space-y-4 p-3 bg-secondary-50 dark:bg-secondary-700 rounded-md border dark:border-secondary-600">
                            {PERMISSION_GROUPS.map(group => (
                                <div key={group.title}>
                                    <h4 className="font-bold text-primary-700 dark:text-primary-300 text-xs uppercase mb-2 pb-1 border-b dark:border-secondary-600">{group.title}</h4>
                                    <div className="pl-1 space-y-1">
                                        {group.permissions.map(perm => renderPermissionSelector(perm.key, perm.label))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="flex justify-end space-x-3 pt-4">
                    <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
                    <button type="submit" className="btn-primary" disabled={isSaving}>
                        {isSaving ? 'Saving...' : 'Save User'}
                    </button>
                </div>

                {userToEdit && (currentUser?.role === UserRole.Owner || currentUser?.role === UserRole.Admin) && (
                    <div className="border-t dark:border-secondary-700 pt-4 mt-4">
                        <h3 className="input-label font-semibold">Reset Password</h3>
                        <p className="text-sm text-secondary-500 dark:text-secondary-400 mb-2">
                            Notify user of password reset instructions.
                        </p>
                        <div className="flex items-center space-x-2">
                            <button
                                type="button"
                                onClick={handleSendResetEmail}
                                className="btn-secondary"
                                disabled={isSendingReset}
                            >
                                {isSendingReset ? 'Processing...' : 'Reset Password'}
                            </button>
                        </div>
                    </div>
                )}
            </form>
        </Modal>
    );
};

export default UserFormModal;
