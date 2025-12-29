
import React, { useState, useMemo } from 'react';
import Modal from '../common/Modal';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { usePrint } from '../../context/PrintContext';
import { UserRole } from '../../types';
import PrintableChallan from './PrintableChallan';

interface ChallanRangeReportModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const ChallanRangeReportModal: React.FC<ChallanRangeReportModalProps> = ({ isOpen, onClose }) => {
    const { user, activeSchoolId } = useAuth();
    const { fees, students, classes, getSchoolById } = useData();
    const { showPrintPreview } = usePrint();

    const [startChallan, setStartChallan] = useState('');
    const [endChallan, setEndChallan] = useState('');
    const [copies, setCopies] = useState<2 | 3>(3);
    const [penaltyAmount, setPenaltyAmount] = useState(0);

    const effectiveSchoolId = user?.role === UserRole.Owner && activeSchoolId ? activeSchoolId : user?.schoolId;
    const school = useMemo(() => getSchoolById(effectiveSchoolId || ''), [getSchoolById, effectiveSchoolId]);
    const studentMap = useMemo(() => new Map(students.map(s => [s.id, s])), [students]);
    const classMap = useMemo(() => new Map(classes.map(c => [c.id, c.name])), [classes]);
    
    const reportData = useMemo(() => {
        if (!startChallan && !endChallan) return [];

        const start = startChallan || '';
        const end = endChallan || '~~~~~~~~~~~~'; // A string that is likely to be "greater" than any challan number

        return fees
            .filter(fee => {
                const student = studentMap.get(fee.studentId);
                return student?.schoolId === effectiveSchoolId &&
                       fee.challanNumber >= start &&
                       fee.challanNumber <= end;
            })
            .sort((a, b) => a.challanNumber.localeCompare(b.challanNumber));
    }, [fees, studentMap, effectiveSchoolId, startChallan, endChallan]);
    
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
        showPrintPreview(content, `EduSync - Fee Challans - Range`);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Print Fee Challans by Range">
            <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="start-challan" className="input-label">Start Challan Number</label>
                        <input type="text" id="start-challan" value={startChallan} onChange={e => setStartChallan(e.target.value)} className="input-field" placeholder="e.g., 202407-1" />
                    </div>
                    <div>
                        <label htmlFor="end-challan" className="input-label">End Challan Number</label>
                        <input type="text" id="end-challan" value={endChallan} onChange={e => setEndChallan(e.target.value)} className="input-field" placeholder="e.g., 202407-50" />
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
                            <input type="radio" name="copiesRange" value={3} checked={copies === 3} onChange={() => setCopies(3)} className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-secondary-300" />
                            <span className="ml-2 text-sm">3 Copies (Bank, School, Parent)</span>
                        </label>
                        <label className="flex items-center cursor-pointer">
                            <input type="radio" name="copiesRange" value={2} checked={copies === 2} onChange={() => setCopies(2)} className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-secondary-300" />
                            <span className="ml-2 text-sm">2 Copies (School, Parent)</span>
                        </label>
                    </div>
                </div>
                <div className="p-4 bg-secondary-50 dark:bg-secondary-700 rounded-md text-center">
                    <p className="text-sm">Found <strong className="text-lg">{reportData.length}</strong> challans for the selected range.</p>
                </div>
                <div className="flex justify-end space-x-3 pt-2">
                    <button onClick={handleGenerate} className="btn-primary" disabled={reportData.length === 0}>Print Preview</button>
                </div>
            </div>
        </Modal>
    );
};

export default ChallanRangeReportModal;
