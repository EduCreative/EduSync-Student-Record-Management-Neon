
import React, { useState, useMemo } from 'react';
import Modal from '../common/Modal';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { usePrint } from '../../context/PrintContext';
import { UserRole } from '../../types';
import PrintableChallan from './PrintableChallan';
import { getClassLevel } from '../../utils/sorting';
import { formatMonthDisplay } from '../../constants';

const months = [ "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December" ];
const currentYear = new Date().getFullYear();
const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

interface BulkChallanReportModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const BulkChallanReportModal: React.FC<BulkChallanReportModalProps> = ({ isOpen, onClose }) => {
    const { user, activeSchoolId } = useAuth();
    const { fees, students, classes, getSchoolById } = useData();
    const { showPrintPreview } = usePrint();
    
    const [classId, setClassId] = useState('');
    const [month, setMonth] = useState(months[new Date().getMonth()]);
    const [year, setYear] = useState(currentYear);
    const [copies, setCopies] = useState<2 | 3>(3);
    const [penaltyAmount, setPenaltyAmount] = useState(0);

    const effectiveSchoolId = user?.role === UserRole.Owner && activeSchoolId ? activeSchoolId : user?.schoolId;
    const school = useMemo(() => getSchoolById(effectiveSchoolId || ''), [getSchoolById, effectiveSchoolId]);
    const schoolClasses = useMemo(() => classes.filter(c => c.schoolId === effectiveSchoolId), [classes, effectiveSchoolId]);
    const sortedClasses = useMemo(() => [...schoolClasses].sort((a, b) => (a.sortOrder ?? Infinity) - (b.sortOrder ?? Infinity) || getClassLevel(a.name) - getClassLevel(b.name)), [schoolClasses]);
    const studentMap = useMemo(() => new Map(students.map(s => [s.id, s])), [students]);
    const classMap = useMemo(() => new Map(classes.map(c => [c.id, `${c.name}${c.section ? ` - ${c.section}` : ''}`])), [classes]);

    const reportData = useMemo(() => {
        if (!classId) return [];
        return fees.filter(fee => {
            const student = studentMap.get(fee.studentId);
            if (!student || student.schoolId !== effectiveSchoolId) return false;
            return (classId === 'all' || student.classId === classId) && fee.month === month && fee.year === year;
        });
    }, [fees, studentMap, classId, month, year, effectiveSchoolId]);

    const handleGenerate = () => {
        if (!school) return;
        
        const content = (
            <div className="printable-challan-container">
                {reportData.map((challan) => {
                    const student = studentMap.get(challan.studentId);
                    if (!student) return null;

                    return (
                        <div key={challan.id} className="challan-wrapper">
                            <PrintableChallan
                                challan={challan}
                                student={student}
                                school={school}
                                studentClass={classMap.get(student.classId)}
                                copies={copies}
                                lateFee={penaltyAmount}
                            />
                        </div>
                    );
                })}
            </div>
        );
        showPrintPreview(content, `EduSync - Fee Challans - ${classId === 'all' ? 'All Classes' : classMap.get(classId)} - ${formatMonthDisplay(month, year)}`);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Generate Bulk Fee Challans">
            <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="sm:col-span-3">
                        <label htmlFor="class-select" className="input-label">Select Class</label>
                        <select id="class-select" value={classId} onChange={e => setClassId(e.target.value)} className="input-field">
                            <option value="">-- Choose a class --</option>
                            <option value="all">All Classes</option>
                            {sortedClasses.map(c => <option key={c.id} value={c.id}>{`${c.name}${c.section ? ` - ${c.section}` : ''}`}</option>)}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="month-select" className="input-label">Month</label>
                        <select id="month-select" value={month} onChange={e => setMonth(e.target.value)} className="input-field">
                            {months.map(m => <option key={m} value={m}>{m.substring(0,3)}</option>)}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="year-select" className="input-label">Year</label>
                        <select id="year-select" value={year} onChange={e => setYear(Number(e.target.value))} className="input-field">
                            {years.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="penalty-amount" className="input-label">After Due Date Penalty</label>
                        <input 
                            type="number" 
                            id="penalty-amount" 
                            value={penaltyAmount} 
                            onChange={e => setPenaltyAmount(Number(e.target.value))} 
                            className="input-field" 
                            min="0"
                        />
                    </div>
                </div>
                <div>
                    <label className="input-label">Copies per Challan</label>
                    <div className="flex items-center space-x-4 mt-1">
                        <label className="flex items-center cursor-pointer">
                            <input type="radio" name="copies" value={3} checked={copies === 3} onChange={() => setCopies(3)} className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-secondary-300" />
                            <span className="ml-2 text-sm">3 Copies (Bank, School, Parent)</span>
                        </label>
                        <label className="flex items-center cursor-pointer">
                            <input type="radio" name="copies" value={2} checked={copies === 2} onChange={() => setCopies(2)} className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-secondary-300" />
                            <span className="ml-2 text-sm">2 Copies (School, Parent)</span>
                        </label>
                    </div>
                </div>
                <div className="p-4 bg-secondary-50 dark:bg-secondary-700 rounded-md text-center">
                    <p className="text-sm">Found <strong className="text-lg">{reportData.length}</strong> challans for the selected criteria.</p>
                </div>
                <div className="flex justify-end space-x-3 pt-2">
                    <button onClick={handleGenerate} className="btn-primary" disabled={reportData.length === 0}>Print Preview</button>
                </div>
            </div>
        </Modal>
    );
};

export default BulkChallanReportModal;
