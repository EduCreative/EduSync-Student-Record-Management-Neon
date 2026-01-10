
import React, { useState, useMemo } from 'react';
import Modal from '../common/Modal';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { usePrint } from '../../context/PrintContext';
import { downloadCsvString, escapeCsvCell } from '../../utils/csvHelper';
import { UserRole } from '../../types';
import { formatDate } from '../../constants';
import { getClassLevel } from '../../utils/sorting';
import PrintableReportLayout from './PrintableReportLayout';

interface DiscountReportModalProps {
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
};

interface DiscountSummary {
    studentId: string;
    rollNumber: string;
    studentName: string;
    classId: string;
    className: string;
    challanMonth: string;
    date: string;
    amount: number;
}

interface ClassDiscountGroup {
    classId: string;
    className: string;
    discounts: DiscountSummary[];
    subtotal: number;
}

const DiscountReportModal: React.FC<DiscountReportModalProps> = ({ isOpen, onClose }) => {
    const { user, activeSchoolId } = useAuth();
    const { fees, students, classes, getSchoolById } = useData();
    const { showPrintPreview } = usePrint();

    const [startDate, setStartDate] = useState(getFirstDayOfMonthString());
    const [endDate, setEndDate] = useState(getTodayString());
    const [classIdFilter, setClassIdFilter] = useState('all');

    const effectiveSchoolId = user?.role === UserRole.Owner && activeSchoolId ? activeSchoolId : user?.schoolId;
    const school = useMemo(() => getSchoolById(effectiveSchoolId || ''), [getSchoolById, effectiveSchoolId]);
    const schoolClasses = useMemo(() => classes.filter(c => c.schoolId === effectiveSchoolId), [classes, effectiveSchoolId]);
    const sortedClassesList = useMemo(() => [...schoolClasses].sort((a, b) => (a.sortOrder ?? Infinity) - (b.sortOrder ?? Infinity) || getClassLevel(a.name) - getClassLevel(b.name)), [schoolClasses]);
    
    const classMap = useMemo(() => new Map(classes.map(c => [c.id, `${c.name}${c.section ? ` - ${c.section}` : ''}`])), [classes]);
    const studentMap = useMemo(() => new Map(students.map(s => [s.id, s])), [students]);

    const reportData = useMemo(() => {
        const discountList: DiscountSummary[] = [];

        fees.forEach(fee => {
            if (fee.discount > 0) {
                const student = studentMap.get(fee.studentId);
                if (!student || student.schoolId !== effectiveSchoolId) return;
                if (classIdFilter !== 'all' && student.classId !== classIdFilter) return;

                // Determine the "Date" of discount. Usually when the payment was recorded or issue date.
                const effectiveDate = fee.paidDate || fee.dueDate;
                
                if (effectiveDate >= startDate && effectiveDate <= endDate) {
                    discountList.push({
                        studentId: student.id,
                        rollNumber: student.rollNumber,
                        studentName: student.name,
                        classId: student.classId,
                        className: classMap.get(student.classId) || 'N/A',
                        challanMonth: `${fee.month} ${fee.year}`,
                        date: effectiveDate,
                        amount: Number(fee.discount)
                    });
                }
            }
        });

        // Group by Class
        const grouped: Record<string, ClassDiscountGroup> = {};
        discountList.forEach(item => {
            if (!grouped[item.classId]) {
                grouped[item.classId] = {
                    classId: item.classId,
                    className: item.className,
                    discounts: [],
                    subtotal: 0
                };
            }
            grouped[item.classId].discounts.push(item);
            grouped[item.classId].subtotal += item.amount;
        });

        // Sort groups by class level and discounts within groups by date
        return Object.values(grouped)
            .sort((a, b) => getClassLevel(a.className) - getClassLevel(b.className))
            .map(group => {
                group.discounts.sort((a, b) => a.date.localeCompare(b.date));
                return group;
            });
    }, [fees, studentMap, classMap, effectiveSchoolId, startDate, endDate, classIdFilter]);

    const grandTotal = useMemo(() => reportData.reduce((sum, g) => sum + g.subtotal, 0), [reportData]);

    const handleGenerate = () => {
        const content = (
            <PrintableReportLayout
                school={school}
                title="Fee Discount Summary Report"
                subtitle={`From: ${formatDate(startDate)} To: ${formatDate(endDate)} | Class: ${classIdFilter === 'all' ? 'All Classes' : classMap.get(classIdFilter)}`}
            >
                {reportData.map(group => (
                    <div key={group.classId} className="mb-8 class-group-container">
                        <h3 className="text-lg font-bold bg-secondary-100 p-2 mb-2 border-l-4 border-primary-600">{group.className}</h3>
                        <table className="w-full text-sm">
                            <thead>
                                <tr>
                                    <th className="py-1 px-1 text-left w-12">Sr.</th>
                                    <th className="py-1 px-1 text-left w-24">Date</th>
                                    <th className="py-1 px-1 text-left w-32">Student ID</th>
                                    <th className="py-1 px-1 text-left">Student Name</th>
                                    <th className="py-1 px-1 text-left">Challan Month</th>
                                    <th className="py-1 px-1 text-right w-32">Discount Amt</th>
                                </tr>
                            </thead>
                            <tbody>
                                {group.discounts.map((d, i) => (
                                    <tr key={`${d.studentId}-${d.challanMonth}`}>
                                        <td className="py-1 px-1">{i + 1}</td>
                                        <td className="py-1 px-1">{formatDate(d.date)}</td>
                                        <td className="py-1 px-1 font-bold text-primary-700">{d.rollNumber}</td>
                                        <td className="py-1 px-1">{d.studentName}</td>
                                        <td className="py-1 px-1">{d.challanMonth}</td>
                                        <td className="py-1 px-1 text-right">Rs. {d.amount.toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="font-bold bg-secondary-50">
                                    <td colSpan={5} className="py-2 px-1 text-right">Class Subtotal:</td>
                                    <td className="py-2 px-1 text-right">Rs. {group.subtotal.toLocaleString()}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                ))}

                {reportData.length > 0 ? (
                    <div className="mt-8 pt-4 border-t-2 border-black">
                         <div className="flex justify-between items-center bg-secondary-200 p-3 rounded font-bold text-lg">
                            <span>Grand Total Discounts Given:</span>
                            <span>Rs. {grandTotal.toLocaleString()}</span>
                        </div>
                    </div>
                ) : (
                    <div className="py-20 text-center text-secondary-500 italic">
                        No discounts found for the selected period and criteria.
                    </div>
                )}
            </PrintableReportLayout>
        );
        showPrintPreview(content, "EduSync - Discount Report");
    };

    const handleExport = () => {
        const headers = ["Class", "Date", "Student ID", "Student Name", "Challan Month", "Discount Amount"];
        const csvRows = [headers.join(',')];

        reportData.forEach(group => {
            group.discounts.forEach(d => {
                const row = [
                    group.className,
                    d.date,
                    d.rollNumber,
                    d.studentName,
                    d.challanMonth,
                    d.amount
                ];
                csvRows.push(row.map(escapeCsvCell).join(','));
            });
            // Add a subtotal row for each class in CSV too
            const subtotalRow = [group.className, "", "", "", "SUBTOTAL", group.subtotal];
            csvRows.push(subtotalRow.map(escapeCsvCell).join(','));
            csvRows.push(""); // Empty line for readability
        });

        if (reportData.length > 0) {
            const totalRow = ["", "", "", "", "GRAND TOTAL", grandTotal];
            csvRows.push(totalRow.map(escapeCsvCell).join(','));
        }

        downloadCsvString(csvRows.join('\n'), 'fee_discount_report');
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Generate Discount Summary Report">
            <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                        <label htmlFor="start-date-disc" className="input-label">Start Date</label>
                        <input type="date" id="start-date-disc" value={startDate} onChange={e => setStartDate(e.target.value)} className="input-field" />
                    </div>
                    <div>
                        <label htmlFor="end-date-disc" className="input-label">End Date</label>
                        <input type="date" id="end-date-disc" value={endDate} onChange={e => setEndDate(e.target.value)} className="input-field" />
                    </div>
                    <div>
                        <label htmlFor="class-filter-disc" className="input-label">Filter by Class</label>
                        <select id="class-filter-disc" value={classIdFilter} onChange={e => setClassIdFilter(e.target.value)} className="input-field">
                            <option value="all">All Classes</option>
                            {sortedClassesList.map(c => <option key={c.id} value={c.id}>{`${c.name}${c.section ? ` - ${c.section}` : ''}`}</option>)}
                        </select>
                    </div>
                </div>

                <div className="p-4 bg-secondary-50 dark:bg-secondary-700 rounded-md">
                    <p className="text-sm text-center">
                        Found <strong className="text-lg text-primary-600 dark:text-primary-400">{reportData.reduce((sum, g) => sum + g.discounts.length, 0)}</strong> discount entries across <strong className="text-lg text-primary-600 dark:text-primary-400">{reportData.length}</strong> classes totaling <strong className="text-lg text-primary-600 dark:text-primary-400">Rs. {grandTotal.toLocaleString()}</strong>.
                    </p>
                </div>

                <div className="flex justify-end space-x-3 pt-2">
                    <button onClick={handleExport} className="btn-secondary" disabled={reportData.length === 0}>Export CSV</button>
                    <button onClick={handleGenerate} className="btn-primary" disabled={reportData.length === 0}>Print Preview</button>
                </div>
            </div>
        </Modal>
    );
};

export default DiscountReportModal;
