import React, { useState, useMemo } from 'react';
import Modal from '../common/Modal';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { usePrint } from '../../context/PrintContext';
import { UserRole } from '../../types';
import PrintableIdCard from './PrintableIdCard';
import { getClassLevel } from '../../utils/sorting';

interface StudentIdCardModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const StudentIdCardModal: React.FC<StudentIdCardModalProps> = ({ isOpen, onClose }) => {
    const { user, activeSchoolId } = useAuth();
    const { students, classes, getSchoolById } = useData();
    const { showPrintPreview } = usePrint();
    
    const [classId, setClassId] = useState('');
    
    const effectiveSchoolId = user?.role === UserRole.Owner && activeSchoolId ? activeSchoolId : user?.schoolId;
    const school = useMemo(() => getSchoolById(effectiveSchoolId || ''), [getSchoolById, effectiveSchoolId]);
    const schoolClasses = useMemo(() => classes.filter(c => c.schoolId === effectiveSchoolId), [classes, effectiveSchoolId]);
    const sortedClasses = useMemo(() => [...schoolClasses].sort((a, b) => (a.sortOrder ?? Infinity) - (b.sortOrder ?? Infinity) || getClassLevel(a.name) - getClassLevel(b.name)), [schoolClasses]);
    const classMap = useMemo(() => new Map(classes.map(c => [c.id, `${c.name}${c.section ? ` - ${c.section}` : ''}`])), [classes]);

    const reportData = useMemo(() => {
        if (!classId) return [];
        return students.filter(s => (classId === 'all' || s.classId === classId) && s.schoolId === effectiveSchoolId && s.status === 'Active');
    }, [students, classId, effectiveSchoolId]);

    const handleGenerate = () => {
        if (!school) return;
        
        const content = (
            <div className="printable-id-card-container">
                {reportData.map(student => (
                    <PrintableIdCard 
                        key={student.id}
                        student={student}
                        studentClass={classMap.get(student.classId)}
                        school={school}
                    />
                ))}
            </div>
        );
        showPrintPreview(content, `EduSync - ID Cards - ${classId === 'all' ? 'All Classes' : classMap.get(classId)}`);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Generate Student ID Cards">
            <div className="space-y-4">
                <div>
                    <label htmlFor="class-select-id-card" className="input-label">Select Class</label>
                    <select id="class-select-id-card" value={classId} onChange={e => setClassId(e.target.value)} className="input-field">
                        <option value="">-- Choose a class --</option>
                        <option value="all">All Classes</option>
                        {sortedClasses.map(c => <option key={c.id} value={c.id}>{`${c.name}${c.section ? ` - ${c.section}` : ''}`}</option>)}
                    </select>
                </div>
                <div className="p-4 bg-secondary-50 dark:bg-secondary-700 rounded-md text-center">
                    <p className="text-sm">Found <strong className="text-lg">{reportData.length}</strong> students in the selected class.</p>
                </div>
                <div className="flex justify-end space-x-3 pt-2">
                    <button onClick={handleGenerate} className="btn-primary" disabled={reportData.length === 0}>Print Preview</button>
                </div>
            </div>
        </Modal>
    );
};

export default StudentIdCardModal;