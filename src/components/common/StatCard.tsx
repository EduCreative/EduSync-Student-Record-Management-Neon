// FIX: Import `React` to make `React.cloneElement` available. The previous import was type-only.
import React, { type FC, type ReactElement } from 'react';

interface StatCardProps {
    title: string;
    value: string;
    // FIX: Changed icon type to ReactElement<any> to allow passing props like `className` via `cloneElement`.
    icon: ReactElement<any>;
    color: string;
}

const StatCard: FC<StatCardProps> = ({ title, value, icon, color }) => (
    <div className="bg-white dark:bg-secondary-800 p-6 rounded-xl shadow-lg flex items-center space-x-4 border border-secondary-200 dark:border-secondary-700 transition-all duration-300 hover:shadow-xl hover:border-primary-300 dark:hover:border-primary-600 hover:-translate-y-1">
        <div className={`p-3 rounded-full ${color}`}>
            {React.cloneElement(icon, { className: "w-6 h-6" })}
        </div>
        <div>
            <p className="text-sm text-secondary-500 dark:text-secondary-400">{title}</p>
            <p className="text-2xl font-bold text-secondary-800 dark:text-secondary-100">{value}</p>
        </div>
    </div>
);

export default StatCard;
