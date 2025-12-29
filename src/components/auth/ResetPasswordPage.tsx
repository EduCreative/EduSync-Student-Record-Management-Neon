import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { EduSyncLogo } from '../../constants';
import { useToast } from '../../context/ToastContext';

interface ResetPasswordPageProps {
    onResetSuccess: () => void;
}

const LockIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
);

const ResetPasswordPage: React.FC<ResetPasswordPageProps> = ({ onResetSuccess }) => {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { updateUserPassword } = useAuth();
    const { showToast } = useToast();

    const handleReset = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password.length < 6) {
            setError('Password must be at least 6 characters long.');
            return;
        }
        if (password !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }

        setError('');
        setLoading(true);
        const { success, error: resetError } = await updateUserPassword(password);
        if (success) {
            showToast('Success', 'Your password has been reset successfully.', 'success');
            onResetSuccess();
        } else {
            setError(resetError || 'Failed to reset password. The link may have expired.');
        }
        setLoading(false);
    };

    return (
        <div className="min-h-screen w-full bg-gradient-to-br from-primary-700 to-primary-950 flex items-center justify-center p-6 sm:p-12 relative">
             <div className="absolute inset-0 opacity-10">
                <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg"><defs><pattern id="p" width="80" height="80" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M40 0V80M0 40H80" stroke="white" strokeWidth="0.5"/></pattern></defs><rect width="100%" height="100%" fill="url(#p)"/></svg>
            </div>
            <div className="w-full max-w-md bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl shadow-2xl p-8 sm:p-10">
                <div className="mb-8 text-center">
                    <EduSyncLogo className="h-12 w-12 text-white mx-auto mb-4" />
                    <h2 className="text-3xl font-bold tracking-tight text-white">
                        Set New Password
                    </h2>
                    <p className="text-primary-200 mt-2">
                        Enter and confirm your new password below.
                    </p>
                </div>
                {error && <div className="bg-red-500/30 border border-red-500/50 text-white p-4 mb-6 rounded-md" role="alert">{error}</div>}
                <form onSubmit={handleReset} className="space-y-6">
                    <div>
                        <label className="block text-primary-200 text-sm font-bold mb-2" htmlFor="password">New Password</label>
                        <div className="relative">
                            <LockIcon className="pointer-events-none w-5 h-5 absolute top-1/2 transform -translate-y-1/2 left-3 text-primary-200/80"/>
                            <input
                                id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                                className="pl-10 appearance-none border rounded-lg w-full py-3 px-4 bg-white/20 text-white placeholder-primary-200/70 border-white/30 leading-tight focus:outline-none focus:ring-2 focus:ring-primary-400"
                                placeholder="••••••••••••" required
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-primary-200 text-sm font-bold mb-2" htmlFor="confirmPassword">Confirm New Password</label>
                        <div className="relative">
                            <LockIcon className="pointer-events-none w-5 h-5 absolute top-1/2 transform -translate-y-1/2 left-3 text-primary-200/80"/>
                            <input
                                id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                                className="pl-10 appearance-none border rounded-lg w-full py-3 px-4 bg-white/20 text-white placeholder-primary-200/70 border-white/30 leading-tight focus:outline-none focus:ring-2 focus:ring-primary-400"
                                placeholder="••••••••••••" required
                            />
                        </div>
                    </div>
                    <button type="submit" disabled={loading} className="w-full bg-white text-primary-800 font-bold py-3 px-4 rounded-lg hover:bg-primary-100 transition-colors duration-300 disabled:opacity-50">
                        {loading ? 'Saving...' : 'Update Password'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default ResetPasswordPage;
