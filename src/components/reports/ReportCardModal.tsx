import React, { useState, useMemo } from 'react';
import Modal from '../common/Modal';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { usePrint } from '../../context/PrintContext';
import { UserRole, Student, Result } from '../../types';
import PrintableReportCard from './PrintableReportCard';
import { getClassLevel } from '../../utils/sorting';

interface ReportCardModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const ReportCardModal: React.FC<ReportCardModalProps> = ({ isOpen, onClose }) => {
    const { user, activeSchoolId } = useAuth();
    const { students, classes, results, getSchoolById } = useData();
    const { showPrintPreview } = usePrint();
    
    const [classId, setClassId] = useState('');
    const [exam, setExam] = useState('');
    
    const effectiveSchoolId = user?.role === UserRole.Owner && activeSchoolId ? activeSchoolId : user?.schoolId;
    const school = useMemo(() => getSchoolById(effectiveSchoolId || ''), [getSchoolById, effectiveSchoolId]);
    const schoolClasses = useMemo(() => classes.filter(c => c.schoolId === effectiveSchoolId), [classes, effectiveSchoolId]);
    const sortedClasses = useMemo(() => [...schoolClasses].sort((a, b) => (a.sortOrder ?? Infinity) - (b.sortOrder ?? Infinity) || getClassLevel(a.name) - getClassLevel(b.name)), [schoolClasses]);
    const classMap = useMemo(() => new Map(classes.map(c => [c.id, `${c.name}${c.section ? ` - ${c.section}` : ''}`])), [classes]);

    const examTypes = useMemo(() => [...new Set(results.map((r: Result) => r.exam))], [results]);

    const reportData = useMemo(() => {
        if (!exam || !classId) return [];

        const classStudents = students.filter((s: Student) => 
            s.schoolId === effectiveSchoolId &&
            (classId === 'all' || s.classId === classId) && 
            s.status === 'Active'
        );
        
        return classStudents.map(student => {
            const studentResults = results.filter((r: Result) => r.studentId === student.id && r.exam === exam);
            return { student, results: studentResults };
        });
    }, [students, results, classId, exam, effectiveSchoolId]);

    const handleGenerate = () => {
        if (!school) return;
        
        const content = (
            <div className="printable-report">
                {reportData.map(({ student, results: studentResults }) => (
                    <PrintableReportCard 
                        key={student.id}
                        student={student}
                        studentClass={classMap.get(student.classId)}
                        results={studentResults}
                        exam={exam}
                        school={school}
                    />
                ))}
            </div>
        );
        showPrintPreview(content, `EduSync - Report Cards - ${classId === 'all' ? 'All Classes' : classMap.get(classId)} - ${exam}`);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Generate Student Report Cards">
            <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="class-select" className="input-label">Select Class</label>
                        <select id="class-select" value={classId} onChange={e => setClassId(e.target.value)} className="input-field">
                            <option value="">-- Choose a class --</option>
                            <option value="all">All Classes</option>
                            {sortedClasses.map(c => <option key={c.id} value={c.id}>{`${c.name}${c.section ? ` - ${c.section}` : ''}`}</option>)}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="exam-select" className="input-label">Select Exam</label>
                        <select id="exam-select" value={exam} onChange={e => setExam(e.target.value)} className="input-field">
                            <option value="">-- Choose an exam --</option>
                            {examTypes.map(e => <option key={e} value={e}>{e}</option>)}
                        </select>
                    </div>
                </div>
                <div className="p-4 bg-secondary-50 dark:bg-secondary-700 rounded-md text-center">
                    <p className="text-sm">Found data for <strong className="text-lg">{reportData.length}</strong> students for the selected criteria.</p>
                </div>
                <div className="flex justify-end space-x-3 pt-2">
                    <button onClick={handleGenerate} className="btn-primary" disabled={reportData.length === 0}>Print Preview</button>
                </div>
            </div>
        </Modal>
    );
};

export default ReportCardModal;