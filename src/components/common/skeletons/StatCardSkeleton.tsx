import type { FC } from 'react';

const StatCardSkeleton: FC = () => (
    <div className="bg-white dark:bg-secondary-800 p-6 rounded-xl shadow-lg flex items-center space-x-4 border border-secondary-200 dark:border-secondary-700">
        <div className="p-3 rounded-full skeleton-bg h-12 w-12"></div>
        <div className="flex-1 space-y-2">
            <div className="skeleton-bg h-4 w-24 rounded"></div>
            <div className="skeleton-bg h-6 w-32 rounded"></div>
        </div>
    </div>
);

export default StatCardSkeleton;