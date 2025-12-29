import type { FC } from 'react';

interface TableSkeletonProps {
    rows?: number;
    columns: { width?: string }[];
}

const TableSkeleton: FC<TableSkeletonProps> = ({ rows = 5, columns }) => (
    <div className="overflow-x-auto">
        <table className="w-full text-sm">
            <thead className="text-xs text-transparent bg-secondary-50 dark:bg-secondary-700">
                <tr>
                    {columns.map((col, index) => (
                        <th key={index} className="px-6 py-3">
                            <div className="skeleton-bg h-4 rounded" style={{ width: col.width || '100%' }}></div>
                        </th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {[...Array(rows)].map((_, rowIndex) => (
                    <tr key={rowIndex} className="border-b dark:border-secondary-700">
                        {columns.map((_, colIndex) => (
                            <td key={colIndex} className="px-6 py-4">
                                <div className="skeleton-bg h-5 rounded"></div>
                            </td>
                        ))}
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
);

export default TableSkeleton;