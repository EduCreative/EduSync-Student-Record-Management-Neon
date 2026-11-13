import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarCheck, HardDriveDownload, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { UserRole } from '../../types';
import { PLAN_STORAGE_LIMIT_BYTES } from '../../constants';
import { DbUsageResponse, fetchDbUsage } from '../../utils/storageUsage';
import { getTodayKarachi } from '../../utils/dates';
import { ActiveView } from '../layout/Layout';

type ReminderType = 'storage' | 'backup' | 'monthly';

const STORAGE_DISMISS_KEY = 'edusync_owner_reminder_dismissed_storage';
const BACKUP_DISMISS_KEY = 'edusync_owner_reminder_dismissed_backup';
const MONTHLY_DISMISS_PREFIX = 'edusync_owner_reminder_dismissed_monthly_';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

interface OwnerRemindersBannerProps {
    setActiveView: (view: ActiveView) => void;
}

function readLocalDismissed(key: string, maxAgeMs: number | null): boolean {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return false;
        if (maxAgeMs === null) {
            return raw === '1';
        }
        const ts = Number(raw);
        return Number.isFinite(ts) && (Date.now() - ts) < maxAgeMs;
    } catch {
        return false;
    }
}

function writeLocalDismissed(key: string, value: string): void {
    try {
        localStorage.setItem(key, value);
    } catch {
        // Ignore when localStorage is unavailable
    }
}

export const OwnerRemindersBanner: React.FC<OwnerRemindersBannerProps> = ({ setActiveView }) => {
    const { user } = useAuth();
    const { logs, loading } = useData();
    const isEligibleOwner = Boolean(user && user.role === UserRole.Owner && !user.branchId);

    const [usage, setUsage] = useState<DbUsageResponse | null>(null);
    const [sessionDismissed, setSessionDismissed] = useState<Partial<Record<ReminderType, boolean>>>({});

    useEffect(() => {
        if (!isEligibleOwner) return;
        let active = true;
        fetchDbUsage()
            .then((data) => {
                if (active) setUsage(data);
            })
            .catch(() => {
                // Ignore usage errors on dashboard banner
            });
        return () => {
            active = false;
        };
    }, [isEligibleOwner]);

    const todayStr = getTodayKarachi();
    const [yearStr, monthStr, dayStr] = todayStr.split('-');
    const yearMonth = `${yearStr}-${monthStr}`;
    const dayOfMonth = parseInt(dayStr, 10);
    const isMonthlyWindow = dayOfMonth >= 1 && dayOfMonth <= 7;
    const monthlyKey = `${MONTHLY_DISMISS_PREFIX}${yearMonth}`;

    const isDismissed = useCallback(
        (type: ReminderType): boolean => {
            if (sessionDismissed[type]) return true;
            if (type === 'storage') return readLocalDismissed(STORAGE_DISMISS_KEY, ONE_DAY_MS);
            if (type === 'backup') return readLocalDismissed(BACKUP_DISMISS_KEY, ONE_DAY_MS);
            return readLocalDismissed(monthlyKey, null);
        },
        [sessionDismissed, monthlyKey]
    );

    const handleDismiss = useCallback(
        (type: ReminderType) => {
            setSessionDismissed((prev) => ({ ...prev, [type]: true }));
            if (type === 'storage') {
                writeLocalDismissed(STORAGE_DISMISS_KEY, String(Date.now()));
            } else if (type === 'backup') {
                writeLocalDismissed(BACKUP_DISMISS_KEY, String(Date.now()));
            } else {
                writeLocalDismissed(monthlyKey, '1');
            }
        },
        [monthlyKey]
    );

    const backupStatus = useMemo(() => {
        let newestMs: number | null = null;
        for (const entry of logs) {
            if (entry.action === 'Full backup downloaded' && entry.timestamp) {
                const ms = new Date(entry.timestamp).getTime();
                if (Number.isFinite(ms) && (newestMs === null || ms > newestMs)) {
                    newestMs = ms;
                }
            }
        }
        if (newestMs === null) {
            return { overdue: true, daysAgo: null as number | null };
        }
        const elapsed = Date.now() - newestMs;
        return {
            overdue: elapsed > THIRTY_DAYS_MS,
            daysAgo: Math.floor(elapsed / ONE_DAY_MS)
        };
    }, [logs]);

    if (!isEligibleOwner || loading) {
        return null;
    }

    const storageRatio = usage ? usage.sizeBytes / PLAN_STORAGE_LIMIT_BYTES : 0;
    const storagePercent = Math.round(storageRatio * 100);
    const isStorageUrgent = storageRatio >= 0.9;
    const isStorageWarning = storageRatio >= 0.7 && storageRatio < 0.9;

    // Pick one reminder at a time, most urgent first
    if ((isStorageUrgent || isStorageWarning) && !isDismissed('storage')) {
        const containerClasses = isStorageUrgent
            ? 'bg-red-50 border-red-300 text-red-900 dark:bg-red-950/40 dark:border-red-800 dark:text-red-100'
            : 'bg-amber-50 border-amber-300 text-amber-900 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-100';
        const iconClasses = isStorageUrgent
            ? 'text-red-600 dark:text-red-400'
            : 'text-amber-600 dark:text-amber-400';

        return (
            <div
                role="alert"
                className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border shadow-sm ${containerClasses}`}
            >
                <div className="flex items-start sm:items-center gap-3">
                    <AlertTriangle className={`w-5 h-5 shrink-0 mt-0.5 sm:mt-0 ${iconClasses}`} />
                    <p className="text-sm font-medium">
                        Database is {storagePercent}% full. Download a backup and review photos or upgrade the plan.
                    </p>
                </div>
                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    <button
                        type="button"
                        onClick={() => setActiveView({ view: 'settings' })}
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white/80 hover:bg-white text-secondary-900 dark:bg-secondary-800 dark:hover:bg-secondary-700 dark:text-white border border-black/10 dark:border-white/10 transition-colors"
                    >
                        Open Settings
                    </button>
                    <button
                        type="button"
                        onClick={() => handleDismiss('storage')}
                        aria-label="Dismiss storage reminder"
                        className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>
        );
    }

    if (backupStatus.overdue && !isDismissed('backup')) {
        const message =
            backupStatus.daysAgo === null
                ? 'No full backup has been downloaded from the app yet. Download a backup from Settings to keep a safe local copy.'
                : `Last full backup was downloaded ${backupStatus.daysAgo} days ago. Download a fresh backup from Settings.`;

        return (
            <div
                role="status"
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border shadow-sm bg-amber-50 border-amber-300 text-amber-900 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-100"
            >
                <div className="flex items-start sm:items-center gap-3">
                    <HardDriveDownload className="w-5 h-5 shrink-0 mt-0.5 sm:mt-0 text-amber-600 dark:text-amber-400" />
                    <p className="text-sm font-medium">{message}</p>
                </div>
                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    <button
                        type="button"
                        onClick={() => setActiveView({ view: 'settings' })}
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white/80 hover:bg-white text-secondary-900 dark:bg-secondary-800 dark:hover:bg-secondary-700 dark:text-white border border-black/10 dark:border-white/10 transition-colors"
                    >
                        Open Settings
                    </button>
                    <button
                        type="button"
                        onClick={() => handleDismiss('backup')}
                        aria-label="Dismiss backup reminder"
                        className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>
        );
    }

    if (isMonthlyWindow && !isDismissed('monthly')) {
        return (
            <div
                role="status"
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border shadow-sm bg-blue-50 border-blue-200 text-blue-900 dark:bg-blue-950/40 dark:border-blue-800 dark:text-blue-100"
            >
                <div className="flex items-start sm:items-center gap-3">
                    <CalendarCheck className="w-5 h-5 shrink-0 mt-0.5 sm:mt-0 text-blue-600 dark:text-blue-400" />
                    <p className="text-sm font-medium">
                        Monthly check: open the Neon and Vercel usage pages and confirm the latest GitHub backup run is green.
                    </p>
                </div>
                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    <button
                        type="button"
                        onClick={() => handleDismiss('monthly')}
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                    >
                        Done for this month
                    </button>
                </div>
            </div>
        );
    }

    return null;
};
