import React, { useState, useMemo } from 'react';
import Modal from '../common/Modal';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { usePrint } from '../../context/PrintContext';
import { downloadCsvString, escapeCsvCell } from '../../utils/csvHelper';
import { UserRole, Student, Class } from '../../types';
import { getClassLevel } from '../../utils/sorting';
import PrintableReportLayout from './PrintableReportLayout';
import { useBranchFilter } from '../../hooks/useBranchFilter';
import BranchPicker from '../common/BranchPicker';
import { getTodayKarachi } from '../../utils/dates';

interface BispSupportReportModalProps {
    isOpen: boolean;
    onClose: () => void;
}

interface ClassBispGroup {
    classId: string;
    className: string;
    students: Student[];
}

const BispSupportReportModal: React.FC<BispSupportReportModalProps> = ({ isOpen, onClose }) => {
    const { user, activeSchoolId } = useAuth();
    const { students, classes, getSchoolById } = useData();
    const { showPrintPreview } = usePrint();
    const { filterStudents, filterClasses, selectedBranchName, hasMultipleBranches } = useBranchFilter();

    const [classId, setClassId] = useState('all');
    const [statusFilter, setStatusFilter] = useState<'Active' | 'all'>('Active');
    const [sortBy, setSortBy] = useState<'rollNumber' | 'name'>('rollNumber');

    const effectiveSchoolId = user?.role === UserRole.Owner && activeSchoolId ? activeSchoolId : user?.schoolId;
    const school = useMemo(() => getSchoolById(effectiveSchoolId || ''), [getSchoolById, effectiveSchoolId]);

    const schoolClasses = useMemo(() => {
        const base = classes.filter(c => c.schoolId === effectiveSchoolId);
        return filterClasses(base);
    }, [classes, effectiveSchoolId, filterClasses]);

    const sortedClasses = useMemo(
        () => [...schoolClasses].sort((a, b) => (a.sortOrder ?? Infinity) - (b.sortOrder ?? Infinity) || getClassLevel(a.name) - getClassLevel(b.name)),
        [schoolClasses]
    );

    const classMap = useMemo(
        () => new Map(classes.map(c => [c.id, `${c.name}${c.section ? ` - ${c.section}` : ''}`])),
        [classes]
    );

    const matchingStudents = useMemo(() => {
        const branchFiltered = filterStudents(students);
        return branchFiltered.filter(s => {
            if (effectiveSchoolId && s.schoolId !== effectiveSchoolId) return false;
            if (!s.receiveBispSupport) return false;
            if (s.status === 'Deleted') return false;
            if (statusFilter === 'Active' && s.status !== 'Active') return false;
            if (classId !== 'all' && s.classId !== classId) return false;
            return true;
        });
    }, [students, filterStudents, effectiveSchoolId, statusFilter, classId]);

    const groupedByClass = useMemo<ClassBispGroup[]>(() => {
        const sortStudents = (list: Student[]) =>
            [...list].sort((a, b) => {
                if (sortBy === 'rollNumber') {
                    return a.rollNumber.localeCompare(b.rollNumber, undefined, { numeric: true });
                }
                return a.name.localeCompare(b.name);
            });

        const byClassId = new Map<string, Student[]>();
        matchingStudents.forEach(s => {
            const key = s.classId || '__unassigned__';
            const existing = byClassId.get(key) || [];
            existing.push(s);
            byClassId.set(key, existing);
        });

        const groups: ClassBispGroup[] = [];
        sortedClasses.forEach((cls: Class) => {
            const list = byClassId.get(cls.id);
            if (list && list.length > 0) {
                groups.push({
                    classId: cls.id,
                    className: `${cls.name}${cls.section ? ` - ${cls.section}` : ''}`,
                    students: sortStudents(list),
                });
                byClassId.delete(cls.id);
            }
        });

        // Append any remaining students whose classId wasn't in sortedClasses
        byClassId.forEach((list, remainingClassId) => {
            if (list.length > 0) {
                groups.push({
                    classId: remainingClassId,
                    className: classMap.get(remainingClassId) || 'Unassigned Class',
                    students: sortStudents(list),
                });
            }
        });

        return groups;
    }, [matchingStudents, sortedClasses, sortBy, classMap]);

    const handlePrintPreview = () => {
        const selectedClassLabel = classId === 'all' ? 'All Classes' : (classMap.get(classId) || 'Selected Class');
        const statusLabel = statusFilter === 'Active' ? 'Active Students' : 'All Non-Deleted Students';
        const baseSubtitle = `Class: ${selectedClassLabel} | Status: ${statusLabel} | Total BISP Recipients: ${matchingStudents.length}`;
        const subtitle = hasMultipleBranches ? `Branch: ${selectedBranchName} | ${baseSubtitle}` : baseSubtitle;

        const content = (
            <PrintableReportLayout
                school={school}
                title="BISP Support Students Report (Class-Wise)"
                subtitle={subtitle}
            >
                <div className="space-y-5">
                    {groupedByClass.map(group => (
                        <div key={group.classId} className="break-inside-avoid-page">
                            <div className="flex items-center justify-between bg-secondary-100 px-2.5 py-1.5 border border-secondary-300 font-bold text-sm">
                                <span>Class: {group.className}</span>
                                <span>Total Students: {group.students.length}</span>
                            </div>
                            <table className="w-full text-sm border-collapse">
                                <thead>
                                    <tr>
                                        <th className="p-1.5 text-left border border-secondary-300 w-10">Sr.</th>
                                        <th className="p-1.5 text-left border border-secondary-300 w-24">Student ID</th>
                                        <th className="p-1.5 text-left border border-secondary-300">Student Name</th>
                                        <th className="p-1.5 text-left border border-secondary-300">Father&apos;s Name</th>
                                        <th className="p-1.5 text-left border border-secondary-300">Father&apos;s CNIC</th>
                                        <th className="p-1.5 text-left border border-secondary-300 w-20">Gender</th>
                                        <th className="p-1.5 text-left border border-secondary-300">Contact</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {group.students.map((student, idx) => (
                                        <tr key={student.id}>
                                            <td className="p-1.5 border border-secondary-300">{idx + 1}</td>
                                            <td className="p-1.5 border border-secondary-300 font-medium">{student.rollNumber}</td>
                                            <td className="p-1.5 border border-secondary-300">{student.name}</td>
                                            <td className="p-1.5 border border-secondary-300">{student.fatherName || 'N/A'}</td>
                                            <td className="p-1.5 border border-secondary-300">{student.fatherCnic || 'N/A'}</td>
                                            <td className="p-1.5 border border-secondary-300">{student.gender}</td>
                                            <td className="p-1.5 border border-secondary-300">{student.contactNumber || 'N/A'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ))}
                    <div className="pt-2 border-t-2 border-black flex justify-between text-sm font-bold">
                        <span>Total Classes with BISP Recipients: {groupedByClass.length}</span>
                        <span>Grand Total Students Receiving BISP Support: {matchingStudents.length}</span>
                    </div>
                </div>
            </PrintableReportLayout>
        );

        const dateStr = getTodayKarachi();
        showPrintPreview(content, `EduSync-BISP-Support-${selectedClassLabel}-${dateStr}`);
    };

    const handleExportCsv = () => {
        const headers = [
            "Class",
            "Sr.",
            "Student ID",
            "Student Name",
            "Father's Name",
            "Father's CNIC",
            "Gender",
            "Contact Number",
            "Status",
            "Receive BISP Support"
        ];

        const csvRows = [
            escapeCsvCell(`Branch: ${selectedBranchName}`),
            headers.map(escapeCsvCell).join(',')
        ];

        groupedByClass.forEach(group => {
            group.students.forEach((student, idx) => {
                const row = [
                    group.className,
                    idx + 1,
                    student.rollNumber,
                    student.name,
                    student.fatherName || '',
                    student.fatherCnic || '',
                    student.gender,
                    student.contactNumber || '',
                    student.status,
                    'Yes'
                ];
                csvRows.push(row.map(escapeCsvCell).join(','));
            });
        });

        const selectedClassLabel = classId === 'all' ? 'AllClasses' : (classMap.get(classId) || 'Class');
        const dateStr = getTodayKarachi();
        downloadCsvString(csvRows.join('\n'), `EduSync-BISP-Support-${selectedClassLabel}-${dateStr}`);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="BISP Support Report (Class-Wise)">
            <div className="space-y-4">
                {hasMultipleBranches && (
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 bg-secondary-50 dark:bg-secondary-700/50 rounded-lg">
                        <span className="text-sm font-medium text-secondary-700 dark:text-secondary-300">Filter Branch:</span>
                        <BranchPicker />
                    </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                        <label htmlFor="bisp-class-filter" className="input-label">Select Class</label>
                        <select
                            id="bisp-class-filter"
                            value={classId}
                            onChange={e => setClassId(e.target.value)}
                            className="input-field"
                        >
                            <option value="all">All Classes</option>
                            {sortedClasses.map(c => (
                                <option key={c.id} value={c.id}>{`${c.name}${c.section ? ` - ${c.section}` : ''}`}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="bisp-status-filter" className="input-label">Student Status</label>
                        <select
                            id="bisp-status-filter"
                            value={statusFilter}
                            onChange={e => setStatusFilter(e.target.value as 'Active' | 'all')}
                            className="input-field"
                        >
                            <option value="Active">Active Only</option>
                            <option value="all">All Non-Deleted</option>
                        </select>
                    </div>
                    <div>
                        <label htmlFor="bisp-sort-by" className="input-label">Sort Within Class</label>
                        <select
                            id="bisp-sort-by"
                            value={sortBy}
                            onChange={e => setSortBy(e.target.value as 'rollNumber' | 'name')}
                            className="input-field"
                        >
                            <option value="rollNumber">Student ID</option>
                            <option value="name">Student Name</option>
                        </select>
                    </div>
                </div>

                <div className="p-4 bg-secondary-50 dark:bg-secondary-700/60 rounded-lg text-center border border-secondary-200 dark:border-secondary-600">
                    <p className="text-sm text-secondary-700 dark:text-secondary-200">
                        Found <strong className="text-lg text-primary-600 dark:text-primary-400">{matchingStudents.length}</strong>{' '}
                        {matchingStudents.length === 1 ? 'student' : 'students'} receiving BISP support across{' '}
                        <strong className="text-lg">{groupedByClass.length}</strong>{' '}
                        {groupedByClass.length === 1 ? 'class' : 'classes'}.
                    </p>
                </div>

                {groupedByClass.length > 0 && (
                    <div className="max-h-60 overflow-y-auto border border-secondary-200 dark:border-secondary-700 rounded-lg divide-y divide-secondary-200 dark:divide-secondary-700">
                        {groupedByClass.map(group => (
                            <div key={group.classId} className="p-3 bg-white dark:bg-secondary-800">
                                <div className="flex items-center justify-between mb-1.5">
                                    <h4 className="font-semibold text-sm text-secondary-900 dark:text-white">
                                        {group.className}
                                    </h4>
                                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-primary-100 text-primary-800 dark:bg-primary-900/50 dark:text-primary-200">
                                        {group.students.length} {group.students.length === 1 ? 'student' : 'students'}
                                    </span>
                                </div>
                                <div className="text-xs text-secondary-600 dark:text-secondary-300 space-y-1">
                                    {group.students.map((s, idx) => (
                                        <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-0.5 border-t border-secondary-100 dark:border-secondary-700/60 first:border-t-0">
                                            <span>
                                                {idx + 1}. <strong className="text-secondary-800 dark:text-secondary-100">{s.name}</strong> (ID: {s.rollNumber})
                                                {s.fatherName ? ` — S/D/o ${s.fatherName}` : ''}
                                            </span>
                                            {s.contactNumber && (
                                                <span className="text-secondary-500 dark:text-secondary-400">{s.contactNumber}</span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                <div className="flex justify-end space-x-3 pt-2">
                    <button
                        type="button"
                        onClick={handleExportCsv}
                        className="btn-secondary"
                        disabled={matchingStudents.length === 0}
                    >
                        Export CSV
                    </button>
                    <button
                        type="button"
                        onClick={handlePrintPreview}
                        className="btn-primary"
                        disabled={matchingStudents.length === 0}
                    >
                        Print Preview
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default BispSupportReportModal;
