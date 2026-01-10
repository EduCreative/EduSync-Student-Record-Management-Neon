import React, { useState, useEffect, useMemo, useRef } from 'react';
import Modal from '../common/Modal';
import { FeeChallan, Student } from '../../types';
import { useData } from '../../context/DataContext';
import { formatDate, formatMonthDisplay } from '../../constants';

interface FeePaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    challan: FeeChallan;
    student: Student;
    editMode?: boolean;
    defaultDate?: string;
}

const getTodayString = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = (today.getMonth() + 1).toString().padStart(2, '0');
    const day = today.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const TrashIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
);

const FeePaymentModal: React.FC<FeePaymentModalProps> = ({ isOpen, onClose, challan, student, editMode = false, defaultDate }) => {
    const { recordFeePayment, updateFeePayment, fees } = useData();
    
    const [amount, setAmount] = useState(0);
    const [discount, setDiscount] = useState(0);
    const [paidDate, setPaidDate] = useState(getTodayString());
    const [tempHistory, setTempHistory] = useState<any[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    const submissionLock = useRef(false);

    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

    const newerChallanExists = useMemo(() => {
        if (!challan) return false;
        const currentChallanDate = new Date(challan.year, months.indexOf(challan.month));
        return fees.some(f => {
            if (f.studentId !== challan.studentId || f.status === 'Cancelled' || f.id === challan.id) return false;
            const fDate = new Date(f.year, months.indexOf(f.month));
            return fDate > currentChallanDate;
        });
    }, [challan, fees, months]);

    useEffect(() => {
        if (isOpen) {
            submissionLock.current = false;
            setTempHistory([...(challan.paymentHistory || [])]);
            if (editMode) {
                setAmount(challan.paidAmount);
                setDiscount(challan.discount);
                setPaidDate(challan.paidDate || getTodayString());
            } else {
                const balance = challan.totalAmount - challan.discount - challan.paidAmount;
                setAmount(balance);
                setDiscount(challan.discount);
                setPaidDate(defaultDate || getTodayString());
            }
            setError('');
        }
    }, [isOpen, challan, editMode, defaultDate]);

    // Recalculate total amount whenever history changes in Edit mode
    useEffect(() => {
        if (editMode) {
            const historySum = tempHistory.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
            setAmount(historySum);
        }
    }, [tempHistory, editMode]);

    const remainingBalance = editMode
        ? challan.totalAmount - (amount + discount)
        : challan.totalAmount - (challan.paidAmount + amount + discount);

    const handleRemoveHistoryItem = (index: number) => {
        setTempHistory(prev => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (submissionLock.current) return;
        
        setError('');

        if (amount < 0) {
            setError('Amount cannot be negative.');
            return;
        }
        if (discount < 0) {
            setError('Discount cannot be negative.');
            return;
        }
        
        if (remainingBalance < 0) {
            if (!window.confirm(`This payment will result in an overpayment of Rs. ${Math.abs(remainingBalance)}. Do you want to proceed?`)) {
                return;
            }
        }

        setIsSubmitting(true);
        submissionLock.current = true;
        
        try {
            // Increased timeout to 40s to allow for background completion on slow networks
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error("Request timed out. The server may still be processing your payment. Please wait a moment and refresh your view.")), 40000)
            );

            if (editMode) {
                await Promise.race([
                    updateFeePayment(challan.id, amount, discount, paidDate, tempHistory),
                    timeoutPromise
                ]);
            } else {
                await Promise.race([
                    recordFeePayment(challan.id, amount, discount, paidDate),
                    timeoutPromise
                ]);
            }
            onClose();
        } catch (error: any) {
            console.error("Failed to process payment:", error);
            setError(error.message || 'An error occurred while processing payment.');
            submissionLock.current = false;
        } finally {
            setIsSubmitting(false);
        }
    };

    const balanceDue = challan.totalAmount - challan.discount - challan.paidAmount;

    return (
        <Modal isOpen={isOpen} onClose={isSubmitting ? () => {} : onClose} title={editMode ? `Edit Payment for ${student.name}`: `Record Payment for ${student.name}`}>
            <div className="space-y-4">
                {newerChallanExists && !editMode && (
                    <div className="p-3 bg-yellow-50 border-l-4 border-yellow-400 text-yellow-800 rounded-r-md text-sm mb-4">
                        <p className="font-bold">Warning: Newer Challan Exists</p>
                        <p>A newer fee challan has already been generated for this student. Use the latest challan to clear previous dues.</p>
                    </div>
                )}

                <div className="p-3 bg-secondary-50 dark:bg-secondary-700/50 rounded-lg text-sm">
                     <div className="grid grid-cols-2 gap-2 mb-2">
                        <p><strong>Student ID:</strong> <span className="text-lg font-bold text-primary-700 dark:text-primary-400">{student.rollNumber}</span></p>
                        <p><strong>Challan:</strong> {formatMonthDisplay(challan.month, challan.year)}</p>
                    </div>
                    
                    <div className="border-t dark:border-secondary-600 pt-2 mt-2 flex justify-between items-center text-base">
                        <strong>Total Amount:</strong> 
                        <strong>Rs. {challan.totalAmount.toLocaleString()}</strong>
                    </div>
                    
                    {!editMode && (
                        <div className="flex justify-between items-center mt-2 text-base font-bold text-primary-600 dark:text-primary-400">
                            <span>Current Balance Due:</span>
                            <span>Rs. {balanceDue.toLocaleString()}</span>
                        </div>
                    )}
                </div>
                
                {/* Payment History Section */}
                {tempHistory.length > 0 && (
                    <div className="p-3 border rounded-lg dark:border-secondary-700">
                        <h4 className="text-xs font-semibold text-secondary-700 dark:text-secondary-300 mb-2 uppercase flex justify-between">
                            <span>Payment History</span>
                            {editMode && <span className="text-[10px] text-red-500 font-normal">Delete duplicates to fix reports</span>}
                        </h4>
                        <table className="w-full text-xs text-left">
                            <thead className="bg-secondary-100 dark:bg-secondary-800">
                                <tr>
                                    <th className="p-1">Date</th>
                                    <th className="p-1 text-right">Amount</th>
                                    {editMode && <th className="p-1 w-8"></th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y dark:divide-secondary-700">
                                {tempHistory.map((record, index) => (
                                    <tr key={index} className={editMode ? 'hover:bg-red-50 dark:hover:bg-red-900/10' : ''}>
                                        <td className="p-1">{formatDate(record.date)}</td>
                                        <td className="p-1 text-right">Rs. {record.amount.toLocaleString()}</td>
                                        {editMode && (
                                            <td className="p-1 text-center">
                                                <button 
                                                    type="button"
                                                    disabled={isSubmitting}
                                                    onClick={() => handleRemoveHistoryItem(index)}
                                                    className="text-red-500 hover:text-red-700 p-1 disabled:opacity-50"
                                                    title="Remove this entry"
                                                >
                                                    <TrashIcon className="w-3.5 h-3.5" />
                                                </button>
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                
                {error && (
                    <div className="p-3 bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200 rounded-md text-sm border-l-4 border-red-500">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="amount" className="input-label">{editMode ? 'Recalculated Total Paid' : 'Amount Paying Now'}</label>
                        <input
                            type="number"
                            id="amount"
                            value={amount}
                            onChange={e => !editMode && setAmount(Number(e.target.value))}
                            className={`input-field ${editMode ? 'bg-secondary-100 font-bold' : ''}`}
                            required
                            min="0"
                            disabled={isSubmitting || editMode}
                        />
                        {editMode && <p className="text-[10px] text-primary-600 mt-1">This value is automatically calculated based on the history items above.</p>}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="discount" className="input-label">Discount</label>
                            <input
                                type="number"
                                id="discount"
                                value={discount}
                                onChange={e => setDiscount(Number(e.target.value))}
                                className="input-field"
                                min="0"
                                disabled={isSubmitting}
                            />
                        </div>
                        <div>
                            <label htmlFor="paidDate" className="input-label">Last Payment Date</label>
                            <input
                                type="date"
                                id="paidDate"
                                value={paidDate}
                                onChange={e => setPaidDate(e.target.value)}
                                className="input-field"
                                required
                                disabled={isSubmitting}
                            />
                        </div>
                    </div>

                    <div className="p-3 bg-blue-50 dark:bg-blue-900/50 rounded-lg text-center font-medium text-sm">
                        Net Balance: 
                        <span className={`ml-2 ${remainingBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                            Rs. {remainingBalance.toLocaleString()}
                        </span>
                    </div>

                    <div className="flex justify-end space-x-3 pt-2">
                        <button type="button" onClick={onClose} className="btn-secondary" disabled={isSubmitting}>Cancel</button>
                        <button type="submit" disabled={isSubmitting} className="btn-primary flex items-center gap-2 min-w-[140px] justify-center">
                            {isSubmitting ? (
                                <>
                                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                    Recording...
                                </>
                            ) : (editMode ? 'Update Record' : 'Record Payment')}
                        </button>
                    </div>
                </form>
            </div>
        </Modal>
    );
};

export default FeePaymentModal;