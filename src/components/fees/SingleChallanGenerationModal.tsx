import React, { useState, useEffect, useMemo } from 'react';
import Modal from '../common/Modal';
import { useData } from '../../context/DataContext';
import { Student, FeeHead } from '../../types';
import { useToast } from '../../context/ToastContext';

interface SingleChallanGenerationModalProps {
    isOpen: boolean;
    onClose: () => void;
    student: Student;
}

const months = [ "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December" ];
const currentYear = new Date().getFullYear();
const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

const SingleChallanGenerationModal: React.FC<SingleChallanGenerationModalProps> = ({ isOpen, onClose, student }) => {
    const { feeHeads, generateChallansForMonth } = useData();
    const { showToast } = useToast();

    const [month, setMonth] = useState(months[new Date().getMonth()]);
    const [year, setYear] = useState(currentYear);
    const [dueDate, setDueDate] = useState('');
    const [selectedFeeHeads, setSelectedFeeHeads] = useState<Map<string, { selected: boolean; amount: number }>>(new Map());
    const [isGenerating, setIsGenerating] = useState(false);

    const schoolFeeHeads = useMemo(() => {
        if (!student) return [];
        return feeHeads.filter(fh => fh.schoolId === student.schoolId);
    }, [feeHeads, student]);
    
    useEffect(() => {
        if (isOpen && student) {
            const studentFeeStructureMap = new Map<string, number>((student.feeStructure || []).map(item => [item.feeHeadId, item.amount]));
            const newMap = new Map<string, { selected: boolean; amount: number }>();
            schoolFeeHeads.forEach((fh: FeeHead) => {
                const studentSpecificAmount = studentFeeStructureMap.get(fh.id);
                newMap.set(fh.id, {
                    selected: true,
                    amount: studentSpecificAmount !== undefined ? studentSpecificAmount : fh.defaultAmount,
                });
            });
            setSelectedFeeHeads(newMap);
            setMonth(months[new Date().getMonth()]);
            setYear(currentYear);
        }
    }, [isOpen, student, schoolFeeHeads]);
    
    useEffect(() => {
        if (isOpen) {
            const monthIndex = months.indexOf(month);
            const m = (monthIndex + 1).toString().padStart(2, '0');
            setDueDate(`${year}-${m}-10`);
        }
    }, [month, year, isOpen]);

    const handleFeeHeadToggle = (id: string) => {
        setSelectedFeeHeads((prev: Map<string, { selected: boolean; amount: number }>) => {
            const newMap = new Map(prev);
            const current = newMap.get(id);
            if (current) {
                newMap.set(id, { ...current, selected: !current.selected });
            }
            return newMap;
        });
    };

    const handleAmountChange = (id: string, amount: string) => {
        const numAmount = parseInt(amount, 10);
        if (isNaN(numAmount)) return;
        
        setSelectedFeeHeads((prev: Map<string, { selected: boolean; amount: number }>) => {
            const newMap = new Map(prev);
            const current = newMap.get(id);
            if (current) {
                newMap.set(id, { ...current, amount: numAmount });
            }
            return newMap;
        });
    };

    const handleGenerate = async () => {
        const feeHeadsToGenerate = Array.from(selectedFeeHeads.entries())
            .filter(([, { selected }]) => selected)
            .map(([feeHeadId, { amount }]) => ({ feeHeadId, amount }));
        
        if (feeHeadsToGenerate.length === 0) {
            showToast('Info', 'Please select at least one fee head.', 'info');
            return;
        }

        setIsGenerating(true);
        try {
            const count = await generateChallansForMonth(month, year, feeHeadsToGenerate, [student.id], dueDate);
            if (count > 0) {
                onClose();
            }
        } catch (error) {
            // Toast is handled in context
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Generate Single Challan for ${student.name}`}>
            <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="input-label">For Month</label>
                        <select value={month} onChange={e => setMonth(e.target.value)} className="input-field">
                            {months.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="input-label">For Year</label>
                        <select value={year} onChange={e => setYear(Number(e.target.value))} className="input-field">
                            {years.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>
                     <div>
                        <label className="input-label">Due Date</label>
                        <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="input-field" />
                    </div>
                </div>

                <div>
                    <h3 className="text-lg font-medium mb-2">Include Fee Heads</h3>
                    <div className="space-y-2 p-2 border dark:border-secondary-700 rounded-lg max-h-60 overflow-y-auto">
                        {schoolFeeHeads.map(fh => (
                            <div key={fh.id} className="flex items-center justify-between gap-4 p-2">
                                <label className="flex items-center space-x-3 flex-1 cursor-pointer">
                                    <input type="checkbox"
                                        checked={selectedFeeHeads.get(fh.id)?.selected || false}
                                        onChange={() => handleFeeHeadToggle(fh.id)}
                                        className="h-4 w-4 rounded border-secondary-300 text-primary-600 focus:ring-primary-500"
                                    />
                                    <span>{fh.name}</span>
                                </label>
                                <div className="flex items-center space-x-2">
                                    <span>Rs.</span>
                                    <input type="number"
                                        value={selectedFeeHeads.get(fh.id)?.amount || 0}
                                        onChange={(e) => handleAmountChange(fh.id, e.target.value)}
                                        className="input-field w-24 text-right"
                                        disabled={!selectedFeeHeads.get(fh.id)?.selected}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                
                <div className="flex justify-end pt-4">
                    <button onClick={handleGenerate} disabled={isGenerating} className="btn-primary">
                        {isGenerating ? 'Generating...' : 'Generate Challan'}
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default SingleChallanGenerationModal;