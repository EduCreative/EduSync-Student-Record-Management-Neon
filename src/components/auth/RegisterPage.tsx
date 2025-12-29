import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../types';
import { EduSyncLogo } from '../../constants';

interface RegisterPageProps {
    onSwitchToLogin: () => void;
}

const UserIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
    </svg>
);

const MailIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="20" height="16" x="2" y="4" rx="2" />
        <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
);

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

const BriefcaseIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="7" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
);

const isValidEmail = (email: string): boolean => {
    if (!email) return false;
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email);
};

const RegisterPage: React.FC<RegisterPageProps> = ({ onSwitchToLogin }) => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [role, setRole] = useState<UserRole>(UserRole.Admin);
    const [error, setError] = useState('');
    const [formErrors, setFormErrors] = useState<{ name?: string, email?: string; password?: string, confirmPassword?: string }>({});
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const { register } = useAuth();

    // Define input styles inline to ensure they are applied correctly
    const inputAuthClass = "pl-10 appearance-none border rounded-lg w-full py-3 px-4 bg-black/20 text-white placeholder-purple-200/70 border-white/30 leading-tight focus:outline-none focus:ring-2 focus:ring-purple-400";

    const validate = () => {
        const newErrors: { name?: string, email?: string; password?: string, confirmPassword?: string } = {};
        if (!name.trim()) {
            newErrors.name = 'Full Name is required.';
        }
        if (!email.trim()) {
            newErrors.email = 'Email Address is required.';
        } else if (!isValidEmail(email)) {
            newErrors.email = 'Email address is invalid.';
        }
        if (password.length < 6) {
            newErrors.password = 'Password must be at least 6 characters long.';
        }
        if (password !== confirmPassword) {
            newErrors.confirmPassword = 'Passwords do not match.';
        }
        setFormErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };
    
    const handleInputChange = (setter: React.Dispatch<React.SetStateAction<string>>, field: keyof typeof formErrors) => (e: React.ChangeEvent<HTMLInputElement>) => {
        setter(e.target.value);
        if (formErrors[field]) {
            setFormErrors(prev => ({ ...prev, [field]: undefined }));
        }
    };


    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess(false);

        if (!validate()) {
            return;
        }

        setLoading(true);
        const result = await register(name, email, password, role);
        if (!result.success) {
            setError(result.error || 'An error occurred during registration.');
        } else {
            setSuccess(true);
        }
        setLoading(false);
    };

    if (success) {
        return (
            <div className="min-h-screen w-full bg-gradient-to-br from-purple-800 to-indigo-950 flex flex-col justify-center items-center p-4 text-white">
                <div className="w-full max-w-md bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl shadow-2xl p-8 sm:p-10 text-center">
                    <h1 className="text-2xl font-bold">Registration Successful!</h1>
                    <p className="text-purple-200 mt-4">
                        Your account has been created. An administrator will need to approve your account before you can log in.
                    </p>
                    <button onClick={onSwitchToLogin} className="mt-6 w-full bg-white text-purple-800 font-bold py-3 px-4 rounded-lg hover:bg-purple-100 transition-colors">
                        Back to Login
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen w-full bg-gradient-to-br from-purple-800 to-indigo-950 text-white lg:grid lg:grid-cols-2 relative">
             <div className="absolute inset-0 opacity-10">
                <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg"><defs><pattern id="p" width="80" height="80" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M40 0V80M0 40H80" stroke="white" strokeWidth="0.5"/></pattern></defs><rect width="100%" height="100%" fill="url(#p)"/></svg>
            </div>
            <div className="hidden lg:flex flex-col items-center justify-center p-12 relative">
                <div className="text-center space-y-6">
                     <div className="bg-white/20 p-4 rounded-full inline-block backdrop-blur-sm">
                        <EduSyncLogo className="h-20 w-20 text-white" />
                    </div>
                    <h2 className="text-5xl font-bold tracking-tight">
                        Join EduSync Today
                    </h2>
                    <p className="mt-4 text-lg text-purple-200 max-w-md mx-auto">
                        Streamline your school's management and enhance collaboration.
                    </p>
                </div>
                <div className="absolute bottom-8 text-sm text-purple-300">
                    &copy; {new Date().getFullYear()} EduSync. All rights reserved.
                </div>
            </div>
             <div className="flex items-center justify-center p-6 sm:p-12 w-full lg:py-0 relative">
                <div className="w-full max-w-md bg-black/20 backdrop-blur-lg border border-white/20 rounded-2xl shadow-2xl p-8 sm:p-10">
                    <div className="mb-8 text-center lg:text-left">
                        <h2 className="text-3xl font-bold tracking-tight text-white">
                            Create Account
                        </h2>
                        <p className="text-purple-200 mt-2">
                            Fill in your details to get started.
                        </p>
                    </div>

                    {error && <div className="bg-red-500/30 border border-red-500/50 text-white p-4 mb-6 rounded-md" role="alert">{error}</div>}

                    <form onSubmit={handleRegister} className="space-y-4" noValidate>
                        <div>
                            <label className="block text-purple-200 text-sm font-bold mb-2" htmlFor="name">Full Name</label>
                            <div className="relative">
                                <UserIcon className="pointer-events-none w-5 h-5 absolute top-1/2 transform -translate-y-1/2 left-3 text-purple-200/80"/>
                                <input id="name" type="text" value={name} onChange={handleInputChange(setName, 'name')} className={inputAuthClass} placeholder="John Doe" required />
                            </div>
                             {formErrors.name && <p className="text-red-400 text-xs mt-1">{formErrors.name}</p>}
                        </div>
                        <div>
                            <label className="block text-purple-200 text-sm font-bold mb-2" htmlFor="email">Email Address</label>
                             <div className="relative">
                                <MailIcon className="pointer-events-none w-5 h-5 absolute top-1/2 transform -translate-y-1/2 left-3 text-purple-200/80"/>
                                <input id="email" type="email" value={email} onChange={handleInputChange(setEmail, 'email')} className={inputAuthClass} placeholder="you@example.com" required />
                            </div>
                            {formErrors.email && <p className="text-red-400 text-xs mt-1">{formErrors.email}</p>}
                        </div>
                        <div>
                            <label className="block text-purple-200 text-sm font-bold mb-2" htmlFor="password">Password</label>
                            <div className="relative">
                                <LockIcon className="pointer-events-none w-5 h-5 absolute top-1/2 transform -translate-y-1/2 left-3 text-purple-200/80"/>
                                <input id="password" type={showPassword ? 'text' : 'password'} value={password} onChange={handleInputChange(setPassword, 'password')} className={inputAuthClass} placeholder="••••••••••••" required />
                                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 pr-3 flex items-center text-purple-200/80 hover:text-white" aria-label={showPassword ? 'Hide password' : 'Show password'} title={showPassword ? 'Hide password' : 'Show password'}>
                                    {showPassword ? <EyeOffIcon className="w-5 h-5"/> : <EyeIcon className="w-5 h-5"/>}
                                </button>
                            </div>
                            {formErrors.password && <p className="text-red-400 text-xs mt-1">{formErrors.password}</p>}
                        </div>
                        <div>
                            <label className="block text-purple-200 text-sm font-bold mb-2" htmlFor="confirmPassword">Confirm Password</label>
                            <div className="relative">
                                <LockIcon className="pointer-events-none w-5 h-5 absolute top-1/2 transform -translate-y-1/2 left-3 text-purple-200/80"/>
                                <input id="confirmPassword" type={showConfirmPassword ? 'text' : 'password'} value={confirmPassword} onChange={handleInputChange(setConfirmPassword, 'confirmPassword')} className={inputAuthClass} placeholder="••••••••••••" required />
                                <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute inset-y-0 right-0 pr-3 flex items-center text-purple-200/80 hover:text-white" aria-label={showConfirmPassword ? 'Hide password' : 'Show password'} title={showConfirmPassword ? 'Hide password' : 'Show password'}>
                                    {showConfirmPassword ? <EyeOffIcon className="w-5 h-5"/> : <EyeIcon className="w-5 h-5"/>}
                                </button>
                            </div>
                            {formErrors.confirmPassword && <p className="text-red-400 text-xs mt-1">{formErrors.confirmPassword}</p>}
                        </div>
                        <div>
                            <label className="block text-purple-200 text-sm font-bold mb-2" htmlFor="role">I am a...</label>
                            <div className="relative">
                                <BriefcaseIcon className="pointer-events-none w-5 h-5 absolute top-1/2 transform -translate-y-1/2 left-3 text-purple-200/80"/>
                                <select id="role" value={role} onChange={(e) => setRole(e.target.value as UserRole)} className={inputAuthClass}>
                                    <option className="text-black" value={UserRole.Admin}>Admin</option>
                                    <option className="text-black" value={UserRole.Accountant}>Accountant</option>
                                    <option className="text-black" value={UserRole.Teacher}>Teacher</option>
                                    <option className="text-black" value={UserRole.Parent}>Parent</option>
                                    <option className="text-black" value={UserRole.Student}>Student</option>
                                </select>
                            </div>
                        </div>
                        <div className="pt-2">
                            <button type="submit" disabled={loading} className="w-full bg-white text-purple-800 font-bold py-3 px-4 rounded-lg hover:bg-purple-100 transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center">
                                {loading ? <SpinnerIcon /> : 'Create Account'}
                            </button>
                        </div>
                    </form>

                    <p className="text-center text-purple-200 text-sm mt-6">
                        Already have an account?{' '}
                        <button onClick={onSwitchToLogin} className="font-semibold text-white hover:underline">
                            Sign In
                        </button>
                    </p>
                </div>
            </div>
        </div>
    );
};

const SpinnerIcon = () => (
    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-purple-800" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);


export default RegisterPage;