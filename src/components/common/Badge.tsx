
import type { FC, ReactNode } from 'react';

interface BadgeProps {
    children: ReactNode;
    color?: 'primary' | 'secondary' | 'green' | 'red' | 'yellow' | 'blue' | 'indigo' | 'purple' | 'pink';
}

const Badge: FC<BadgeProps> = ({ children, color = 'primary' }) => {
    const colorClasses: Record<string, string> = {
        primary: 'bg-primary-100 text-primary-800 dark:bg-primary-900 dark:text-primary-300',
        secondary: 'bg-secondary-100 text-secondary-800 dark:bg-secondary-700 dark:text-secondary-300',
        green: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
        red: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
        yellow: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
        blue: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
        indigo: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300',
        purple: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
        pink: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-300',
    };

    return (
        <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full ${colorClasses[color]}`}>
            {children}
        </span>
    );
};

export default Badge;