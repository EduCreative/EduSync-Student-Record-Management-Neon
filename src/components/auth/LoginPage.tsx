import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { EduSyncLogo } from '../../constants';

interface LoginPageProps {
    onSwitchToRegister: () => void;
    onForgotPassword: () => void;
}

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

const GoogleIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <title>Google</title>
        <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.85 3.18-1.73 4.1-1.02 1.02-2.62 2.04-4.82 2.04-5.82 0-9.6-4.82-9.6-9.6s3.78-9.6 9.6-9.6c2.53 0 4.46.93 5.96 2.33l2.04-2.04C18.96 1.82 16.11 0 12.48 0 5.82 0 .06 5.82.06 12.48s5.76 12.48 12.42 12.48c3.32 0 6.02-1.12 7.99-3.1 2.08-2.08 2.84-5.04 2.84-8.32 0-.66-.07-1.32-.2-1.98z" />
    </svg>
);

const LoginPage: React.FC<LoginPageProps> = ({ onSwitchToRegister, onForgotPassword }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        const { success, error: loginError } = await login(email, password);
        if (!success) {
            setError(loginError || 'Invalid email or password. Please try again.');
        }
        setLoading(false);
    };

    return (
        <div className="min-h-screen w-full bg-gradient-to-br from-primary-700 to-primary-950 text-white lg:grid lg:grid-cols-2 relative">
            <div className="absolute inset-0 opacity-10">
                <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg"><defs><pattern id="p" width="80" height="80" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M40 0V80M0 40H80" stroke="white" strokeWidth="0.5"/></pattern></defs><rect width="100%" height="100%" fill="url(#p)"/></svg>
            </div>
            <div className="hidden lg:flex flex-col items-center justify-center p-12 relative">
                <div className="text-center space-y-6">
                    <div className="bg-white/20 p-4 rounded-full inline-block backdrop-blur-sm">
                        <EduSyncLogo className="h-20 w-20 text-white" />
                    </div>
                    <h2 className="text-5xl font-bold tracking-tight">
                        Welcome to EduSync
                    </h2>
                    <p className="mt-4 text-lg text-primary-200 max-w-md mx-auto">
                        The all-in-one solution for modern school management.
                    </p>
                </div>
                <div className="absolute bottom-8 text-sm text-primary-300">
                    &copy; {new Date().getFullYear()} EduSync. All rights reserved.
                </div>
            </div>
            <div className="flex items-center justify-center p-6 sm:p-12 w-full lg:py-0 relative">
                <div className="w-full max-w-md bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl shadow-2xl p-8 sm:p-10">
                    <div className="mb-8 text-center lg:text-left">
                        <h2 className="text-3xl font-bold tracking-tight text-white">
                            Sign In
                        </h2>
                        <p className="text-primary-200 mt-2">
                            Enter your credentials to access your account.
                        </p>
                    </div>

                    {error && <div className="bg-red-500/30 border border-red-500/50 text-white p-4 mb-6 rounded-md" role="alert">{error}</div>}

                    <form onSubmit={handleLogin} className="space-y-6">
                        <div>
                            <label className="block text-primary-200 text-sm font-bold mb-2" htmlFor="email">Email Address</label>
                            <div className="relative">
                                <MailIcon className="pointer-events-none w-5 h-5 absolute top-1/2 transform -translate-y-1/2 left-3 text-primary-200/80"/>
                                <input
                                    id="email"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="pl-10 appearance-none border rounded-lg w-full py-3 px-4 bg-black/20 text-white placeholder-primary-200/70 border-white/30 leading-tight focus:outline-none focus:ring-2 focus:ring-primary-400"
                                    placeholder="you@example.com"
                                    required
                                    aria-label="Email Address"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-primary-200 text-sm font-bold mb-2" htmlFor="password">Password</label>
                            <div className="relative">
                                <LockIcon className="pointer-events-none w-5 h-5 absolute top-1/2 transform -translate-y-1/2 left-3 text-primary-200/80"/>
                                <input
                                    id="password"
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="pl-10 appearance-none border rounded-lg w-full py-3 px-4 bg-black/20 text-white placeholder-primary-200/70 border-white/30 leading-tight focus:outline-none focus:ring-2 focus:ring-primary-400"
                                    placeholder="••••••••••••"
                                    required
                                    aria-label="Password"
                                />
                                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 pr-3 flex items-center text-primary-200/80 hover:text-white" aria-label={showPassword ? 'Hide password' : 'Show password'} title={showPassword ? 'Hide password' : 'Show password'}>
                                    {showPassword ? <EyeOffIcon className="w-5 h-5"/> : <EyeIcon className="w-5 h-5"/>}
                                </button>
                            </div>
                        </div>

                        <div className="flex items-center justify-between text-sm">
                            <label className="flex items-center text-primary-200 cursor-pointer">
                                <input 
                                    className="h-4 w-4 text-primary-500 rounded border-white/50 focus:ring-primary-400 bg-white/20"
                                    type="checkbox"
                                    checked={rememberMe}
                                    onChange={(e) => setRememberMe(e.target.checked)}
                                />
                                <span className="ml-2">Remember me</span>
                            </label>
                            <button type="button" onClick={onForgotPassword} className="font-semibold text-primary-300 hover:text-white">
                                Forgot password?
                            </button>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-white text-primary-800 font-bold py-3 px-4 rounded-lg hover:bg-primary-100 transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                        >
                            {loading ? <SpinnerIcon /> : 'Sign In'}
                        </button>
                    </form>

                    <div className="my-6 flex items-center">
                        <div className="flex-grow border-t border-white/20"></div>
                        <span className="flex-shrink mx-4 text-xs text-primary-200 uppercase">Or</span>
                        <div className="flex-grow border-t border-white/20"></div>
                    </div>

                    <div className="flex items-center justify-center gap-4">
                        <button className="w-full flex items-center justify-center gap-2 py-2.5 border border-white/30 rounded-lg text-sm font-medium text-white hover:bg-white/20 transition">
                           <GoogleIcon className="w-5 h-5 fill-white" /> Sign in with Google
                        </button>
                    </div>

                    <p className="text-center text-primary-200 text-sm mt-8">
                        Don't have an account?{' '}
                        <button onClick={onSwitchToRegister} className="font-semibold text-white hover:underline">
                            Sign up
                        </button>
                    </p>
                </div>
            </div>
        </div>
    );
};

const SpinnerIcon = () => (
    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-primary-800" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);


export default LoginPage;