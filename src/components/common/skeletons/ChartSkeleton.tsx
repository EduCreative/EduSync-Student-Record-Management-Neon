import type { FC } from 'react';

const ChartSkeleton: FC = () => (
    <div className="bg-white dark:bg-secondary-800 p-6 rounded-xl shadow-lg">
        <div className="skeleton-bg h-6 w-48 mb-4 rounded"></div>
        <div className="skeleton-bg h-48 w-full rounded"></div>
    </div>
);

export default ChartSkeleton;