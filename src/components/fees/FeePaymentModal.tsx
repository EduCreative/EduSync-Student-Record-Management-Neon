
import React, { useState, useEffect, useMemo } from 'react';
import Modal from '../common/Modal';
import { FeeChallan, Student } from '../../types';
import { useData } from '../../context/DataContext';
import { formatDate } from '../../constants';

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

const FeePaymentModal: React.FC<FeePaymentModalProps> = ({ isOpen, onClose, challan, student, editMode = false, defaultDate }) => {
    const { recordFeePayment, updateFeePayment, fees } = useData();
    
    const [amount, setAmount] = useState(0);
    const [discount, setDiscount] = useState(0);
    const [paidDate, setPaidDate] = useState(getTodayString());
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

    // Check if there is a newer challan for this student
    const newerChallanExists = useMemo(() => {
        if (!challan) return false;
        
        const currentChallanDate = new Date(challan.year, months.indexOf(challan.month));
        
        return fees.some(f => {
            if (f.studentId !== challan.studentId || f.status === 'Cancelled' || f.id === challan.id) return false;
            const fDate = new Date(f.year, months.indexOf(f.month));
            return fDate > currentChallanDate;
        });
    }, [challan, fees]);

    useEffect(() => {
        if (isOpen) {
            if (editMode) {
                // In edit mode (correcting data), start with the total currently recorded
                setAmount(challan.paidAmount);
                setDiscount(challan.discount);
                setPaidDate(challan.paidDate || getTodayString());
            } else {
                // In payment mode, start with 0 to let user enter "Paying Now" amount, 
                // or default to balance for quick full payment.
                const balance = challan.totalAmount - challan.discount - challan.paidAmount;
                setAmount(balance);
                setDiscount(challan.discount);
                setPaidDate(defaultDate || getTodayString());
            }
            setError('');
        }
    }, [isOpen, challan, editMode, defaultDate]);

    const remainingBalance = editMode
        ? challan.totalAmount - (amount + discount)
        : challan.totalAmount - (challan.paidAmount + amount + discount);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        // Client-side validation
        if (amount < 0) {
            setError('Amount cannot be negative.');
            return;
        }
        if (discount < 0) {
            setError('Discount cannot be negative.');
            return;
        }
        if (isNaN(amount) || isNaN(discount)) {
             setError('Please enter valid numbers.');
             return;
        }
        
        if (remainingBalance < 0) {
            if (!window.confirm(`This payment will result in an overpayment of Rs. ${Math.abs(remainingBalance)}. Do you want to proceed?`)) {
                return;
            }
        }

        setIsSubmitting(true);
        
        try {
            // Create a timeout promise to reject after 15 seconds
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error("Request timed out. Please check your connection.")), 15000)
            );

            // Execute the payment operation or timeout
            if (editMode) {
                await Promise.race([
                    updateFeePayment(challan.id, amount, discount, paidDate),
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
                        <p>A newer fee challan has already been generated for this student. It is recommended to record payment on the <strong>latest challan</strong> to automatically clear previous dues and keep the ledger accurate.</p>
                    </div>
                )}

                <div className="p-3 bg-secondary-50 dark:bg-secondary-700/50 rounded-lg text-sm">
                     <div className="grid grid-cols-2 gap-2 mb-2">
                        <p><strong>Student ID:</strong> <span className="text-lg font-bold text-primary-700 dark:text-primary-400">{student.rollNumber}</span></p>
                        <p><strong>Father Name:</strong> {student.fatherName}</p>
                        <p><strong>Challan Month:</strong> {challan.month} {challan.year}</p>
                        <p><strong>Due Date:</strong> <span className={new Date(challan.dueDate) < new Date() && (challan.status !== 'Paid') ? 'text-red-600' : ''}>{formatDate(challan.dueDate)}</span></p>
                    </div>
                    
                    <div className="border-t dark:border-secondary-600 pt-2 mt-2">
                         <p className="font-semibold mb-1">Fee Breakdown:</p>
                         <ul className="space-y-1 text-xs text-secondary-600 dark:text-secondary-300">
                            {challan.feeItems.map((item, idx) => (
                                <li key={idx} className="flex justify-between">
                                    <span>{item.description}</span>
                                    <span>Rs. {item.amount.toLocaleString()}</span>
                                </li>
                            ))}
                             {challan.previousBalance > 0 && (
                                <li className="flex justify-between font-medium text-red-600 dark:text-red-400">
                                    <span>Arrears (Previous Balance)</span>
                                    <span>Rs. {challan.previousBalance.toLocaleString()}</span>
                                </li>
                            )}
                         </ul>
                    </div>

                    <div className="border-t dark:border-secondary-600 pt-2 mt-2 flex justify-between items-center text-base">
                        <strong>Total Amount:</strong> 
                        <strong>Rs. {challan.totalAmount.toLocaleString()}</strong>
                    </div>
                    
                    {editMode ? (
                         <div className="flex justify-between items-center mt-2">
                            <strong>Currently Paid:</strong> 
                            <span>Rs. {challan.paidAmount.toLocaleString()}</span>
                         </div>
                    ) : (
                        <>
                            <div className="flex justify-between items-center mt-1 text-xs">
                                <span>Total Paid So Far:</span>
                                <span>Rs. {challan.paidAmount.toLocaleString()}</span>
                            </div>
                             <div className="flex justify-between items-center mt-2 text-base font-bold text-primary-600 dark:text-primary-400">
                                <span>Current Balance Due:</span>
                                <span>Rs. {balanceDue.toLocaleString()}</span>
                            </div>
                        </>
                    )}
                </div>
                
                {/* Payment History Section */}
                {!editMode && challan.paymentHistory && challan.paymentHistory.length > 0 && (
                    <div className="p-3 border rounded-lg dark:border-secondary-700">
                        <h4 className="text-xs font-semibold text-secondary-700 dark:text-secondary-300 mb-2 uppercase">Payment History</h4>
                        <table className="w-full text-xs text-left">
                            <thead className="bg-secondary-100 dark:bg-secondary-800">
                                <tr>
                                    <th className="p-1">Date</th>
                                    <th className="p-1 text-right">Amount</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y dark:divide-secondary-700">
                                {challan.paymentHistory.map((record, index) => (
                                    <tr key={index}>
                                        <td className="p-1">{formatDate(record.date)}</td>
                                        <td className="p-1 text-right">Rs. {record.amount.toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                
                {error && (
                    <div className="p-3 bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200 rounded-md text-sm">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="amount" className="input-label">{editMode ? 'Update Total Paid Amount' : 'Amount Paying Now'}</label>
                        <input
                            type="number"
                            id="amount"
                            value={amount}
                            onChange={e => setAmount(Number(e.target.value))}
                            className="input-field"
                            required
                            min="0"
                            disabled={isSubmitting}
                        />
                        {editMode && <p className="text-xs text-secondary-500 mt-1">Note: Editing overwrites the total paid amount.</p>}
                    </div>
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
                        <label htmlFor="paidDate" className="input-label">Payment Date</label>
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

                    <div className="p-3 bg-blue-50 dark:bg-blue-900/50 rounded-lg text-center font-medium text-sm">
                        Remaining Balance After this Payment: 
                        <span className={`ml-2 ${remainingBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                            Rs. {remainingBalance.toLocaleString()}
                        </span>
                    </div>

                    <div className="flex justify-end space-x-3 pt-2">
                        <button type="button" onClick={onClose} className="btn-secondary" disabled={isSubmitting}>Cancel</button>
                        <button type="submit" disabled={isSubmitting} className="btn-primary flex items-center gap-2">
                            {isSubmitting && <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
                            {isSubmitting ? 'Saving...' : (editMode ? 'Update Payment' : 'Record Payment')}
                        </button>
                    </div>
                </form>
            </div>
        </Modal>
    );
};

export default FeePaymentModal;
