import React, { useState, useMemo } from 'react';
import Modal from '../common/Modal';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { usePrint } from '../../context/PrintContext';
import { UserRole } from '../../types';
import PrintableChallan from './PrintableChallan';
import { naturalCompare } from '../../utils/sorting';

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
    const [copies, setCopies] = useState<2 | 3>(2);
    const [challansPerPage, setChallansPerPage] = useState<1 | 2 | 3>(3);
    const [penaltyAmount, setPenaltyAmount] = useState(0);

    const effectiveSchoolId = user?.role === UserRole.Owner && activeSchoolId ? activeSchoolId : user?.schoolId;
    const school = useMemo(() => getSchoolById(effectiveSchoolId || ''), [getSchoolById, effectiveSchoolId]);
    const studentMap = useMemo(() => new Map(students.map(s => [s.id, s])), [students]);
    const classMap = useMemo(() => new Map(classes.map(c => [c.id, c.name])), [classes]);
    
    const reportData = useMemo(() => {
        if (!startChallan && !endChallan) return [];

        const start = startChallan || '';
        const end = endChallan || '~~~~~~~~~~~~';

        return fees
            .filter(fee => {
                const student = studentMap.get(fee.studentId);
                return student?.schoolId === effectiveSchoolId &&
                       fee.challanNumber >= start &&
                       fee.challanNumber <= end;
            })
            .sort((a, b) => naturalCompare(a.challanNumber, b.challanNumber));
    }, [fees, studentMap, effectiveSchoolId, startChallan, endChallan]);
    
    const handleGenerate = () => {
        if (!school) return;

        const content = (
             <div className="printable-challan-container">
                {reportData.map((challan, index) => {
                    const student = studentMap.get(challan.studentId);
                    if (!student) return null;

                    const isLastOnPage = (index + 1) % challansPerPage === 0;

                    return (
                        <div 
                            key={challan.id} 
                            className={`challan-wrapper per-page-${challansPerPage}`}
                            style={{
                                pageBreakAfter: isLastOnPage ? 'always' : 'auto',
                                breakAfter: isLastOnPage ? 'page' : 'auto'
                            }}
                        >
                            <PrintableChallan
                                challan={challan}
                                student={student}
                                school={school}
                                studentClass={classMap.get(student.classId)}
                                copies={copies}
                                challansPerPage={challansPerPage}
                                lateFee={penaltyAmount}
                                allFees={fees}
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
                            onChange={e => setPenaltyAmount(Number(e.target.value) || 0)} 
                            className="input-field" 
                        />
                    </div>
                    <div>
                        <label htmlFor="copies" className="input-label">Copies per Challan</label>
                        <select id="copies" value={copies} onChange={e => setCopies(Number(e.target.value) as 2 | 3)} className="input-field">
                            <option value={2}>2 Copies (Bank & School)</option>
                            <option value={3}>3 Copies (Bank, School & Student)</option>
                        </select>
                    </div>
                    <div>
                        <label htmlFor="challans-per-page" className="input-label">Challans per Page (Print Layout)</label>
                        <select id="challans-per-page" value={challansPerPage} onChange={e => setChallansPerPage(Number(e.target.value) as 1 | 2 | 3)} className="input-field">
                            <option value={1}>1 Per Page</option>
                            <option value={2}>2 Per Page</option>
                            <option value={3}>3 Per Page</option>
                        </select>
                    </div>
                </div>

                <div className="bg-secondary-50 dark:bg-secondary-800/50 p-3 rounded-lg text-sm text-secondary-600 dark:text-secondary-400">
                    Found <strong>{reportData.length}</strong> challan(s) matching the specified range.
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                    <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
                    <button 
                        type="button" 
                        onClick={handleGenerate} 
                        disabled={reportData.length === 0}
                        className="btn-primary disabled:opacity-50"
                    >
                        Generate Printable Challans
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default ChallanRangeReportModal;
