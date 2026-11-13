import React, { useCallback, useEffect, useState } from 'react';
import { Database, RefreshCw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../types';
import { PLAN_STORAGE_LIMIT_BYTES } from '../../constants';
import { DbUsageResponse, fetchDbUsage, formatStorageBytes } from '../../utils/storageUsage';

export const StorageUsageCard: React.FC = () => {
    const { user } = useAuth();
    const isEligibleOwner = Boolean(user && user.role === UserRole.Owner && !user.branchId);

    const [usage, setUsage] = useState<DbUsageResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [failed, setFailed] = useState(false);

    const loadUsage = useCallback(async () => {
        if (!isEligibleOwner) return;
        setLoading(true);
        setFailed(false);
        try {
            const data = await fetchDbUsage();
            setUsage(data);
        } catch {
            setUsage(null);
            setFailed(true);
        } finally {
            setLoading(false);
        }
    }, [isEligibleOwner]);

    useEffect(() => {
        if (isEligibleOwner) {
            loadUsage();
        }
    }, [isEligibleOwner, loadUsage]);

    if (!isEligibleOwner) {
        return null;
    }

    const rawPercent = usage ? (usage.sizeBytes / PLAN_STORAGE_LIMIT_BYTES) * 100 : 0;
    const displayPercent = Math.round(rawPercent);
    const barPercent = Math.min(100, Math.max(0, rawPercent));

    const getBarColorClass = (pct: number) => {
        if (pct >= 90) return 'bg-red-600 dark:bg-red-500';
        if (pct >= 70) return 'bg-amber-500 dark:bg-amber-400';
        return 'bg-emerald-600 dark:bg-emerald-500';
    };

    const getBadgeColorClass = (pct: number) => {
        if (pct >= 90) return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300';
        if (pct >= 70) return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300';
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300';
    };

    return (
        <div className="bg-white dark:bg-secondary-800 rounded-lg shadow-md p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
                <div className="flex items-start gap-4">
                    <div className="p-3 bg-primary-100 dark:bg-primary-900/30 rounded-full shrink-0">
                        <Database className="w-7 h-7 text-primary-600 dark:text-primary-400" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-secondary-900 dark:text-white leading-tight">
                            Storage &amp; Usage
                        </h2>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={loadUsage}
                    disabled={loading}
                    className="btn-secondary inline-flex items-center justify-center gap-2 text-xs font-semibold self-start sm:self-center shadow-none disabled:opacity-60"
                >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    {loading ? 'Refreshing...' : 'Refresh'}
                </button>
            </div>

            {failed ? (
                <p className="text-sm text-secondary-600 dark:text-secondary-400">Could not read usage</p>
            ) : loading && !usage ? (
                <div className="space-y-3 animate-pulse">
                    <div className="h-4 w-56 bg-secondary-200 dark:bg-secondary-700 rounded" />
                    <div className="h-3 w-full bg-secondary-200 dark:bg-secondary-700 rounded-full" />
                </div>
            ) : usage ? (
                <div className="space-y-5">
                    <div className="bg-secondary-50 dark:bg-secondary-900/40 rounded-xl p-5 border dark:border-secondary-700 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-secondary-900 dark:text-white">
                                Database size: {formatStorageBytes(usage.sizeBytes)} of {formatStorageBytes(PLAN_STORAGE_LIMIT_BYTES)} ({displayPercent}%)
                            </p>
                            <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${getBadgeColorClass(rawPercent)}`}>
                                {displayPercent}%
                            </span>
                        </div>
                        <div
                            className="w-full h-3 bg-secondary-200 dark:bg-secondary-700 rounded-full overflow-hidden"
                            role="progressbar"
                            aria-valuenow={displayPercent}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-label="Database storage usage"
                        >
                            <div
                                className={`h-full rounded-full transition-all duration-500 ${getBarColorClass(rawPercent)}`}
                                style={{ width: `${barPercent}%` }}
                            />
                        </div>
                    </div>

                    {usage.tables.length > 0 && (
                        <div>
                            <h3 className="text-xs font-bold text-secondary-500 dark:text-secondary-400 uppercase tracking-wider mb-2.5">
                                Five Largest Tables (photos are usually the largest)
                            </h3>
                            <div className="divide-y divide-secondary-100 dark:divide-secondary-700 border dark:border-secondary-700 rounded-lg overflow-hidden">
                                {usage.tables.map((table) => (
                                    <div
                                        key={table.name}
                                        className="flex items-center justify-between px-4 py-2.5 bg-white dark:bg-secondary-800/60 text-sm"
                                    >
                                        <span className="font-mono text-xs sm:text-sm text-secondary-800 dark:text-secondary-200 truncate pr-4">
                                            {table.name}
                                        </span>
                                        <span className="font-semibold text-secondary-900 dark:text-white shrink-0">
                                            {formatStorageBytes(table.bytes)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <p className="text-xs text-secondary-500 dark:text-secondary-400">
                        Approximate. Compute hours and bandwidth cannot be measured here: check the Neon and Vercel usage pages monthly.
                    </p>
                </div>
            ) : null}
        </div>
    );
};
