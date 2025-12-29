import React, { useState, useMemo } from 'react';
import Modal from '../common/Modal';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { usePrint } from '../../context/PrintContext';
import { downloadCsvString, escapeCsvCell } from '../../utils/csvHelper';
import { UserRole, Student } from '../../types';
import { getClassLevel } from '../../utils/sorting';
import PrintableReportLayout from './PrintableReportLayout';

interface MissingDataReportModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const checkableFields = {
    fatherCnic: "Father's CNIC",
    contactNumber: "Contact Number",
    secondaryContactNumber: "Secondary Contact",
    address: "Address",
    dateOfBirth: "Date of Birth",
    gender: "Gender",
    religion: "Religion",
    caste: "Caste",
    grNumber: "GR Number",
    lastSchoolAttended: "Last School Attended"
};
type FieldKey = keyof typeof checkableFields;

const MissingDataReportModal: React.FC<MissingDataReportModalProps> = ({ isOpen, onClose }) => {
    const { user, activeSchoolId } = useAuth();
    const { students, classes, getSchoolById } = useData();
    const { showPrintPreview } = usePrint();

    const [classId, setClassId] = useState('all');
    const [selectedFields, setSelectedFields] = useState<Set<FieldKey>>(new Set(Object.keys(checkableFields) as FieldKey[]));

    const handleFieldToggle = (field: FieldKey) => {
        setSelectedFields(prev => {
            const newSet = new Set(prev);
            if (newSet.has(field)) newSet.delete(field);
            else newSet.add(field);
            return newSet;
        });
    };
    
    const handleToggleAllFields = () => {
        if (selectedFields.size === Object.keys(checkableFields).length) {
            setSelectedFields(new Set());
        } else {
            setSelectedFields(new Set(Object.keys(checkableFields) as FieldKey[]));
        }
    };

    const effectiveSchoolId = user?.role === UserRole.Owner && activeSchoolId ? activeSchoolId : user?.schoolId;
    const school = useMemo(() => getSchoolById(effectiveSchoolId || ''), [getSchoolById, effectiveSchoolId]);
    const schoolClasses = useMemo(() => classes.filter(c => c.schoolId === effectiveSchoolId), [classes, effectiveSchoolId]);
    const sortedClasses = useMemo(() => [...schoolClasses].sort((a, b) => (a.sortOrder ?? Infinity) - (b.sortOrder ?? Infinity) || getClassLevel(a.name) - getClassLevel(b.name)), [schoolClasses]);
    const classMap = useMemo(() => new Map(classes.map(c => [c.id, `${c.name}${c.section ? ` - ${c.section}` : ''}`])), [classes]);

    const reportData = useMemo(() => {
        const studentsInScope = students.filter(s =>
            s.schoolId === effectiveSchoolId &&
            s.status === 'Active' &&
            (classId === 'all' || s.classId === classId)
        );

        return studentsInScope.map(student => {
            const missing = Array.from(selectedFields).filter(field => {
                const value = student[field as keyof Student];
                return value === null || value === undefined || String(value).trim() === '';
            });
            // FIX: Explicitly cast 'f' to FieldKey to resolve 'unknown' index type error.
            return { student, missingFields: missing.map(f => checkableFields[f as FieldKey]) };
        }).filter(item => item.missingFields.length > 0);
    }, [students, classId, effectiveSchoolId, selectedFields]);

    const handleGenerate = () => {
        const content = (
            <PrintableReportLayout
                school={school}
                title="Missing Data Report"
                subtitle={`Class: ${classId === 'all' ? 'All Classes' : classMap.get(classId) || ''}`}
            >
                <table className="w-full text-sm">
                    <thead>
                        <tr>
                            <th className="p-1 text-left">Sr.</th>
                            <th className="p-1 text-left">Student Name</th>
                            <th className="p-1 text-left">Student ID</th>
                            <th className="p-1 text-left">Class</th>
                            <th className="p-1 text-left">Missing Fields</th>
                        </tr>
                    </thead>
                    <tbody>
                        {reportData.map(({ student, missingFields }, index) => (
                            <tr key={student.id}>
                                <td className="p-1">{index + 1}</td>
                                <td className="p-1">{student.name}</td>
                                <td className="p-1">{student.rollNumber}</td>
                                <td className="p-1">{classMap.get(student.classId) || 'N/A'}</td>
                                <td className="p-1">{missingFields.join(', ')}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </PrintableReportLayout>
        );
        showPrintPreview(content, `EduSync - Missing Data Report`);
    };

    const handleExport = () => {
        const headers = ["Sr.", "Student Name", "Student ID", "Class", "Missing Fields"];
        const csvRows = [headers.join(',')];
        
        reportData.forEach(({ student, missingFields }, index) => {
            const row = [
                index + 1,
                student.name,
                student.rollNumber,
                classMap.get(student.classId) || 'N/A',
                missingFields.join('; ')
            ];
            csvRows.push(row.map(escapeCsvCell).join(','));
        });
        
        downloadCsvString(csvRows.join('\n'), 'missing_data_report');
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Generate Missing Data Report">
            <div className="space-y-4">
                <div>
                    <label htmlFor="class-filter-missing-data" className="input-label">Select Class</label>
                    <select id="class-filter-missing-data" value={classId} onChange={e => setClassId(e.target.value)} className="input-field">
                        <option value="all">All Classes</option>
                        {sortedClasses.map(c => <option key={c.id} value={c.id}>{`${c.name}${c.section ? ` - ${c.section}` : ''}`}</option>)}
                    </select>
                </div>

                <div>
                    <div className="flex justify-between items-center mb-1">
                        <label className="input-label">Fields to Check</label>
                        <button onClick={handleToggleAllFields} className="text-xs text-primary-600 hover:underline">
                            {selectedFields.size === Object.keys(checkableFields).length ? 'Deselect All' : 'Select All'}
                        </button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 border rounded-md dark:border-secondary-600 max-h-48 overflow-y-auto">
                        {Object.entries(checkableFields).map(([key, label]) => (
                            <label key={key} className="flex items-center space-x-2">
                                <input type="checkbox" checked={selectedFields.has(key as FieldKey)} onChange={() => handleFieldToggle(key as FieldKey)} className="rounded" />
                                <span className="text-sm">{label}</span>
                            </label>
                        ))}
                    </div>
                </div>

                <div className="p-4 bg-secondary-50 dark:bg-secondary-700 rounded-md text-center">
                    <p className="text-sm">Found <strong className="text-lg">{reportData.length}</strong> students with missing information.</p>
                </div>

                <div className="flex justify-end space-x-3 pt-2">
                    <button onClick={handleExport} className="btn-secondary" disabled={reportData.length === 0}>Export CSV</button>
                    <button onClick={handleGenerate} className="btn-primary" disabled={reportData.length === 0}>Print Preview</button>
                </div>
            </div>
        </Modal>
    );
};

export default MissingDataReportModal;