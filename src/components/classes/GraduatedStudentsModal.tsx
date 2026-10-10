import React, { useState, useMemo } from 'react';
import Modal from '../common/Modal';
import Avatar from '../common/Avatar';
import { Student, Class, FeeChallan, Result } from '../../types';

interface GraduatedStudentsModalProps {
    isOpen: boolean;
    onClose: () => void;
    graduatedStudents: Student[];
    classes: Class[];
    fees: FeeChallan[];
    results: Result[];
    onReactivate: (options: {
        studentIds?: string[];
        targetClassId?: string;
        restoreFromHistory?: boolean;
    }) => Promise<number>;
    onRevertPromotion?: () => Promise<boolean>;
    hasRollbackSnapshot?: boolean;
}

export const GraduatedStudentsModal: React.FC<GraduatedStudentsModalProps> = ({
    isOpen,
    onClose,
    graduatedStudents,
    classes,
    fees,
    results,
    onReactivate,
    onRevertPromotion,
    hasRollbackSnapshot = false,
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [actionType, setActionType] = useState<'history' | 'keep' | 'target'>('history');
    const [targetClassId, setTargetClassId] = useState<string>(classes[0]?.id || '');
    const [isProcessing, setIsProcessing] = useState(false);

    // Map class names
    const classMap = useMemo(() => new Map(classes.map(c => [c.id, `${c.name}${c.section ? ` - ${c.section}` : ''}`])), [classes]);

    // Pre-calculate historical class for each student
    const historyMap = useMemo(() => {
        const map = new Map<string, { classId: string; className: string; source: string }>();

        // From fees
        for (const fee of fees) {
            if (fee.classId && classMap.has(fee.classId)) {
                map.set(fee.studentId, {
                    classId: fee.classId,
                    className: classMap.get(fee.classId) || '',
                    source: `Fee Record (${fee.month} ${fee.year})`
                });
            }
        }

        // From results
        for (const res of results) {
            if (res.classId && !map.has(res.studentId) && classMap.has(res.classId)) {
                map.set(res.studentId, {
                    classId: res.classId,
                    className: classMap.get(res.classId) || '',
                    source: `Exam Record (${res.exam})`
                });
            }
        }

        // From admittedClass
        for (const s of graduatedStudents) {
            if (!map.has(s.id) && s.admittedClass) {
                const matched = classes.find(c => c.name.trim().toLowerCase() === s.admittedClass.trim().toLowerCase());
                if (matched) {
                    map.set(s.id, {
                        classId: matched.id,
                        className: classMap.get(matched.id) || '',
                        source: `Admitted Class`
                    });
                }
            }
        }

        return map;
    }, [fees, results, classes, classMap, graduatedStudents]);

    const filteredStudents = useMemo(() => {
        if (!searchTerm.trim()) return graduatedStudents;
        const term = searchTerm.toLowerCase();
        return graduatedStudents.filter(s => 
            s.name.toLowerCase().includes(term) || 
            s.rollNumber.toLowerCase().includes(term) ||
            (s.grNumber && s.grNumber.toLowerCase().includes(term))
        );
    }, [graduatedStudents, searchTerm]);

    const handleSelectAll = () => {
        setSelectedIds(new Set(filteredStudents.map(s => s.id)));
    };

    const handleDeselectAll = () => {
        setSelectedIds(new Set());
    };

    const handleToggleStudent = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleExecuteReactivation = async () => {
        const studentIdsToProcess = selectedIds.size > 0 
            ? Array.from(selectedIds) 
            : graduatedStudents.map(s => s.id);

        if (studentIdsToProcess.length === 0) return;

        setIsProcessing(true);
        try {
            if (actionType === 'history') {
                await onReactivate({
                    studentIds: studentIdsToProcess,
                    restoreFromHistory: true
                });
            } else if (actionType === 'target') {
                await onReactivate({
                    studentIds: studentIdsToProcess,
                    targetClassId
                });
            } else {
                await onReactivate({
                    studentIds: studentIdsToProcess
                });
            }
            onClose();
        } finally {
            setIsProcessing(false);
        }
    };

    const handleRevert = async () => {
        if (!onRevertPromotion) return;
        setIsProcessing(true);
        try {
            await onRevertPromotion();
            onClose();
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Reactivate / Recover Graduated Students (${graduatedStudents.length})`}>
            <div className="space-y-4">
                <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 p-3.5 rounded-lg text-sm text-amber-900 dark:text-amber-200">
                    <p className="font-semibold mb-1">Students marked as &apos;Graduated&apos; are hidden from active classes</p>
                    <p className="text-xs text-amber-800 dark:text-amber-300">
                        When students are graduated, they are archived from active class rosters and the main student list. Use the recovery options below to restore them back to <strong>Active</strong> status.
                    </p>
                </div>

                {hasRollbackSnapshot && onRevertPromotion && (
                    <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg">
                        <div>
                            <p className="text-sm font-semibold text-blue-900 dark:text-blue-200">Rollback Snapshot Available</p>
                            <p className="text-xs text-blue-700 dark:text-blue-300">A backup of your previous class promotion was automatically saved.</p>
                        </div>
                        <button
                            type="button"
                            onClick={handleRevert}
                            disabled={isProcessing}
                            className="btn-secondary text-xs bg-white dark:bg-secondary-800 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 font-semibold"
                        >
                            Undo Promotion
                        </button>
                    </div>
                )}

                <div className="border dark:border-secondary-700 rounded-lg p-3 space-y-2 bg-secondary-50/50 dark:bg-secondary-800/40">
                    <label className="text-xs font-bold uppercase tracking-wider text-secondary-600 dark:text-secondary-400">
                        Select Reactivation Strategy
                    </label>
                    <div className="space-y-2">
                        <label className="flex items-start gap-2.5 cursor-pointer">
                            <input
                                type="radio"
                                name="actionType"
                                value="history"
                                checked={actionType === 'history'}
                                onChange={() => setActionType('history')}
                                className="mt-0.5 text-primary-600 focus:ring-primary-500"
                            />
                            <div>
                                <span className="text-sm font-semibold text-secondary-900 dark:text-secondary-100">
                                    Restore to Class from Fee & Exam History (Recommended)
                                </span>
                                <p className="text-xs text-secondary-500 dark:text-secondary-400">
                                    Automatically detects each student&apos;s previous class from historical fee challans and exam records and returns them to that class.
                                </p>
                            </div>
                        </label>

                        <label className="flex items-start gap-2.5 cursor-pointer">
                            <input
                                type="radio"
                                name="actionType"
                                value="keep"
                                checked={actionType === 'keep'}
                                onChange={() => setActionType('keep')}
                                className="mt-0.5 text-primary-600 focus:ring-primary-500"
                            />
                            <div>
                                <span className="text-sm font-semibold text-secondary-900 dark:text-secondary-100">
                                    Keep Assigned Class & Reactivate Status
                                </span>
                                <p className="text-xs text-secondary-500 dark:text-secondary-400">
                                    Leaves students in their currently assigned class ID and changes their status back to &apos;Active&apos;.
                                </p>
                            </div>
                        </label>

                        <label className="flex items-start gap-2.5 cursor-pointer">
                            <input
                                type="radio"
                                name="actionType"
                                value="target"
                                checked={actionType === 'target'}
                                onChange={() => setActionType('target')}
                                className="mt-0.5 text-primary-600 focus:ring-primary-500"
                            />
                            <div className="flex-1">
                                <span className="text-sm font-semibold text-secondary-900 dark:text-secondary-100">
                                    Assign to a Specific Class
                                </span>
                                <p className="text-xs text-secondary-500 dark:text-secondary-400 mb-1.5">
                                    Reactivates all selected students into a single destination class.
                                </p>
                                {actionType === 'target' && (
                                    <select
                                        value={targetClassId}
                                        onChange={e => setTargetClassId(e.target.value)}
                                        className="input-field py-1 text-sm max-w-xs mt-1"
                                    >
                                        {classes.map(c => (
                                            <option key={c.id} value={c.id}>
                                                {c.name}{c.section ? ` - ${c.section}` : ''}
                                            </option>
                                        ))}
                                    </select>
                                )}
                            </div>
                        </label>
                    </div>
                </div>

                <div className="space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <input
                            type="text"
                            placeholder="Search graduated student..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="input-field text-sm py-1.5"
                        />
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={handleSelectAll}
                                className="btn-secondary text-xs py-1"
                            >
                                Select All ({filteredStudents.length})
                            </button>
                            <button
                                type="button"
                                onClick={handleDeselectAll}
                                className="btn-secondary text-xs py-1"
                            >
                                Clear Selection
                            </button>
                        </div>
                    </div>

                    <div className="max-h-56 overflow-y-auto border dark:border-secondary-700 rounded-lg divide-y dark:divide-secondary-700">
                        {filteredStudents.length === 0 ? (
                            <p className="p-4 text-center text-sm text-secondary-500">No graduated students matching search.</p>
                        ) : (
                            filteredStudents.map(student => {
                                const isChecked = selectedIds.has(student.id);
                                const historyInfo = historyMap.get(student.id);
                                const currentClassName = classMap.get(student.classId) || 'Unassigned';

                                return (
                                    <div
                                        key={student.id}
                                        onClick={() => handleToggleStudent(student.id)}
                                        className={`p-2.5 flex items-center justify-between hover:bg-secondary-50 dark:hover:bg-secondary-800/60 cursor-pointer ${
                                            isChecked ? 'bg-primary-50/60 dark:bg-primary-950/30' : ''
                                        }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="checkbox"
                                                checked={isChecked}
                                                onChange={() => {}} // handled by parent onClick
                                                className="h-4 w-4 rounded border-secondary-300 text-primary-600 focus:ring-primary-500"
                                            />
                                            <Avatar student={student} className="w-8 h-8" />
                                            <div>
                                                <p className="text-sm font-medium text-secondary-900 dark:text-white leading-tight">
                                                    {student.name}
                                                </p>
                                                <p className="text-xs text-secondary-500 dark:text-secondary-400">
                                                    ID: <span className="font-semibold">{student.rollNumber}</span> | Current: {currentClassName}
                                                </p>
                                            </div>
                                        </div>
                                        {historyInfo && (
                                            <span className="text-right text-xs">
                                                <span className="inline-block px-2 py-0.5 bg-green-100 dark:bg-green-900/60 text-green-800 dark:text-green-300 rounded font-medium">
                                                    Target: {historyInfo.className}
                                                </span>
                                            </span>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>

                    <p className="text-xs text-secondary-500">
                        {selectedIds.size > 0 
                            ? `${selectedIds.size} of ${graduatedStudents.length} students selected`
                            : `All ${graduatedStudents.length} graduated students will be reactivated`}
                    </p>
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t dark:border-secondary-700">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isProcessing}
                        className="btn-secondary"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleExecuteReactivation}
                        disabled={isProcessing || graduatedStudents.length === 0}
                        className="btn-primary"
                    >
                        {isProcessing 
                            ? 'Reactivating...' 
                            : `Reactivate ${selectedIds.size > 0 ? selectedIds.size : graduatedStudents.length} Students`}
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default GraduatedStudentsModal;
