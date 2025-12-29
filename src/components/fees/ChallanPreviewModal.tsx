import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import Avatar from '../common/Avatar';
import { ChallanPreviewItem } from './ChallanGenerationPage';

interface ChallanPreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (studentIds: string[]) => Promise<void>;
    previewData: ChallanPreviewItem[];
    isGenerating: boolean;
}

const DownArrow = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>;

const ChallanPreviewModal: React.FC<ChallanPreviewModalProps> = ({ isOpen, onClose, onConfirm, previewData, isGenerating }) => {
    const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
    const [expandedRow, setExpandedRow] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            // Pre-select all students when modal opens
            setSelectedStudentIds(new Set(previewData.map(p => p.student.id)));
            setExpandedRow(null);
        }
    }, [isOpen, previewData]);
    
    const handleToggleStudent = (studentId: string) => {
        setSelectedStudentIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(studentId)) {
                newSet.delete(studentId);
            } else {
                newSet.add(studentId);
            }
            return newSet;
        });
    };

    const handleToggleAll = () => {
        if (selectedStudentIds.size === previewData.length) {
            setSelectedStudentIds(new Set());
        } else {
            setSelectedStudentIds(new Set(previewData.map(p => p.student.id)));
        }
    };

    const handleConfirmClick = () => {
        onConfirm(Array.from(selectedStudentIds));
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Challan Generation Preview (${previewData.length} Students)`}>
            <div className="space-y-4">
                <p className="text-sm text-secondary-500">
                    Review the challans to be generated. Uncheck any students you wish to exclude. Click a row to see a fee breakdown.
                </p>

                <div className="max-h-80 overflow-y-auto border dark:border-secondary-600 rounded-lg">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-secondary-700 uppercase bg-secondary-50 dark:bg-secondary-700 dark:text-secondary-300 sticky top-0">
                            <tr>
                                <th className="p-2 w-12 text-center">
                                    <input type="checkbox"
                                        className="rounded"
                                        checked={previewData.length > 0 && selectedStudentIds.size === previewData.length}
                                        onChange={handleToggleAll}
                                        aria-label="Select all students"
                                    />
                                </th>
                                <th className="px-4 py-2">Student</th>
                                <th className="px-4 py-2 text-right">Total Amount</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y dark:divide-secondary-700">
                            {previewData.map(item => (
                                <React.Fragment key={item.student.id}>
                                    <tr 
                                        className="hover:bg-secondary-50 dark:hover:bg-secondary-700/50 cursor-pointer"
                                        onClick={() => setExpandedRow(prev => prev === item.student.id ? null : item.student.id)}
                                    >
                                        <td className="p-2 text-center" onClick={e => e.stopPropagation()}>
                                            <input type="checkbox"
                                                className="rounded"
                                                checked={selectedStudentIds.has(item.student.id)}
                                                onChange={() => handleToggleStudent(item.student.id)}
                                                aria-label={`Select ${item.student.name}`}
                                            />
                                        </td>
                                        <td className="px-4 py-2">
                                            <div className="flex items-center gap-3">
                                                <Avatar student={item.student} className="w-8 h-8" />
                                                <div>
                                                    <p className="font-medium">{item.student.name}</p>
                                                    <p className="text-xs text-secondary-500">{item.className} - <span className="font-bold text-primary-700 dark:text-primary-400">ID: {item.student.rollNumber}</span></p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-2 text-right font-semibold">
                                            <div className="flex items-center justify-end gap-2">
                                                <span>Rs. {item.totalAmount.toLocaleString()}</span>
                                                <DownArrow className={`transition-transform ${expandedRow === item.student.id ? 'rotate-180' : ''}`} />
                                            </div>
                                        </td>
                                    </tr>
                                    {expandedRow === item.student.id && (
                                        <tr>
                                            <td colSpan={3} className="p-0">
                                                <div className="bg-secondary-100 dark:bg-secondary-900/50 px-6 py-3">
                                                    <h4 className="font-semibold text-xs uppercase mb-2">Fee Breakdown</h4>
                                                    <div className="space-y-1 text-xs">
                                                        {item.feeItems.map((fi, idx) => (
                                                            <div key={idx} className="flex justify-between">
                                                                <span>{fi.description}</span>
                                                                <span>Rs. {fi.amount.toLocaleString()}</span>
                                                            </div>
                                                        ))}
                                                        {item.previousBalance > 0 && (
                                                            <div className="flex justify-between font-medium border-t pt-1 mt-1 dark:border-secondary-700">
                                                                <span>Arrears / Opening Balance</span>
                                                                <span>Rs. {item.previousBalance.toLocaleString()}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>

                 <p className="text-sm text-secondary-600 dark:text-secondary-400 mt-2 text-center">
                    {selectedStudentIds.size} of {previewData.length} challans selected for generation.
                </p>

                <div className="flex justify-end space-x-3 pt-4 border-t dark:border-secondary-700">
                    <button type="button" onClick={onClose} className="btn-secondary" disabled={isGenerating}>Cancel</button>
                    <button type="button" onClick={handleConfirmClick} className="btn-primary" disabled={isGenerating || selectedStudentIds.size === 0}>
                        {isGenerating ? 'Generating...' : `Generate ${selectedStudentIds.size} Challans`}
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default ChallanPreviewModal;