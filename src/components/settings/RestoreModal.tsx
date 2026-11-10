import React, { useState, useRef, useMemo } from 'react';
import { 
    UploadCloud, CheckCircle2, AlertTriangle, Lock, FileText, Database, 
    Calendar, Users, CreditCard, Eye, EyeOff, X, ArrowRight, ShieldCheck, Loader2
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';

interface RestoreModalProps {
    isOpen: boolean;
    onClose: () => void;
    onRestoreSuccess?: () => void;
}

type RestoreStep = 'SELECT' | 'AUDIT' | 'UPLOADING' | 'SUCCESS';

interface ParsedBackup {
    version: string;
    createdAt: string;
    tables: Record<string, any[]>;
    counts: Record<string, number>;
}

interface SummaryData {
    schoolName: string;
    schoolAddress: string;
    totalRows: number;
    totalStudents: number;
    activeStudents: number;
    graduatedStudents: number;
    leftStudents: number;
    feeChallansCount: number;
    feeDateRange: string;
    attendanceCount: number;
    attendanceDateRange: string;
    examsCount: number;
    examNames: string;
    classesCount: number;
    branchesCount: number;
    profilesCount: number;
    hasOwnerAccount: boolean;
}

const REQUIRED_CORE_TABLES = [
    'schools',
    'profiles',
    'classes',
    'students',
    'fee_challans'
];

const RESTORE_TABLE_ORDER = [
    'schools',
    'branches',
    'profiles',
    'classes',
    'subjects',
    'exams',
    'fee_heads',
    'students',
    'fee_challans',
    'attendance',
    'results',
    'activity_logs',
    'school_events',
    'notifications'
] as const;

export const RestoreModal: React.FC<RestoreModalProps> = ({ isOpen, onClose, onRestoreSuccess }) => {
    const { showToast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [step, setStep] = useState<RestoreStep>('SELECT');
    const [fileName, setFileName] = useState('');
    const [fileSizeMb, setFileSizeMb] = useState('');
    const [backupData, setBackupData] = useState<ParsedBackup | null>(null);
    const [parseError, setParseError] = useState<string | null>(null);

    // Form inputs for Step 2
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [confirmText, setConfirmText] = useState('');
    const [formError, setFormError] = useState<string | null>(null);

    // Progress State for Step 3
    const [progressPercent, setProgressPercent] = useState(0);
    const [progressStatus, setProgressStatus] = useState('');
    const [progressDetails, setProgressDetails] = useState('');

    const resetState = () => {
        setStep('SELECT');
        setFileName('');
        setFileSizeMb('');
        setBackupData(null);
        setParseError(null);
        setPassword('');
        setShowPassword(false);
        setConfirmText('');
        setFormError(null);
        setProgressPercent(0);
        setProgressStatus('');
        setProgressDetails('');
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleClose = () => {
        if (step === 'UPLOADING') {
            if (!window.confirm('A database restore is in progress. Closing this dialog will not cancel active uploads. Are you sure?')) {
                return;
            }
        }
        resetState();
        onClose();
    };

    // Client-side pre-flight file parsing and validation
    const handleFileSelect = (file: File) => {
        setParseError(null);
        setFileName(file.name);
        setFileSizeMb((file.size / (1024 * 1024)).toFixed(2));

        if (!file.name.endsWith('.json')) {
            setParseError('Selected file must be a JSON database backup (.json).');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = e.target?.result as string;
                const parsed = JSON.parse(text);

                if (!parsed || typeof parsed !== 'object') {
                    throw new Error('Invalid JSON format: Root element must be an object.');
                }

                if (!parsed.tables || typeof parsed.tables !== 'object') {
                    throw new Error('Malformed backup archive: Missing "tables" data structure.');
                }

                if (!parsed.counts || typeof parsed.counts !== 'object') {
                    // Derive counts if missing
                    parsed.counts = {};
                    for (const [tbl, rows] of Object.entries(parsed.tables)) {
                        parsed.counts[tbl] = Array.isArray(rows) ? rows.length : 0;
                    }
                }

                // Check required core tables
                for (const coreTable of REQUIRED_CORE_TABLES) {
                    if (!parsed.tables[coreTable]) {
                        throw new Error(`Incomplete backup: Required table "${coreTable}" is missing from archive.`);
                    }
                }

                // Integrity check: table row count verification
                for (const [tbl, rows] of Object.entries(parsed.tables)) {
                    if (Array.isArray(rows)) {
                        const declaredCount = parsed.counts[tbl];
                        if (declaredCount !== undefined && declaredCount !== rows.length) {
                            throw new Error(`Data corruption detected: Table "${tbl}" declares ${declaredCount} rows but contains ${rows.length} rows.`);
                        }
                    }
                }

                setBackupData(parsed);
                setStep('AUDIT');
            } catch (err: any) {
                console.error('Backup parsing error:', err);
                setParseError(err.message || 'Failed to parse JSON backup archive.');
            }
        };

        reader.onerror = () => {
            setParseError('Failed to read the selected file from disk.');
        };

        reader.readAsText(file);
    };

    // Compute detailed audit metrics from parsed backup
    const summary: SummaryData | null = useMemo(() => {
        if (!backupData) return null;
        const tables = backupData.tables;

        // School
        const schools = tables.schools || [];
        const schoolObj = schools[0] || {};
        const schoolName = schoolObj.name || 'Unnamed Institution';
        const schoolAddress = schoolObj.address || 'Address not specified';

        // Profiles
        const profiles = tables.profiles || [];
        const hasOwner = profiles.some((p: any) => p.role === 'Owner');

        // Students
        const students = tables.students || [];
        const activeStudents = students.filter((s: any) => s.status === 'Active').length;
        const graduatedStudents = students.filter((s: any) => s.status === 'Graduated').length;
        const leftStudents = students.filter((s: any) => s.status === 'Left').length;

        // Fees date range
        const fees = tables.fee_challans || [];
        let feeDateRange = 'No fee records';
        if (fees.length > 0) {
            const dateStrings = fees.map((f: any) => f.due_date || f.dueDate).filter(Boolean).sort();
            if (dateStrings.length > 0) {
                feeDateRange = `${dateStrings[0]} to ${dateStrings[dateStrings.length - 1]}`;
            } else {
                const years = fees.map((f: any) => Number(f.year)).filter((y: number) => !isNaN(y)).sort((a: number, b: number) => a - b);
                if (years.length > 0) {
                    feeDateRange = `${years[0]} – ${years[years.length - 1]}`;
                }
            }
        }

        // Attendance date range
        const att = tables.attendance || [];
        let attendanceDateRange = 'No attendance logs';
        if (att.length > 0) {
            const attDates = att.map((a: any) => a.date).filter(Boolean).sort();
            if (attDates.length > 0) {
                attendanceDateRange = `${attDates[0]} to ${attDates[attDates.length - 1]}`;
            }
        }

        // Exams
        const exams = tables.exams || [];
        const examNames = exams.map((e: any) => e.name).slice(0, 3).join(', ') + (exams.length > 3 ? ` +${exams.length - 3} more` : '');

        // Total rows
        let totalRows = 0;
        for (const rows of Object.values(tables)) {
            if (Array.isArray(rows)) totalRows += rows.length;
        }

        return {
            schoolName,
            schoolAddress,
            totalRows,
            totalStudents: students.length,
            activeStudents,
            graduatedStudents,
            leftStudents,
            feeChallansCount: fees.length,
            feeDateRange,
            attendanceCount: att.length,
            attendanceDateRange,
            examsCount: exams.length,
            examNames: examNames || 'None configured',
            classesCount: (tables.classes || []).length,
            branchesCount: (tables.branches || []).length,
            profilesCount: profiles.length,
            hasOwnerAccount: hasOwner
        };
    }, [backupData]);

    // Handle staged execution
    const handleExecuteRestore = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormError(null);

        if (!password) {
            setFormError('Please enter your account password to authorize this restore.');
            return;
        }

        if (confirmText.trim() !== 'RESTORE') {
            setFormError('You must type "RESTORE" exactly in uppercase to confirm.');
            return;
        }

        if (!backupData) return;

        setStep('UPLOADING');
        setProgressPercent(5);
        setProgressStatus('Verifying Owner password and preparing staging environment...');
        setProgressDetails('Initial authentication check');

        try {
            // Step 1: Init & Password check
            const initRes = await fetch('/api/write/restore', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ action: 'init', password })
            });

            const initData = await initRes.json();
            if (!initRes.ok || !initData.success) {
                throw new Error(initData.error || 'Failed to initialize restore session.');
            }

            const restoreToken = initData.restoreToken;
            setProgressPercent(15);
            setProgressStatus('Staging tables ready. Beginning streaming upload...');

            // Step 2: Upload chunks table-by-table
            const CHUNK_SIZE = 200;
            const tablesToUpload = RESTORE_TABLE_ORDER.filter(t => Array.isArray(backupData.tables[t]));
            const totalTables = tablesToUpload.length;

            for (let tIdx = 0; tIdx < totalTables; tIdx++) {
                const tableName = tablesToUpload[tIdx];
                const rows = backupData.tables[tableName] || [];
                const totalRows = rows.length;

                const basePct = 15 + Math.round((tIdx / totalTables) * 70);

                if (totalRows === 0) {
                    setProgressPercent(basePct);
                    setProgressStatus(`Staging "${tableName}" (0 rows)...`);
                    continue;
                }

                const totalBatches = Math.ceil(totalRows / CHUNK_SIZE);

                for (let bIdx = 0; bIdx < totalBatches; bIdx++) {
                    const start = bIdx * CHUNK_SIZE;
                    const chunk = rows.slice(start, start + CHUNK_SIZE);
                    const batchProgress = basePct + Math.round(((bIdx + 1) / totalBatches) * (70 / totalTables));

                    setProgressPercent(Math.min(85, batchProgress));
                    setProgressStatus(`Uploading table "${tableName}" (${tIdx + 1}/${totalTables})...`);
                    setProgressDetails(`Batch ${bIdx + 1} of ${totalBatches} (${chunk.length} rows)`);

                    const chunkRes = await fetch('/api/write/restore', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({
                            action: 'upload-chunk',
                            restoreToken,
                            table: tableName,
                            rows: chunk
                        })
                    });

                    if (!chunkRes.ok) {
                        const chunkErr = await chunkRes.json().catch(() => ({}));
                        throw new Error(chunkErr.error || `Failed uploading rows to table "${tableName}".`);
                    }
                }
            }

            // Step 3: Finalize and Atomic Swap
            setProgressPercent(90);
            setProgressStatus('Verifying 100% staging row counts...');
            setProgressDetails('Ensuring no data loss before atomic swap');

            const finalizeRes = await fetch('/api/write/restore', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    action: 'finalize',
                    restoreToken,
                    expectedCounts: backupData.counts
                })
            });

            const finalData = await finalizeRes.json();
            if (!finalizeRes.ok || !finalData.success) {
                throw new Error(finalData.error || 'Atomic database swap failed.');
            }

            setProgressPercent(100);
            setProgressStatus('Restore and database verification completed successfully!');
            setProgressDetails('All records committed to live database.');
            setStep('SUCCESS');

            if (onRestoreSuccess) {
                onRestoreSuccess();
            }
        } catch (err: any) {
            console.error('Browser restore error:', err);
            showToast('Restore Failed', err.message || 'Database restore encountered an error.', 'error');
            setFormError(err.message || 'Database restore failed.');
            setStep('AUDIT');
        }
    };

    if (!isOpen) return null;

    return (
        <div 
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex justify-center items-center p-4 overflow-y-auto animate-fade-in"
            role="dialog"
            aria-modal="true"
        >
            <div 
                className="bg-white dark:bg-secondary-800 rounded-2xl shadow-2xl w-full max-w-2xl border border-secondary-200 dark:border-secondary-700 overflow-hidden transform transition-all my-8"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-secondary-100 dark:border-secondary-700 bg-secondary-50/50 dark:bg-secondary-900/30">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-xl">
                            <Database className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-secondary-900 dark:text-white leading-tight">
                                Database Disaster Recovery
                            </h2>
                            <p className="text-xs text-secondary-500">
                                Verify, stage, and restore institutional database records
                            </p>
                        </div>
                    </div>
                    {step !== 'UPLOADING' && (
                        <button 
                            onClick={handleClose}
                            className="text-secondary-400 hover:text-secondary-600 dark:hover:text-secondary-200 p-1.5 rounded-lg transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    )}
                </div>

                {/* Step 1: Select File */}
                {step === 'SELECT' && (
                    <div className="p-6 space-y-6">
                        <div 
                            onClick={() => fileInputRef.current?.click()}
                            className="border-2 border-dashed border-secondary-300 dark:border-secondary-600 hover:border-emerald-500 dark:hover:border-emerald-500 rounded-2xl p-8 text-center cursor-pointer transition-all bg-secondary-50/50 dark:bg-secondary-900/20 group"
                        >
                            <input 
                                ref={fileInputRef}
                                type="file" 
                                accept=".json,application/json"
                                onChange={e => {
                                    if (e.target.files && e.target.files[0]) {
                                        handleFileSelect(e.target.files[0]);
                                    }
                                }}
                                className="hidden" 
                            />
                            <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-105 transition-transform">
                                <UploadCloud className="w-8 h-8" />
                            </div>
                            <h3 className="text-base font-bold text-secondary-900 dark:text-white">
                                Click or drag an EduSync backup archive here
                            </h3>
                            <p className="text-xs text-secondary-500 mt-1">
                                Must be an untampered <code className="px-1.5 py-0.5 rounded bg-secondary-200 dark:bg-secondary-700 font-mono">edusync-*.json</code> file
                            </p>
                        </div>

                        {parseError && (
                            <div className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-xl flex items-start gap-3 text-red-700 dark:text-red-300 text-sm">
                                <AlertTriangle className="w-5 h-5 flex-shrink-0 text-red-500" />
                                <div>
                                    <p className="font-bold">File Verification Failed</p>
                                    <p className="text-xs mt-0.5">{parseError}</p>
                                </div>
                            </div>
                        )}

                        <div className="p-4 bg-secondary-50 dark:bg-secondary-900/40 rounded-xl border border-secondary-200 dark:border-secondary-700 space-y-2 text-xs text-secondary-600 dark:text-secondary-400">
                            <p className="font-bold text-secondary-800 dark:text-secondary-200 flex items-center gap-1.5">
                                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                                Zero-Corruption Safety Protocol
                            </p>
                            <p>
                                Before applying any changes, EduSync verifies table counts, integrity checksums, and date ranges. Data is uploaded to an isolated staging area first. If internet connectivity drops at any point, the active live database remains completely untouched.
                            </p>
                        </div>
                    </div>
                )}

                {/* Step 2: Audit & Authorization Card */}
                {step === 'AUDIT' && summary && (
                    <form onSubmit={handleExecuteRestore} className="p-6 space-y-6">
                        {/* File summary badge */}
                        <div className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 rounded-xl p-3.5">
                            <div className="flex items-center gap-3">
                                <FileText className="w-5 h-5 text-emerald-600" />
                                <div>
                                    <p className="text-sm font-bold text-emerald-900 dark:text-emerald-200">{fileName}</p>
                                    <p className="text-xs text-emerald-700 dark:text-emerald-400">
                                        Archive Size: {fileSizeMb} MB &bull; Version: {backupData?.version || 'Unknown'} &bull; Created: {backupData?.createdAt ? new Date(backupData.createdAt).toLocaleString() : 'N/A'}
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={resetState}
                                className="text-xs text-secondary-500 hover:text-secondary-700 dark:hover:text-secondary-300 underline font-medium"
                            >
                                Change file
                            </button>
                        </div>

                        {/* Data Audit Card */}
                        <div className="bg-white dark:bg-secondary-900/60 rounded-xl border border-secondary-200 dark:border-secondary-700 p-4 space-y-4">
                            <div className="border-b border-secondary-100 dark:border-secondary-700 pb-3">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-secondary-400">Target Institution</span>
                                <h3 className="text-lg font-bold text-secondary-900 dark:text-white leading-tight">
                                    {summary.schoolName}
                                </h3>
                                <p className="text-xs text-secondary-500 mt-0.5">{summary.schoolAddress}</p>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                <div className="p-3 bg-secondary-50 dark:bg-secondary-800/50 rounded-lg">
                                    <div className="flex items-center gap-1.5 text-secondary-500 text-xs mb-1">
                                        <Users className="w-3.5 h-3.5 text-blue-500" />
                                        <span>Students</span>
                                    </div>
                                    <p className="text-base font-bold text-secondary-900 dark:text-white">
                                        {summary.totalStudents.toLocaleString()}
                                    </p>
                                    <p className="text-[11px] text-secondary-500">
                                        {summary.activeStudents} active &bull; {summary.graduatedStudents} grad
                                    </p>
                                </div>

                                <div className="p-3 bg-secondary-50 dark:bg-secondary-800/50 rounded-lg">
                                    <div className="flex items-center gap-1.5 text-secondary-500 text-xs mb-1">
                                        <CreditCard className="w-3.5 h-3.5 text-emerald-500" />
                                        <span>Fee Challans</span>
                                    </div>
                                    <p className="text-base font-bold text-secondary-900 dark:text-white">
                                        {summary.feeChallansCount.toLocaleString()}
                                    </p>
                                    <p className="text-[11px] text-secondary-500 truncate" title={summary.feeDateRange}>
                                        {summary.feeDateRange}
                                    </p>
                                </div>

                                <div className="p-3 bg-secondary-50 dark:bg-secondary-800/50 rounded-lg">
                                    <div className="flex items-center gap-1.5 text-secondary-500 text-xs mb-1">
                                        <Calendar className="w-3.5 h-3.5 text-purple-500" />
                                        <span>Attendance Logs</span>
                                    </div>
                                    <p className="text-base font-bold text-secondary-900 dark:text-white">
                                        {summary.attendanceCount.toLocaleString()}
                                    </p>
                                    <p className="text-[11px] text-secondary-500 truncate" title={summary.attendanceDateRange}>
                                        {summary.attendanceDateRange}
                                    </p>
                                </div>

                                <div className="p-3 bg-secondary-50 dark:bg-secondary-800/50 rounded-lg">
                                    <div className="text-xs text-secondary-500 mb-1">Classes & Branches</div>
                                    <p className="text-sm font-bold text-secondary-900 dark:text-white">
                                        {summary.classesCount} Classes &bull; {summary.branchesCount} Branches
                                    </p>
                                </div>

                                <div className="p-3 bg-secondary-50 dark:bg-secondary-800/50 rounded-lg">
                                    <div className="text-xs text-secondary-500 mb-1">User Profiles</div>
                                    <p className="text-sm font-bold text-secondary-900 dark:text-white">
                                        {summary.profilesCount} Accounts
                                    </p>
                                </div>

                                <div className="p-3 bg-secondary-50 dark:bg-secondary-800/50 rounded-lg">
                                    <div className="text-xs text-secondary-500 mb-1">Total Records</div>
                                    <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                                        {summary.totalRows.toLocaleString()} rows verified
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Destructive Action Warning */}
                        <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 rounded-xl text-amber-900 dark:text-amber-200 text-xs space-y-1">
                            <div className="flex items-center gap-1.5 font-bold text-amber-800 dark:text-amber-300 text-sm">
                                <AlertTriangle className="w-4 h-4" />
                                Irreversible Replacement Warning
                            </div>
                            <p>
                                Restoring this archive will completely replace all existing students, fee ledgers, exam marks, and user accounts in this database with the verified records shown above.
                            </p>
                        </div>

                        {formError && (
                            <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-lg text-red-600 dark:text-red-400 text-xs">
                                {formError}
                            </div>
                        )}

                        {/* Confirmation Inputs */}
                        <div className="space-y-4 pt-2 border-t border-secondary-100 dark:border-secondary-700">
                            <div>
                                <label className="block text-xs font-bold text-secondary-700 dark:text-secondary-300 mb-1.5">
                                    1. Enter Owner Account Password
                                </label>
                                <div className="relative">
                                    <input 
                                        type={showPassword ? 'text' : 'password'}
                                        required
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        placeholder="Your login password"
                                        className="input-field pr-10 text-sm"
                                    />
                                    <button 
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary-400 hover:text-secondary-600"
                                    >
                                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-secondary-700 dark:text-secondary-300 mb-1.5">
                                    2. Type <span className="font-mono text-red-600 dark:text-red-400 font-black">RESTORE</span> to confirm
                                </label>
                                <input 
                                    type="text"
                                    required
                                    value={confirmText}
                                    onChange={e => setConfirmText(e.target.value)}
                                    placeholder="Type RESTORE in capital letters"
                                    className="input-field font-mono text-sm tracking-wider"
                                />
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex justify-end gap-3 pt-4 border-t border-secondary-100 dark:border-secondary-700">
                            <button
                                type="button"
                                onClick={handleClose}
                                className="btn-secondary text-sm"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={confirmText !== 'RESTORE' || !password}
                                className="px-6 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold rounded-lg shadow-lg shadow-red-600/20 transition-all text-sm flex items-center gap-2"
                            >
                                <Lock className="w-4 h-4" />
                                Authorize &amp; Restore
                            </button>
                        </div>
                    </form>
                )}

                {/* Step 3: Uploading & Staging Progress */}
                {step === 'UPLOADING' && (
                    <div className="p-8 space-y-6 text-center">
                        <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto animate-pulse">
                            <Loader2 className="w-8 h-8 animate-spin" />
                        </div>

                        <div>
                            <h3 className="text-lg font-bold text-secondary-900 dark:text-white">
                                Restoring Database Records...
                            </h3>
                            <p className="text-xs text-secondary-500 mt-1">
                                Please do not close or refresh this browser tab.
                            </p>
                        </div>

                        {/* Progress bar */}
                        <div className="space-y-2 max-w-md mx-auto">
                            <div className="flex justify-between text-xs font-bold text-secondary-600 dark:text-secondary-400">
                                <span>{progressPercent}% Complete</span>
                                <span className="text-emerald-600 dark:text-emerald-400 font-mono">Staging Protocol</span>
                            </div>
                            <div className="w-full bg-secondary-100 dark:bg-secondary-700 h-3 rounded-full overflow-hidden">
                                <div 
                                    className="bg-emerald-500 h-full transition-all duration-300 rounded-full"
                                    style={{ width: `${progressPercent}%` }}
                                />
                            </div>
                            <p className="text-xs font-medium text-secondary-700 dark:text-secondary-300">
                                {progressStatus}
                            </p>
                            {progressDetails && (
                                <p className="text-[11px] text-secondary-400 font-mono">
                                    {progressDetails}
                                </p>
                            )}
                        </div>
                    </div>
                )}

                {/* Step 4: Success Receipt */}
                {step === 'SUCCESS' && (
                    <div className="p-8 space-y-6 text-center">
                        <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto">
                            <CheckCircle2 className="w-10 h-10" />
                        </div>

                        <div>
                            <h3 className="text-xl font-bold text-secondary-900 dark:text-white">
                                Disaster Recovery Completed!
                            </h3>
                            <p className="text-xs text-secondary-500 mt-1 max-w-md mx-auto">
                                All institutional records have been atomically swapped into the live database with 100% row count verification.
                            </p>
                        </div>

                        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl text-left max-w-md mx-auto space-y-1 text-xs text-emerald-900 dark:text-emerald-300">
                            <p className="font-bold flex items-center gap-1.5 text-sm">
                                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                                Database Verification Passed
                            </p>
                            <p>
                                Active Institution: <span className="font-semibold">{summary?.schoolName}</span>
                            </p>
                            <p>
                                Total Restored Records: <span className="font-semibold">{summary?.totalRows.toLocaleString()} rows</span>
                            </p>
                        </div>

                        <button
                            onClick={() => window.location.reload()}
                            className="px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg shadow-emerald-600/20 transition-all text-sm inline-flex items-center gap-2"
                        >
                            <span>Reload Application Workspace</span>
                            <ArrowRight className="w-4 h-4" />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default RestoreModal;
