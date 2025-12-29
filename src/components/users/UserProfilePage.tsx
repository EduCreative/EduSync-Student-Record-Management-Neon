import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { useToast } from '../../context/ToastContext';
import ImageUpload from '../common/ImageUpload';

interface UserProfilePageProps {
    // setActiveView: (view: ActiveView) => void;
}

const UserProfilePage: React.FC<UserProfilePageProps> = () => {
    const { user, updateUserPassword } = useAuth();
    const { getSchoolById, updateUser } = useData();
    const { showToast } = useToast();

    const [name, setName] = useState(user?.name || '');
    const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl);
    const [isProfileSaving, setIsProfileSaving] = useState(false);
    
    const [password, setPassword] = useState({ new: '', confirm: '' });
    const [passwordErrors, setPasswordErrors] = useState<{ new?: string; confirm?: string }>({});
    const [isPasswordSaving, setIsPasswordSaving] = useState(false);
    
    // Reset form state if user context changes
    useEffect(() => {
        if (user) {
            setName(user.name);
            setAvatarUrl(user.avatarUrl);
        }
    }, [user]);

    const school = user?.schoolId != null ? getSchoolById(user.schoolId) : null;

    const handleProfileUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !name.trim()) return;

        setIsProfileSaving(true);
        try {
            await updateUser({
                ...user,
                name,
                avatarUrl,
            });
            showToast('Success', 'Profile updated successfully!', 'success');
        } catch (error) {
            showToast('Error', 'Failed to update profile.', 'error');
        } finally {
            setIsProfileSaving(false);
        }
    };
    
    const handlePasswordChange = async (e: React.FormEvent) => {
        e.preventDefault();
        setPasswordErrors({});
        
        if (password.new.length < 6) {
            setPasswordErrors(p => ({...p, new: 'Password must be at least 6 characters.'}));
            return;
        }

        if (password.new !== password.confirm) {
            setPasswordErrors(p => ({...p, confirm: 'New passwords do not match.'}));
            return;
        }
        
        setIsPasswordSaving(true);
        try {
            const { success, error } = await updateUserPassword(password.new);
            if (success) {
                showToast('Success', 'Password changed successfully!', 'success');
                setPassword({ new: '', confirm: '' });
            } else {
                showToast('Error', error || 'Failed to change password.', 'error');
            }
        } catch (e) {
            showToast('Error', 'An unexpected error occurred while changing password.', 'error');
        } finally {
            setIsPasswordSaving(false);
        }
    };

    if (!user) {
        return <div>Loading profile...</div>;
    }

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <h1 className="text-3xl font-bold text-secondary-900 dark:text-white">My Profile</h1>

            {/* Profile Details & Update Form */}
            <form onSubmit={handleProfileUpdate} className="bg-white dark:bg-secondary-800 rounded-lg shadow-md p-6">
                <h2 className="text-xl font-semibold border-b pb-3 dark:border-secondary-700 mb-6">Profile Information</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-1 flex flex-col items-center">
                        <ImageUpload imageUrl={avatarUrl} onChange={setAvatarUrl} />
                        <p className="text-sm text-secondary-500 mt-2 text-center">Update your profile picture.</p>
                    </div>

                    <div className="md:col-span-2 space-y-4">
                        <div>
                            <label className="input-label">Full Name</label>
                            <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="input-field" />
                        </div>
                        <div>
                            <label className="input-label">Email Address</label>
                            <input type="email" value={user.email} className="input-field" disabled />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="input-label">Role</label>
                                <input type="text" value={user.role} className="input-field" disabled />
                            </div>
                            {school && (
                                <div>
                                    <label className="input-label">School</label>
                                    <input type="text" value={school.name} className="input-field" disabled />
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex justify-end pt-6 border-t dark:border-secondary-700 mt-6">
                    <button type="submit" className="btn-primary" disabled={isProfileSaving}>
                        {isProfileSaving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </form>

            {/* Password Change Form */}
            <form onSubmit={handlePasswordChange} className="bg-white dark:bg-secondary-800 rounded-lg shadow-md p-6">
                <h2 className="text-xl font-semibold border-b pb-3 dark:border-secondary-700 mb-6">Change Password</h2>
                <div className="space-y-4 max-w-md">
                    <div>
                        <label className="input-label" htmlFor="new-password">New Password</label>
                        <input id="new-password" type="password" value={password.new} onChange={e => setPassword(p => ({...p, new: e.target.value}))} className="input-field" />
                        {passwordErrors.new && <p className="text-red-500 text-xs mt-1">{passwordErrors.new}</p>}
                    </div>
                    <div>
                        <label className="input-label" htmlFor="confirm-password">Confirm New Password</label>
                        <input id="confirm-password" type="password" value={password.confirm} onChange={e => setPassword(p => ({...p, confirm: e.target.value}))} className="input-field" />
                        {passwordErrors.confirm && <p className="text-red-500 text-xs mt-1">{passwordErrors.confirm}</p>}
                    </div>
                </div>
                <div className="flex justify-end pt-6 border-t dark:border-secondary-700 mt-6">
                    <button type="submit" className="btn-primary" disabled={isPasswordSaving}>
                        {isPasswordSaving ? 'Saving...' : 'Update Password'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default UserProfilePage;