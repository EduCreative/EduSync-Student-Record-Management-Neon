
import React, { useState, useMemo } from 'react';
import Modal from '../common/Modal';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { usePrint } from '../../context/PrintContext';
import { downloadCsvString, escapeCsvCell } from '../../utils/csvHelper';
import { UserRole, Class } from '../../types';
import { getClassLevel } from '../../utils/sorting';
import PrintableReportLayout from './PrintableReportLayout';

interface DefaulterReportModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const months = [ "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December" ];
const currentYear = new Date().getFullYear();
const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

const availableColumns = {
    fatherName: "Father's Name",
    arrears: "Arrears",
    currentDues: "Month Fees",
    amountDue: "Total Bill",
    paid: "Paid",
};
type ColumnKey = keyof typeof availableColumns;

interface StudentDefaulterSummary {
    studentId: string;
    rollNumber: string;
    studentName: string;
    fatherName: string;
    classId: string;
    className: string;
    arrears: number;
    currentDues: number;
    amountDue: number; // Total Payable for the specific period/type
    paid: number;
    balance: number;
}

interface ClassDefaulterGroup {
    classId: string;
    className: string;
    students: StudentDefaulterSummary[];
    subtotals: {
        arrears: number;
        currentDues: number;
        amountDue: number;
        paid: number;
        balance: number;
    };
}

const DefaulterReportModal: React.FC<DefaulterReportModalProps> = ({ isOpen, onClose }) => {
    const { user, activeSchoolId } = useAuth();
    const { fees, students, classes, getSchoolById } = useData();
    const { showPrintPreview } = usePrint();

    const [classId, setClassId] = useState('all');
    const [sortBy, setSortBy] = useState('rollNumber'); 
    
    const [reportType, setReportType] = useState<'cumulative' | 'monthly'>('cumulative');
    const [month, setMonth] = useState(months[new Date().getMonth()]);
    const [year, setYear] = useState(currentYear);

    const [selectedColumns, setSelectedColumns] = useState<Record<ColumnKey, boolean>>({
        fatherName: true,
        arrears: true,
        currentDues: true,
        amountDue: true,
        paid: true,
    });

    const handleColumnToggle = (col: ColumnKey) => {
        setSelectedColumns(prev => ({ ...prev, [col]: !prev[col] }));
    };

    const effectiveSchoolId = user?.role === UserRole.Owner && activeSchoolId ? activeSchoolId : user?.schoolId;
    const school = useMemo(() => getSchoolById(effectiveSchoolId || ''), [getSchoolById, effectiveSchoolId]);
    const classMap = useMemo(() => new Map(classes.map(c => [c.id, `${c.name}${c.section ? ` - ${c.section}` : ''}`])), [classes]);

    const schoolClasses = useMemo(() => classes.filter(c => c.schoolId === effectiveSchoolId), [classes, effectiveSchoolId]);
    const sortedClasses = useMemo(() => [...schoolClasses].sort((a, b) => (a.sortOrder ?? Infinity) - (b.sortOrder ?? Infinity) || getClassLevel(a.name) - getClassLevel(b.name)), [schoolClasses]);

    const reportData = useMemo(() => {
        const relevantStudents = students.filter(s => 
            s.schoolId === effectiveSchoolId && 
            s.status === 'Active' &&
            (classId === 'all' || s.classId === classId)
        );

        const studentSummaries: StudentDefaulterSummary[] = [];

        if (reportType === 'cumulative') {
            relevantStudents.forEach(student => {
                const studentFees = fees.filter(f => f.studentId === student.id && f.status !== 'Cancelled');
                
                const totalFeeCharged = studentFees.reduce((sum, f) => {
                    const currentMonthFee = Number(f.totalAmount) - (Number(f.previousBalance) || 0);
                    return sum + currentMonthFee;
                }, 0) + (Number(student.openingBalance) || 0);

                const totalPaid = studentFees.reduce((sum, f) => sum + Number(f.paidAmount || 0), 0);
                const totalDiscount = studentFees.reduce((sum, f) => sum + Number(f.discount || 0), 0);
                
                const netBalance = totalFeeCharged - totalPaid - totalDiscount;

                if (netBalance > 0.01) {
                    studentSummaries.push({
                        studentId: student.id,
                        rollNumber: student.rollNumber,
                        studentName: student.name,
                        fatherName: student.fatherName,
                        classId: student.classId,
                        className: classMap.get(student.classId) || 'N/A',
                        arrears: 0, // Not applicable for cumulative view
                        currentDues: 0, // Not applicable for cumulative view
                        amountDue: totalFeeCharged - totalDiscount, 
                        paid: totalPaid,
                        balance: netBalance,
                    });
                }
            });
        } else {
            // --- UPDATED SPECIFIC MONTH LOGIC ---
            // Now shows data as of that month's challan (Arrears + Month Fees)
            relevantStudents.forEach(student => {
                const challan = fees.find(f => 
                    f.studentId === student.id && 
                    f.month === month && 
                    f.year === year && 
                    f.status !== 'Cancelled'
                );

                if (challan && challan.status !== 'Paid') {
                    const arrears = Number(challan.previousBalance || 0);
                    const currentDues = Number(challan.totalAmount) - arrears;
                    const discount = Number(challan.discount || 0);
                    const netPayable = Number(challan.totalAmount) - discount;
                    const paid = Number(challan.paidAmount || 0);
                    const balance = netPayable - paid;

                    if (balance > 0.01) {
                        studentSummaries.push({
                            studentId: student.id,
                            rollNumber: student.rollNumber,
                            studentName: student.name,
                            fatherName: student.fatherName,
                            classId: student.classId,
                            className: classMap.get(student.classId) || 'N/A',
                            arrears: arrears,
                            currentDues: currentDues,
                            amountDue: netPayable, 
                            paid: paid,
                            balance: balance,
                        });
                    }
                }
            });
        }

        const groupedByClass = studentSummaries.reduce((acc, summary) => {
            const cid = summary.classId;
            if (!acc[cid]) {
                acc[cid] = {
                    classId: cid,
                    className: summary.className,
                    students: [],
                    subtotals: { arrears: 0, currentDues: 0, amountDue: 0, paid: 0, balance: 0 },
                };
            }
            acc[cid].students.push(summary);
            acc[cid].subtotals.arrears += Number(summary.arrears);
            acc[cid].subtotals.currentDues += Number(summary.currentDues);
            acc[cid].subtotals.amountDue += Number(summary.amountDue);
            acc[cid].subtotals.paid += Number(summary.paid);
            acc[cid].subtotals.balance += Number(summary.balance);
            return acc;
        }, {} as Record<string, ClassDefaulterGroup>);

        const schoolClassesMapForSort = new Map<string, Class>(schoolClasses.map(c => [c.id, c]));

        return Object.values(groupedByClass)
            .sort((a, b) => {
                const classA = schoolClassesMapForSort.get(a.classId);
                const classB = schoolClassesMapForSort.get(b.classId);
                if (!classA || !classB) return a.className.localeCompare(b.className);
                return (classA.sortOrder ?? Infinity) - (classB.sortOrder ?? Infinity) || getClassLevel(a.className) - getClassLevel(b.className);
            })
            .map(classGroup => {
                classGroup.students.sort((a, b) => {
                    if (sortBy === 'rollNumber') {
                        return a.rollNumber.localeCompare(b.rollNumber, undefined, { numeric: true });
                    }
                    if (sortBy === 'balance') {
                        return b.balance - a.balance;
                    }
                    return a.studentName.localeCompare(b.studentName);
                });
                return classGroup;
            });
    }, [fees, students, classMap, effectiveSchoolId, classId, schoolClasses, sortBy, reportType, month, year]);
    
    const grandTotal = useMemo(() => {
        return reportData.reduce((acc, classGroup) => {
            acc.arrears += Number(classGroup.subtotals.arrears);
            acc.currentDues += Number(classGroup.subtotals.currentDues);
            acc.amountDue += Number(classGroup.subtotals.amountDue);
            acc.paid += Number(classGroup.subtotals.paid);
            acc.balance += Number(classGroup.subtotals.balance);
            return acc;
        }, { arrears: 0, currentDues: 0, amountDue: 0, paid: 0, balance: 0 });
    }, [reportData]);


    const handleGenerate = () => {
        const activeColumns = Object.keys(selectedColumns).filter(k => selectedColumns[k as ColumnKey]) as ColumnKey[];
        const subtotalColspan = 3 + (activeColumns.includes('fatherName') ? 1 : 0);
        
        const subtitle = reportType === 'cumulative' 
            ? `Cumulative Defaulters (All Time) - Class: ${classId === 'all' ? 'All Classes' : classMap.get(classId) || ''}`
            : `Monthly Defaulters Summary (Incl. Arrears) for ${month} ${year} - Class: ${classId === 'all' ? 'All Classes' : classMap.get(classId) || ''}`;

        const content = (
            <PrintableReportLayout
                school={school}
                title="Fee Defaulter Report"
                subtitle={subtitle}
            >
                {reportData.map((classGroup) => (
                    <div key={classGroup.classId} className="class-group-container mb-6">
                        <h3 className="text-lg font-bold bg-secondary-100 p-2 my-2">{classGroup.className}</h3>
                        <table className="w-full text-sm">
                            <thead>
                                <tr>
                                    <th className="py-1 px-1 text-left">Sr.</th>
                                    <th className="py-1 px-1 text-left">Student ID</th>
                                    <th className="py-1 px-1 text-left">Student Name</th>
                                    {activeColumns.includes('fatherName') && <th className="py-1 px-1 text-left">Father Name</th>}
                                    {reportType === 'monthly' && activeColumns.includes('arrears') && <th className="py-1 px-1 text-right">Arrears</th>}
                                    {reportType === 'monthly' && activeColumns.includes('currentDues') && <th className="py-1 px-1 text-right">Month Fee</th>}
                                    {activeColumns.includes('amountDue') && <th className="py-1 px-1 text-right">Total Payable</th>}
                                    {activeColumns.includes('paid') && <th className="py-1 px-1 text-right">Total Paid</th>}
                                    <th className="py-1 px-1 text-right">Balance</th>
                                </tr>
                            </thead>
                            <tbody>
                                {classGroup.students.map((student, index) => (
                                    <tr key={student.studentId}>
                                        <td className="py-1 px-1">{index + 1}</td>
                                        <td className="py-1 px-1">{student.rollNumber}</td>
                                        <td className="py-1 px-1">{student.studentName}</td>
                                        {activeColumns.includes('fatherName') && <td className="py-1 px-1">{student.fatherName}</td>}
                                        {reportType === 'monthly' && activeColumns.includes('arrears') && <td className="py-1 px-1 text-right">{student.arrears.toLocaleString()}</td>}
                                        {reportType === 'monthly' && activeColumns.includes('currentDues') && <td className="py-1 px-1 text-right">{student.currentDues.toLocaleString()}</td>}
                                        {activeColumns.includes('amountDue') && <td className="py-1 px-1 text-right">{student.amountDue.toLocaleString()}</td>}
                                        {activeColumns.includes('paid') && <td className="py-1 px-1 text-right">{student.paid.toLocaleString()}</td>}
                                        <td className="py-1 px-1 text-right font-bold">{student.balance.toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="font-bold bg-secondary-100">
                                    <td colSpan={subtotalColspan} className="py-2 px-1 text-right">Sub Total:</td>
                                    {reportType === 'monthly' && activeColumns.includes('arrears') && <td className="py-2 px-1 text-right">{classGroup.subtotals.arrears.toLocaleString()}</td>}
                                    {reportType === 'monthly' && activeColumns.includes('currentDues') && <td className="py-2 px-1 text-right">{classGroup.subtotals.currentDues.toLocaleString()}</td>}
                                    {activeColumns.includes('amountDue') && <td className="py-2 px-1 text-right">{classGroup.subtotals.amountDue.toLocaleString()}</td>}
                                    {activeColumns.includes('paid') && <td className="py-2 px-1 text-right">{classGroup.subtotals.paid.toLocaleString()}</td>}
                                    <td className="py-2 px-1 text-right">{classGroup.subtotals.balance.toLocaleString()}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                ))}

                {reportData.length > 0 && (
                    <div className="mt-8 pt-4 border-t-2 border-black">
                        <table className="w-full text-sm">
                            <tbody>
                                <tr className="font-bold text-lg bg-secondary-200">
                                    <td colSpan={subtotalColspan} className="py-2 px-2 text-right">Grand Total:</td>
                                    {reportType === 'monthly' && activeColumns.includes('arrears') && <td className="py-2 px-2 text-right">Rs. {grandTotal.arrears.toLocaleString()}</td>}
                                    {reportType === 'monthly' && activeColumns.includes('currentDues') && <td className="py-2 px-2 text-right">Rs. {grandTotal.currentDues.toLocaleString()}</td>}
                                    {activeColumns.includes('amountDue') && <td className="py-2 px-2 text-right">Rs. {grandTotal.amountDue.toLocaleString()}</td>}
                                    {activeColumns.includes('paid') && <td className="py-2 px-2 text-right">Rs. {grandTotal.paid.toLocaleString()}</td>}
                                    <td className="py-2 px-2 text-right">Rs. {grandTotal.balance.toLocaleString()}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                )}
            </PrintableReportLayout>
        );
        showPrintPreview(content, "EduSync - Fee Defaulter Report");
    };

    const handleExport = () => {
        const headers: string[] = ['Sr.', 'Student ID', 'Student Name'];
        if (selectedColumns.fatherName) headers.push("Father's Name");
        if (reportType === 'monthly' && selectedColumns.arrears) headers.push("Arrears");
        if (reportType === 'monthly' && selectedColumns.currentDues) headers.push("Month Fees");
        if (selectedColumns.amountDue) headers.push("Total Payable");
        if (selectedColumns.paid) headers.push("Total Paid");
        headers.push('Balance');

        const csvRows = [headers.join(',')];
    
        reportData.forEach(classGroup => {
            csvRows.push(escapeCsvCell(`Class: ${classGroup.className}`));
            classGroup.students.forEach((student, index) => {
                const row: (string | number)[] = [index + 1, student.rollNumber, student.studentName];
                if (selectedColumns.fatherName) row.push(student.fatherName);
                if (reportType === 'monthly' && selectedColumns.arrears) row.push(student.arrears);
                if (reportType === 'monthly' && selectedColumns.currentDues) row.push(student.currentDues);
                if (selectedColumns.amountDue) row.push(student.amountDue);
                if (selectedColumns.paid) row.push(student.paid);
                row.push(student.balance);
                csvRows.push(row.map(escapeCsvCell).join(','));
            });
            const subtotalRow = Array(headers.length).fill('');
            const studentNameIndex = headers.indexOf('Student Name');
            if(studentNameIndex !== -1) {
                subtotalRow[studentNameIndex] = 'Sub Total';
            }
    
            if (headers.includes("Arrears")) subtotalRow[headers.indexOf("Arrears")] = classGroup.subtotals.arrears;
            if (headers.includes("Month Fees")) subtotalRow[headers.indexOf("Month Fees")] = classGroup.subtotals.currentDues;
            if (headers.includes("Total Payable")) subtotalRow[headers.indexOf("Total Payable")] = classGroup.subtotals.amountDue;
            if (headers.includes("Total Paid")) subtotalRow[headers.indexOf("Total Paid")] = classGroup.subtotals.paid;
            if (headers.includes('Balance')) subtotalRow[headers.indexOf('Balance')] = classGroup.subtotals.balance;
            csvRows.push(subtotalRow.map(escapeCsvCell).join(','));
            csvRows.push('');
        });
    
        if (reportData.length > 0) {
            csvRows.push('');
            const grandTotalRow = Array(headers.length).fill('');
            const studentNameIndex = headers.indexOf('Student Name');
            if(studentNameIndex !== -1) {
                grandTotalRow[studentNameIndex] = 'Grand Total';
            }

            if (headers.includes("Arrears")) grandTotalRow[headers.indexOf("Arrears")] = grandTotal.arrears;
            if (headers.includes("Month Fees")) grandTotalRow[headers.indexOf("Month Fees")] = grandTotal.currentDues;
            if (headers.includes("Total Payable")) grandTotalRow[headers.indexOf("Total Payable")] = grandTotal.amountDue;
            if (headers.includes("Total Paid")) grandTotalRow[headers.indexOf("Total Paid")] = grandTotal.paid;
            if (headers.includes('Balance')) grandTotalRow[headers.indexOf('Balance')] = grandTotal.balance;
            csvRows.push(grandTotalRow.map(escapeCsvCell).join(','));
        }
    
        downloadCsvString(csvRows.join('\n'), 'defaulter_report');
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Generate Fee Defaulter Report">
            <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="class-filter" className="input-label">Filter by Class</label>
                        <select id="class-filter" value={classId} onChange={e => setClassId(e.target.value)} className="input-field">
                            <option value="all">All Classes</option>
                            {sortedClasses.map(c => <option key={c.id} value={c.id}>{`${c.name}${c.section ? ` - ${c.section}` : ''}`}</option>)}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="sort-by-defaulter" className="input-label">Sort By</label>
                        <select id="sort-by-defaulter" value={sortBy} onChange={e => setSortBy(e.target.value)} className="input-field">
                            <option value="rollNumber">Student ID</option>
                            <option value="studentName">Student Name</option>
                            <option value="balance">Balance Amount</option>
                        </select>
                    </div>
                </div>

                <div className="border-t dark:border-secondary-700 pt-3">
                    <label className="input-label mb-2">Report Type</label>
                    <div className="flex flex-wrap gap-4 items-center mb-3">
                        <label className="flex items-center space-x-2 cursor-pointer">
                            <input 
                                type="radio" 
                                name="reportType" 
                                value="cumulative" 
                                checked={reportType === 'cumulative'} 
                                onChange={() => setReportType('cumulative')}
                                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-secondary-300" 
                            />
                            <span className="text-sm">Cumulative (All Time)</span>
                        </label>
                        <label className="flex items-center space-x-2 cursor-pointer">
                            <input 
                                type="radio" 
                                name="reportType" 
                                value="monthly" 
                                checked={reportType === 'monthly'} 
                                onChange={() => setReportType('monthly')}
                                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-secondary-300" 
                            />
                            <span className="text-sm">Specific Month Dues (Incl. Arrears)</span>
                        </label>
                    </div>

                    {reportType === 'monthly' && (
                        <div className="grid grid-cols-2 gap-4 bg-secondary-50 dark:bg-secondary-900/50 p-3 rounded-md">
                            <div>
                                <label className="input-label text-xs">Month</label>
                                <select value={month} onChange={e => setMonth(e.target.value)} className="input-field py-1 text-sm">
                                    {months.map(m => <option key={m} value={m}>{m}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="input-label text-xs">Year</label>
                                <select value={year} onChange={e => setYear(Number(e.target.value))} className="input-field py-1 text-sm">
                                    {years.map(y => <option key={y} value={y}>{y}</option>)}
                                </select>
                            </div>
                        </div>
                    )}
                </div>

                 <div>
                    <label className="input-label">Include Columns</label>
                    <div className="grid grid-cols-2 gap-2 p-3 border rounded-md dark:border-secondary-600">
                        {Object.entries(availableColumns).map(([key, label]) => (
                            <label key={key} className="flex items-center space-x-2">
                                <input 
                                    type="checkbox" 
                                    checked={selectedColumns[key as ColumnKey]} 
                                    onChange={() => handleColumnToggle(key as ColumnKey)} 
                                    className="rounded" 
                                    disabled={reportType === 'cumulative' && (key === 'arrears' || key === 'currentDues')}
                                />
                                <span className={`text-sm ${reportType === 'cumulative' && (key === 'arrears' || key === 'currentDues') ? 'opacity-50' : ''}`}>{label}</span>
                            </label>
                        ))}
                    </div>
                </div>
                <div className="p-4 bg-secondary-50 dark:bg-secondary-700 rounded-md text-center">
                    <p className="text-sm">Found <strong className="text-lg">{reportData.reduce((sum, g) => sum + g.students.length, 0)}</strong> defaulter records for the selected criteria.</p>
                </div>
                <div className="flex justify-end space-x-3 pt-2">
                    <button onClick={handleExport} className="btn-secondary" disabled={reportData.length === 0}>Export CSV</button>
                    <button onClick={handleGenerate} className="btn-primary" disabled={reportData.length === 0}>Print Preview</button>
                </div>
            </div>
        </Modal>
    );
};

export default DefaulterReportModal;
