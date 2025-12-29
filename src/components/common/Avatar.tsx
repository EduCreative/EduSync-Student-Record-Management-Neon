import type { FC } from 'react';
import { User, Student } from '../../types';

interface AvatarProps {
    user?: User | null;
    student?: Student | null;
    className?: string;
}

const Avatar: FC<AvatarProps> = ({ user, student, className = 'h-10 w-10' }) => {
    const target = user || student;

    if (!target) {
        return (
            <div className={`relative rounded-full flex items-center justify-center shrink-0 bg-secondary-200 dark:bg-secondary-700 ${className}`}>
                <svg className="w-full h-full text-secondary-400" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
            </div>
        );
    }

    const name = target.name || 'User';
    const avatarUrl = target.avatarUrl;

    const getInitials = (name: string) => {
        const nameParts = name.split(' ');
        if (nameParts.length > 1) {
            return `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`.toUpperCase();
        }
        return name.substring(0, 2).toUpperCase();
    };

    const colors = [
        'bg-primary-500', 'bg-green-500', 'bg-yellow-500', 'bg-indigo-500',
        'bg-pink-500', 'bg-purple-500', 'bg-red-500', 'bg-blue-500'
    ];

    const colorForName = (name: string) => {
        const charCodeSum = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        return colors[charCodeSum % colors.length];
    };

    return (
        <div className={`relative rounded-full flex items-center justify-center shrink-0 ${className}`}>
            {avatarUrl ? (
                <img className="object-cover w-full h-full rounded-full" src={avatarUrl} alt={name} />
            ) : (
                <div className={`w-full h-full rounded-full flex items-center justify-center text-white font-bold ${colorForName(name)}`}>
                    <span className="text-sm">{getInitials(name)}</span>
                </div>
            )}
        </div>
    );
};

export default Avatar;