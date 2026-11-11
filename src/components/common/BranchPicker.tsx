import React from 'react';
import { useBranchFilter } from '../../hooks/useBranchFilter';

interface BranchPickerProps {
    className?: string;
    showLabel?: boolean;
    compact?: boolean;
}

export const BranchPicker: React.FC<BranchPickerProps> = ({
    className = '',
    showLabel = false,
    compact = false,
}) => {
    const {
        selectedBranchId,
        setSelectedBranchId,
        branches,
        hasMultipleBranches,
        hasUnassignedClasses
    } = useBranchFilter();

    if (!hasMultipleBranches) {
        return null;
    }

    return (
        <div className={`inline-flex items-center gap-1.5 ${compact ? 'text-xs' : 'text-sm'} ${className}`}>
            {showLabel && (
                <label htmlFor="branch-filter-picker" className="font-medium text-secondary-600 dark:text-secondary-300 whitespace-nowrap">
                    Branch:
                </label>
            )}
            <div className="relative inline-block w-full sm:w-auto">
                <select
                    id="branch-filter-picker"
                    value={selectedBranchId}
                    onChange={(e) => setSelectedBranchId(e.target.value)}
                    aria-label="Filter by branch"
                    className={`bg-white dark:bg-secondary-800 border border-secondary-300 dark:border-secondary-600 text-secondary-900 dark:text-secondary-100 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 font-medium transition-colors cursor-pointer ${
                        compact ? 'py-1 pl-2.5 pr-8 text-xs' : 'py-1.5 pl-3 pr-8 text-sm'
                    } appearance-none w-full sm:w-auto`}
                >
                    <option value="all">All branches</option>
                    {branches.map((b) => (
                        <option key={b.id} value={b.id}>
                            {b.name}
                        </option>
                    ))}
                    {hasUnassignedClasses && (
                        <option value="unassigned">Unassigned</option>
                    )}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-secondary-500 dark:text-secondary-400">
                    <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                </div>
            </div>
        </div>
    );
};

export default BranchPicker;
