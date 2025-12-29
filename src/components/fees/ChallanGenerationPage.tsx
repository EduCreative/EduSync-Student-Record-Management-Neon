import React, { useState, useEffect, useMemo } from 'react';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { UserRole, FeeHead, Student } from '../../types';
import { useToast } from '../../context/ToastContext';
import ChallanPreviewModal from './ChallanPreviewModal';
import Modal from '../common/Modal';

const months = [ "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December" ];
const currentYear = new Date().getFullYear();
const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

export interface ChallanPreviewItem {
    student: Student;
    className: string;
    feeItems: { description: string; amount: number }[];
    previousBalance: number;
    totalAmount: number;
}

const ChallanGenerationPage: React.FC = () => {
    const { user, activeSchoolId } = useAuth();
    const { students, fees, classes, feeHeads, generateChallansForMonth, deleteChallansForMonth } = useData();
    const { showToast } = useToast();

    const [month, setMonth] = useState(months[new Date().getMonth()]);
    const [year, setYear] = useState(currentYear);
    const [dueDate, setDueDate] = useState('');
    const [selectedFeeHeads, setSelectedFeeHeads] = useState<Map<string, { selected: boolean; amount: number }>>(new Map());
    
    const [isPreparingPreview, setIsPreparingPreview] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [challanPreview, setChallanPreview] = useState<ChallanPreviewItem[]>([]);
    
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const effectiveSchoolId = user?.role === UserRole.Owner && activeSchoolId ? activeSchoolId : user?.schoolId;
    const classMap = useMemo(() => new Map(classes.map(c => [c.id, c.name])), [classes]);

    const schoolFeeHeads = useMemo(() => {
        if (!effectiveSchoolId) return [];
        return feeHeads.filter(fh => fh.schoolId === effectiveSchoolId);
    }, [feeHeads, effectiveSchoolId]);

    const existingChallansCount = useMemo(() => {
        return fees.filter(f => {
            const student = students.find(s => s.id === f.studentId);
            return student?.schoolId === effectiveSchoolId && f.month === month && f.year === year;
        }).length;
    }, [fees, month, year, effectiveSchoolId, students]);

    useEffect(() => {
        const newMap = new Map<string, { selected: boolean; amount: number }>();
        schoolFeeHeads.forEach((fh: FeeHead) => {
            newMap.set(fh.id, { selected: true, amount: fh.defaultAmount });
        });
        setSelectedFeeHeads(newMap);
    }, [schoolFeeHeads]);
    
    useEffect(() => {
        const monthIndex = months.indexOf(month);
        const m = (monthIndex + 1).toString().padStart(2, '0');
        setDueDate(`${year}-${m}-10`);
    }, [month, year]);

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

    const handlePreview = async () => {
        // FIX: Added explicit type to the filter callback parameter to resolve 'unknown' type error.
        const feeHeadsToGenerate = Array.from(selectedFeeHeads.entries())
            .filter((entry: [string, { selected: boolean, amount: number }]) => entry[1].selected)
            .map(([feeHeadId, { amount }]) => ({
                feeHeadId,
                defaultAmount: amount,
                name: schoolFeeHeads.find(fh => fh.id === feeHeadId)?.name || 'Unknown'
            }));

        if (feeHeadsToGenerate.length === 0) {
            showToast('Info', 'Please select at least one fee head.', 'info');
            return;
        }

        setIsPreparingPreview(true);

        const studentsToProcess = students.filter(s => s.schoolId === effectiveSchoolId && s.status === 'Active');
        const existingChallansForMonth = new Set(fees.filter(f => f.month === month && f.year === year).map(f => f.studentId));
        const studentsWithoutChallan = studentsToProcess.filter(s => !existingChallansForMonth.has(s.id));

        const previewData = studentsWithoutChallan.map(student => {
            const studentFeeStructureMap = new Map((student.feeStructure || []).map(item => [item.feeHeadId, item.amount]));

            const feeItems = feeHeadsToGenerate.map(fh => {
                const amount = studentFeeStructureMap.get(fh.feeHeadId) ?? fh.defaultAmount;
                return { description: fh.name, amount };
            });

            // Calculate correct previous balance (Ledger based)
            const studentFees = fees.filter(f => f.studentId === student.id && f.status !== 'Cancelled');
            const totalFeeCharged = studentFees.reduce((sum, f) => {
                const feeSum = f.feeItems.reduce((acc, item) => acc + item.amount, 0);
                return sum + feeSum;
            }, 0);
            const totalPaidAndDiscount = studentFees.reduce((sum, f) => {
                return sum + (f.paidAmount || 0) + (f.discount || 0);
            }, 0);
            const openingBalance = student.openingBalance || 0;
            
            let previousBalance = (openingBalance + totalFeeCharged) - totalPaidAndDiscount;
            if (previousBalance < 0) previousBalance = 0;

            const subTotal = feeItems.reduce((sum, item) => sum + item.amount, 0);
            const totalAmount = subTotal + previousBalance;
            const className = classMap.get(student.classId) || 'N/A';

            return {
                student: student,
                className,
                feeItems,
                previousBalance,
                totalAmount,
            };
        });

        setChallanPreview(previewData);
        setIsPreviewOpen(true);
        setIsPreparingPreview(false);
    };
    
    const handleConfirmGeneration = async (studentIdsToGenerate: string[]) => {
        if (!effectiveSchoolId) {
            showToast('Error', 'No school context selected.', 'error');
            return;
        }

        const feeHeadsToGenerate = Array.from(selectedFeeHeads.entries())
            .filter(([, { selected }]) => selected)
            .map(([feeHeadId, { amount }]) => ({ feeHeadId, amount }));

        setIsGenerating(true);
        try {
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error("Request timed out. Please check your connection.")), 20000)
            );

            await Promise.race([
                generateChallansForMonth(month, year, feeHeadsToGenerate, studentIdsToGenerate, dueDate),
                timeoutPromise
            ]);
            setIsPreviewOpen(false); // Close modal on success
        } catch (error: any) {
            showToast('Error', error.message || 'Challan generation failed or timed out.', 'error');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleDeleteChallans = async () => {
        setIsDeleting(true);
        try {
            const count = await deleteChallansForMonth(month, year);
            showToast('Success', `Deleted ${count} unpaid challans for ${month} ${year}.`, 'success');
            setIsDeleteModalOpen(false);
        } catch (error: any) {
            showToast('Error', 'Failed to delete challans. ' + error.message, 'error');
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <>
            <ChallanPreviewModal
                isOpen={isPreviewOpen}
                onClose={() => setIsPreviewOpen(false)}
                onConfirm={handleConfirmGeneration}
                previewData={challanPreview}
                isGenerating={isGenerating}
            />
            <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} title="Confirm Deletion">
                <div>
                    <p className="text-secondary-600 dark:text-secondary-300">
                        Are you sure you want to delete <strong>{existingChallansCount}</strong> generated challans for <strong>{month} {year}</strong>?
                    </p>
                    <p className="text-sm text-red-600 dark:text-red-400 mt-2 font-semibold">
                        Warning: Only UNPAID challans will be deleted. Any challan with a recorded payment will be kept safe.
                    </p>
                    <div className="mt-6 flex justify-end space-x-3">
                        <button onClick={() => setIsDeleteModalOpen(false)} className="btn-secondary" disabled={isDeleting}>Cancel</button>
                        <button onClick={handleDeleteChallans} className="btn-danger" disabled={isDeleting}>
                            {isDeleting ? 'Deleting...' : 'Confirm Delete'}
                        </button>
                    </div>
                </div>
            </Modal>

            <div className="p-4 sm:p-6 space-y-6">
                <div>
                    <h2 className="text-xl font-semibold">Generate Monthly Fee Challans</h2>
                    <p className="text-sm text-secondary-500">This will create new challans for all active students who don't already have one for the selected month and year.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label htmlFor="month-select" className="input-label">For Month</label>
                        <select id="month-select" value={month} onChange={e => setMonth(e.target.value)} className="input-field">
                            {months.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="year-select" className="input-label">For Year</label>
                        <select id="year-select" value={year} onChange={e => setYear(Number(e.target.value))} className="input-field">
                            {years.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>
                     <div>
                        <label htmlFor="due-date" className="input-label">Due Date</label>
                        <input type="date" id="due-date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="input-field" />
                    </div>
                </div>

                <div>
                    <h3 className="text-lg font-medium mb-2">Include Fee Heads</h3>
                    <div className="space-y-2 p-2 border dark:border-secondary-700 rounded-lg max-h-60 overflow-y-auto">
                        {schoolFeeHeads.map(fh => {
                            const isTuitionFee = fh.name.toLowerCase() === 'tuition fee';
                            const rowClass = isTuitionFee
                                ? "flex items-center justify-between gap-4 p-2 rounded-md bg-blue-50 dark:bg-blue-900/20"
                                : "flex items-center justify-between gap-4 p-2";

                            return (
                                <div key={fh.id} className={rowClass}>
                                    <label className="flex items-start space-x-3 flex-1 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={selectedFeeHeads.get(fh.id)?.selected || false}
                                            onChange={() => handleFeeHeadToggle(fh.id)}
                                            className="h-4 w-4 rounded border-secondary-300 text-primary-600 focus:ring-primary-500 mt-1"
                                        />
                                        <div>
                                            <span>{fh.name}</span>
                                            {isTuitionFee && (
                                                <p className="text-xs text-blue-600 dark:text-blue-400">
                                                    Amount will be taken from each student's record. This is a fallback amount.
                                                </p>
                                            )}
                                        </div>
                                    </label>
                                    <div className="flex items-center space-x-2">
                                        <span>Rs.</span>
                                        <input
                                            type="number"
                                            value={selectedFeeHeads.get(fh.id)?.amount || 0}
                                            onChange={(e) => handleAmountChange(fh.id, e.target.value)}
                                            className="input-field w-24 text-right"
                                            disabled={!selectedFeeHeads.get(fh.id)?.selected}
                                            title={isTuitionFee ? "Default amount for students without a custom fee structure." : ""}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="flex justify-end pt-4 gap-4">
                    {existingChallansCount > 0 && (
                        <button 
                            onClick={() => setIsDeleteModalOpen(true)} 
                            className="btn-danger w-full sm:w-auto"
                            title="Delete unpaid challans for this month to regenerate"
                        >
                            Delete {month} Challans ({existingChallansCount})
                        </button>
                    )}
                    <button
                        onClick={handlePreview}
                        disabled={isPreparingPreview || isGenerating}
                        className="btn-primary w-full sm:w-auto"
                    >
                        {isPreparingPreview ? 'Preparing Preview...' : 'Preview Generation'}
                    </button>
                </div>
            </div>
        </>
    );
};

export default ChallanGenerationPage;