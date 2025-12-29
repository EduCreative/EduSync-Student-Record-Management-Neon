import React, { useState, useMemo } from 'react';
import Modal from '../common/Modal';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { usePrint } from '../../context/PrintContext';
import { downloadCsvString, escapeCsvCell } from '../../utils/csvHelper';
import { UserRole, Student } from '../../types';
import { formatDate } from '../../constants';
import { getClassLevel } from '../../utils/sorting';
import PrintableReportLayout from './PrintableReportLayout';

interface ClassListReportModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const availableColumns = {
    rollNumber: "Student ID",
    fatherName: "Father's Name",
    fatherCnic: "Father's CNIC",
    gender: "Gender",
    dateOfBirth: "Date of Birth",
    caste: "Caste",
    contactNumber: "Contact Number",
    secondaryContactNumber: "Secondary Contact",
    dateOfAdmission: "Admission Date",
    address: "Address",
};

type ColumnKey = keyof typeof availableColumns;

const ClassListReportModal: React.FC<ClassListReportModalProps> = ({ isOpen, onClose }) => {
    const { user, activeSchoolId } = useAuth();
    const { students, classes, getSchoolById } = useData();
    const { showPrintPreview } = usePrint();

    const [classId, setClassId] = useState('all');
    const [sortBy, setSortBy] = useState('name');
    const [genderFilter, setGenderFilter] = useState('all');
    const [selectedColumns, setSelectedColumns] = useState<Record<ColumnKey, boolean>>({
        rollNumber: true,
        fatherName: true,
        fatherCnic: false,
        gender: false,
        dateOfBirth: false,
        caste: false,
        contactNumber: true,
        secondaryContactNumber: false,
        dateOfAdmission: false,
        address: false,
    });

    const handleColumnToggle = (col: ColumnKey) => {
        setSelectedColumns(prev => ({ ...prev, [col]: !prev[col] }));
    };

    const effectiveSchoolId = user?.role === UserRole.Owner && activeSchoolId ? activeSchoolId : user?.schoolId;
    const school = useMemo(() => getSchoolById(effectiveSchoolId || ''), [getSchoolById, effectiveSchoolId]);
    const schoolClasses = useMemo(() => classes.filter(c => c.schoolId === effectiveSchoolId), [classes, effectiveSchoolId]);
    const sortedClasses = useMemo(() => [...schoolClasses].sort((a, b) => (a.sortOrder ?? Infinity) - (b.sortOrder ?? Infinity) || getClassLevel(a.name) - getClassLevel(b.name)), [schoolClasses]);
    const classMap = useMemo(() => new Map(classes.map(c => [c.id, `${c.name}${c.section ? ` - ${c.section}` : ''}`])), [classes]);

    const reportData = useMemo(() => {
        return students
            .filter((s: Student) =>
                s.schoolId === effectiveSchoolId &&
                (classId === 'all' || s.classId === classId) &&
                s.status === 'Active' &&
                (genderFilter === 'all' || s.gender === genderFilter)
            )
            .sort((a, b) => {
                if (sortBy === 'rollNumber') {
                    return a.rollNumber.localeCompare(b.rollNumber, undefined, { numeric: true });
                }
                return a.name.localeCompare(b.name);
            });
    }, [students, classId, effectiveSchoolId, genderFilter, sortBy]);

    const handleGenerate = () => {
        const activeColumns = Object.keys(selectedColumns).filter(k => selectedColumns[k as ColumnKey]) as ColumnKey[];
        
        const content = (
            <PrintableReportLayout
                school={school}
                title="Class List"
                subtitle={`Class: ${classId === 'all' ? 'All Classes' : schoolClasses.find(c => c.id === classId)?.name}`}
            >
                <table className="w-full text-sm">
                    <thead>
                        <tr>
                            <th className="p-1 text-left">Sr.</th>
                            <th className="p-1 text-left">Student Name</th>
                            {classId === 'all' && <th className="p-1 text-left">Class</th>}
                            {activeColumns.map(col => <th key={col} className="p-1 text-left">{availableColumns[col]}</th>)}
                        </tr>
                    </thead>
                    <tbody>
                        {reportData.map((student, index) => (
                            <tr key={student.id}>
                                <td className="p-1">{index + 1}</td>
                                <td className="p-1">{student.name}</td>
                                {classId === 'all' && <td className="p-1">{classMap.get(student.classId) || 'N/A'}</td>}
                                {activeColumns.map(col => (
                                    <td key={col} className="p-1">
                                        {col === 'dateOfAdmission' || col === 'dateOfBirth' ? formatDate(student[col]) : (student as any)[col] || 'N/A'}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </PrintableReportLayout>
        );
        showPrintPreview(content, `EduSync - Class List - ${schoolClasses.find(c => c.id === classId)?.name || 'All Classes'}`);
    };
    
    const handleExport = () => {
        const headers = ["Sr.", "Student Name"];
        if (classId === 'all') {
            headers.push("Class");
        }
        const activeColumnHeaders = Object.keys(selectedColumns).filter(k => selectedColumns[k as ColumnKey]).map(k => availableColumns[k as ColumnKey]);
        headers.push(...activeColumnHeaders);

        const csvRows = [headers.join(',')];

        reportData.forEach((student, index) => {
            const rowData: (string|number|null|undefined)[] = [
                index + 1,
                student.name,
            ];
            if (classId === 'all') {
                rowData.push(classMap.get(student.classId) || 'N/A');
            }

            const activeColumnKeys = Object.keys(selectedColumns).filter(k => selectedColumns[k as ColumnKey]) as ColumnKey[];
            activeColumnKeys.forEach(col => {
                const value = (student as any)[col];
                rowData.push(col === 'dateOfAdmission' || col === 'dateOfBirth' ? formatDate(value) : value);
            });
            
            csvRows.push(rowData.map(escapeCsvCell).join(','));
        });
        
        downloadCsvString(csvRows.join('\n'), 'class_list_report');
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Generate Printable Class List">
            <div className="space-y-4">
                 <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                        <label htmlFor="class-filter-list" className="input-label">Select Class</label>
                        <select id="class-filter-list" value={classId} onChange={e => setClassId(e.target.value)} className="input-field">
                            <option value="all">All Classes</option>
                            {sortedClasses.map(c => <option key={c.id} value={c.id}>{`${c.name}${c.section ? ` - ${c.section}` : ''}`}</option>)}
                        </select>
                    </div>
                     <div>
                        <label htmlFor="gender-filter" className="input-label">Filter by Gender</label>
                        <select id="gender-filter" value={genderFilter} onChange={e => setGenderFilter(e.target.value)} className="input-field">
                            <option value="all">All</option>
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                        </select>
                    </div>
                     <div>
                        <label htmlFor="sort-by" className="input-label">Sort By</label>
                        <select id="sort-by" value={sortBy} onChange={e => setSortBy(e.target.value)} className="input-field">
                            <option value="name">Student Name</option>
                            <option value="rollNumber">Student ID</option>
                        </select>
                    </div>
                </div>

                <div>
                    <label className="input-label">Include Columns</label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 border rounded-md dark:border-secondary-600">
                        {Object.entries(availableColumns).map(([key, label]) => (
                            <label key={key} className="flex items-center space-x-2">
                                <input type="checkbox" checked={selectedColumns[key as ColumnKey]} onChange={() => handleColumnToggle(key as ColumnKey)} className="rounded" />
                                <span className="text-sm">{label}</span>
                            </label>
                        ))}
                    </div>
                </div>

                 <div className="p-4 bg-secondary-50 dark:bg-secondary-700 rounded-md text-center">
                    <p className="text-sm">Found <strong className="text-lg">{reportData.length}</strong> students for the selected criteria.</p>
                </div>

                <div className="flex justify-end space-x-3 pt-2">
                    <button onClick={handleExport} className="btn-secondary" disabled={reportData.length === 0}>Export CSV</button>
                    <button onClick={handleGenerate} className="btn-primary" disabled={reportData.length === 0}>Print Preview</button>
                </div>
            </div>
        </Modal>
    );
};

export default ClassListReportModal;