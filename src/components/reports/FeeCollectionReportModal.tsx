
import React, { useState, useMemo } from 'react';
import Modal from '../common/Modal';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { usePrint } from '../../context/PrintContext';
import { downloadCsvString, escapeCsvCell } from '../../utils/csvHelper';
import { UserRole } from '../../types';
import { formatDate } from '../../constants';
import PrintableReportLayout from './PrintableReportLayout';

interface FeeCollectionReportModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const getTodayString = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = (today.getMonth() + 1).toString().padStart(2, '0');
    const day = today.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
};
const getFirstDayOfMonthString = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = (today.getMonth() + 1).toString().padStart(2, '0');
    return `${year}-${month}-01`;
}

const availableColumns = {
    rollNumber: "Student ID",
    fatherName: "Father's Name",
    className: "Class",
    challanMonth: "Challan Month", // Added to help identify which month the payment belongs to
    amountDue: "Total Payable",
    discount: "Discount",
    balance: "Remaining Balance"
};
type ColumnKey = keyof typeof availableColumns;

const FeeCollectionReportModal: React.FC<FeeCollectionReportModalProps> = ({ isOpen, onClose }) => {
    const { user, activeSchoolId } = useAuth();
    const { fees, students, classes, getSchoolById } = useData();
    const { showPrintPreview } = usePrint();

    const [startDate, setStartDate] = useState(getFirstDayOfMonthString());
    const [endDate, setEndDate] = useState(getTodayString());
    const [sortBy, setSortBy] = useState('rollNumber'); // 'rollNumber', 'className'

    const [selectedColumns, setSelectedColumns] = useState<Record<ColumnKey, boolean>>({
        rollNumber: true,
        fatherName: true,
        className: true,
        challanMonth: true,
        amountDue: false,
        discount: false,
        balance: true,
    });

    const handleColumnToggle = (col: ColumnKey) => {
        setSelectedColumns(prev => ({ ...prev, [col]: !prev[col] }));
    };

    const effectiveSchoolId = user?.role === UserRole.Owner && activeSchoolId ? activeSchoolId : user?.schoolId;
    const school = useMemo(() => getSchoolById(effectiveSchoolId || ''), [getSchoolById, effectiveSchoolId]);
    const studentMap = useMemo(() => new Map(students.map(s => [s.id, s])), [students]);
    const classMap = useMemo(() => new Map(classes.map(c => [c.id, c.name])), [classes]);

    interface Transaction {
        sr: number;
        rollNumber: string;
        studentName: string;
        fatherName: string;
        className: string;
        challanMonth: string;
        amountDue: number;
        discount: number;
        paid: number;
        balance: number;
        date: string;
        challanId: string;
    }

    interface DateGroup {
        date: string;
        transactions: Transaction[];
        subtotals: {
            paid: number;
        };
    }

    const reportData = useMemo(() => {
        const groupedByDate: Record<string, DateGroup> = {};

        // Helper to add a transaction to the grouped object
        const addTransaction = (date: string, fee: any, amount: number) => {
            const student = studentMap.get(fee.studentId);
            if (!student || student.schoolId !== effectiveSchoolId) return;

            if (!groupedByDate[date]) {
                groupedByDate[date] = {
                    date: date,
                    transactions: [],
                    subtotals: { paid: 0 },
                };
            }

            groupedByDate[date].transactions.push({
                sr: 0, 
                rollNumber: student.rollNumber,
                studentName: student.name,
                fatherName: student.fatherName,
                className: classMap.get(student.classId) || 'Unassigned',
                challanMonth: `${fee.month} ${fee.year}`,
                amountDue: Number(fee.totalAmount || 0),
                discount: Number(fee.discount || 0),
                paid: Number(amount),
                balance: Number(fee.totalAmount || 0) - Number(fee.discount || 0) - Number(fee.paidAmount || 0),
                date: date,
                challanId: fee.id
            });

            groupedByDate[date].subtotals.paid += Number(amount);
        };

        // Iterate through all fees to find relevant transactions in paymentHistory
        fees.forEach(fee => {
            const history = fee.paymentHistory || [];
            
            if (history.length > 0) {
                // Check each individual payment in history
                history.forEach(payment => {
                    if (payment.date >= startDate && payment.date <= endDate) {
                        addTransaction(payment.date, fee, payment.amount);
                    }
                });
            } else if (fee.paidAmount > 0 && fee.paidDate) {
                // Fallback for legacy records or simple imports without history
                if (fee.paidDate >= startDate && fee.paidDate <= endDate) {
                    addTransaction(fee.paidDate, fee, fee.paidAmount);
                }
            }
        });
        
        return Object.values(groupedByDate)
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
            .map(dateGroup => {
                let srCounter = 1;
                dateGroup.transactions.sort((a, b) => {
                    if (sortBy === 'className') {
                        const classCompare = a.className.localeCompare(b.className);
                        if (classCompare !== 0) return classCompare;
                        return a.rollNumber.localeCompare(b.rollNumber, undefined, { numeric: true });
                    }
                    return a.rollNumber.localeCompare(b.rollNumber, undefined, { numeric: true });
                });
                dateGroup.transactions.forEach((t) => { t.sr = srCounter++; });
                return dateGroup;
            });

    }, [fees, studentMap, classMap, effectiveSchoolId, startDate, endDate, sortBy]);
    
    const grandTotalPaid = useMemo(() => reportData.reduce((sum, group) => sum + group.subtotals.paid, 0), [reportData]);
    const totalRecords = useMemo(() => reportData.reduce((sum, group) => sum + group.transactions.length, 0), [reportData]);

    const handleGenerate = () => {
        const activeColumns = Object.keys(selectedColumns).filter(k => selectedColumns[k as ColumnKey]) as ColumnKey[];
        
        const subtotalColspan = 2 + 
            (activeColumns.includes('rollNumber') ? 1 : 0) + 
            (activeColumns.includes('fatherName') ? 1 : 0) + 
            (activeColumns.includes('className') ? 1 : 0) + 
            (activeColumns.includes('challanMonth') ? 1 : 0) + 
            (activeColumns.includes('amountDue') ? 1 : 0);

        const content = (
            <PrintableReportLayout
                school={school}
                title="Fee Collection Report"
                subtitle={`From: ${formatDate(startDate)} To: ${formatDate(endDate)}`}
            >
                {reportData.map(dateGroup => (
                    <div key={dateGroup.date} className="class-group-container mb-6">
                        <h3 className="text-lg font-bold bg-secondary-100 p-2 my-2">{formatDate(dateGroup.date)}</h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr>
                                        <th className="py-1 px-1 text-left">Sr.</th>
                                        {activeColumns.includes('rollNumber') && <th className="py-1 px-1 text-left">Student ID</th>}
                                        <th className="py-1 px-1 text-left">Student Name</th>
                                        {activeColumns.includes('fatherName') && <th className="py-1 px-1 text-left">Father Name</th>}
                                        {activeColumns.includes('className') && <th className="py-1 px-1 text-left">Class</th>}
                                        {activeColumns.includes('challanMonth') && <th className="py-1 px-1 text-left">Month</th>}
                                        {activeColumns.includes('amountDue') && <th className="py-1 px-1 text-right">Total Due</th>}
                                        <th className="py-1 px-1 text-right font-bold">Paid Now</th>
                                        {activeColumns.includes('discount') && <th className="py-1 px-1 text-right">Discount</th>}
                                        {activeColumns.includes('balance') && <th className="py-1 px-1 text-right">Balance</th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {dateGroup.transactions.map(t => (
                                        <tr key={`${t.challanId}-${t.sr}`}>
                                            <td className="py-1 px-1">{t.sr}</td>
                                            {activeColumns.includes('rollNumber') && <td className="py-1 px-1">{t.rollNumber}</td>}
                                            <td className="py-1 px-1 font-medium">{t.studentName}</td>
                                            {activeColumns.includes('fatherName') && <td className="py-1 px-1">{t.fatherName}</td>}
                                            {activeColumns.includes('className') && <td className="py-1 px-1">{t.className}</td>}
                                            {activeColumns.includes('challanMonth') && <td className="py-1 px-1">{t.challanMonth}</td>}
                                            {activeColumns.includes('amountDue') && <td className="py-1 px-1 text-right">{t.amountDue.toLocaleString()}</td>}
                                            <td className="py-1 px-1 text-right font-bold">{t.paid.toLocaleString()}</td>
                                            {activeColumns.includes('discount') && <td className="py-1 px-1 text-right">{t.discount.toLocaleString()}</td>}
                                            {activeColumns.includes('balance') && <td className="py-1 px-1 text-right">{t.balance.toLocaleString()}</td>}
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="font-bold bg-secondary-100">
                                        <td colSpan={subtotalColspan} className="py-2 px-1 text-right">Daily Total:</td>
                                        <td className="py-2 px-1 text-right">{dateGroup.subtotals.paid.toLocaleString()}</td>
                                        {activeColumns.includes('discount') && <td className="py-2 px-1"></td>}
                                        {activeColumns.includes('balance') && <td className="py-2 px-1"></td>}
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                ))}
                
                {reportData.length > 0 && (
                     <div className="mt-8 pt-4 border-t-2 border-black">
                        <table className="w-full text-sm">
                            <tbody>
                                <tr className="font-bold text-lg bg-secondary-200">
                                    <td colSpan={subtotalColspan} className="py-2 px-2 text-right">Grand Total Collected:</td>
                                    <td className="py-2 px-2 text-right">Rs. {grandTotalPaid.toLocaleString()}</td>
                                    {activeColumns.includes('discount') && <td className="py-2 px-2"></td>}
                                    {activeColumns.includes('balance') && <td className="py-2 px-2"></td>}
                                </tr>
                            </tbody>
                        </table>
                    </div>
                )}
            </PrintableReportLayout>
        );
        showPrintPreview(content, "EduSync - Fee Collection Report");
    };

    const handleExport = () => {
        const activeHeaders: string[] = ["Sr."];
        if (selectedColumns.rollNumber) activeHeaders.push("Student ID");
        activeHeaders.push("Student Name");
        if (selectedColumns.fatherName) activeHeaders.push("Father's Name");
        if (selectedColumns.className) activeHeaders.push("Class");
        if (selectedColumns.challanMonth) activeHeaders.push("Month");
        if (selectedColumns.amountDue) activeHeaders.push("Total Due");
        activeHeaders.push("Paid Amount");
        if (selectedColumns.discount) activeHeaders.push("Discount");
        if (selectedColumns.balance) activeHeaders.push("Balance");

        const csvRows = [activeHeaders.join(',')];

        reportData.forEach(dateGroup => {
            csvRows.push(escapeCsvCell(`Date: ${formatDate(dateGroup.date)}`));
            dateGroup.transactions.forEach(t => {
                const row: (string | number)[] = [t.sr];
                if (selectedColumns.rollNumber) row.push(t.rollNumber);
                row.push(t.studentName);
                if (selectedColumns.fatherName) row.push(t.fatherName);
                if (selectedColumns.className) row.push(t.className);
                if (selectedColumns.challanMonth) row.push(t.challanMonth);
                if (selectedColumns.amountDue) row.push(t.amountDue);
                row.push(t.paid);
                if (selectedColumns.discount) row.push(t.discount);
                if (selectedColumns.balance) row.push(t.balance);
                csvRows.push(row.map(escapeCsvCell).join(','));
            });

            const subtotalRow = Array(activeHeaders.length).fill('');
            const paidIndex = activeHeaders.indexOf('Paid Amount');
            if (paidIndex > 0) {
                subtotalRow[paidIndex - 1] = 'Daily Total:';
                subtotalRow[paidIndex] = dateGroup.subtotals.paid;
            }
            csvRows.push(subtotalRow.join(','));
            csvRows.push('');
        });
    
        if (reportData.length > 0) {
            csvRows.push('');
            const grandTotalRow = Array(activeHeaders.length).fill('');
            const paidIndex = activeHeaders.indexOf('Paid Amount');
            if (paidIndex > 0) {
                grandTotalRow[paidIndex - 1] = 'Grand Total Collected:';
                grandTotalRow[paidIndex] = grandTotalPaid;
            }
            csvRows.push(grandTotalRow.join(','));
        }

        downloadCsvString(csvRows.join('\n'), 'fee_collection_report');
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Generate Fee Collection Report">
            <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                        <label htmlFor="start-date" className="input-label">Start Date</label>
                        <input type="date" id="start-date" value={startDate} onChange={e => setStartDate(e.target.value)} className="input-field" />
                    </div>
                    <div>
                        <label htmlFor="end-date" className="input-label">End Date</label>
                        <input type="date" id="end-date" value={endDate} onChange={e => setEndDate(e.target.value)} className="input-field" />
                    </div>
                    <div>
                        <label htmlFor="sort-by" className="input-label">Sort By (within each day)</label>
                        <select id="sort-by" value={sortBy} onChange={e => setSortBy(e.target.value)} className="input-field">
                            <option value="rollNumber">Student ID</option>
                            <option value="className">Class</option>
                        </select>
                    </div>
                </div>
                 <div>
                    <label className="input-label">Include Columns</label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 border rounded-md dark:border-secondary-600">
                        {Object.entries(availableColumns).map(([key, label]) => (
                            <label key={key} className="flex items-center space-x-2">
                                <input type="checkbox" checked={selectedColumns[key as ColumnKey]} onChange={() => handleColumnToggle(key as ColumnKey)} className="rounded" />
                                <span className="text-sm">{label}</span>
                            </label>
                        ))}
                    </div>
                </div>
                <div className="p-4 bg-secondary-50 dark:bg-secondary-700 rounded-md text-center">
                    <p className="text-sm">Found <strong className="text-lg">{totalRecords}</strong> transaction records totaling <strong className="text-lg">Rs. {grandTotalPaid.toLocaleString()}</strong> for the selected period.</p>
                </div>
                <div className="flex justify-end space-x-3 pt-2">
                    <button onClick={handleExport} className="btn-secondary" disabled={reportData.length === 0}>Export CSV</button>
                    <button onClick={handleGenerate} className="btn-primary" disabled={reportData.length === 0}>Print Preview</button>
                </div>
            </div>
        </Modal>
    );
};

export default FeeCollectionReportModal;
