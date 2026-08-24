import React, { FC } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { GraduationCap } from 'lucide-react';
import { FeeChallan, Student, School } from '../../types';
import { formatDate } from '../../constants';
import { useData } from '../../context/DataContext';

export interface LastPaymentDetail {
    challanNumber?: string;
    date?: string;
    amount?: number;
    paid?: number;
    discount?: number;
    balance?: number;
}

interface PrintableChallanProps {
    challan: FeeChallan;
    student: Student;
    school: School;
    studentClass?: string;
    copies?: 2 | 3;
    lateFee?: number;
    lastPaymentDetail?: LastPaymentDetail;
    allFees?: FeeChallan[];
}

const PrintableChallan: FC<PrintableChallanProps> = ({
    challan,
    student,
    school,
    studentClass,
    copies = 2,
    lastPaymentDetail,
    allFees
}) => {
    const copyLabels = copies === 2
        ? ["Parent Copy", "School Copy"]
        : ["Bank Copy", "Parent Copy", "School Copy"];

    // Format Month & Year for Header (e.g., DEC-2024)
    const monthAbbr = (challan.month || '').substring(0, 3).toUpperCase();
    const formattedMonthYear = `${monthAbbr}-${challan.year || new Date().getFullYear()}`;

    // Categorize fee breakdown
    let monthlyFee = 0;
    let admissionFee = 0;
    let annualExamFee = 0;
    let stationaryFee = 0;
    let otherFee = 0;

    if (challan.feeItems && challan.feeItems.length > 0) {
        challan.feeItems.forEach(item => {
            const desc = item.description.toLowerCase();
            if (desc.includes('tuition') || desc.includes('monthly') || desc.includes('fee')) {
                monthlyFee += item.amount;
            } else if (desc.includes('admission')) {
                admissionFee += item.amount;
            } else if (desc.includes('annual') || desc.includes('exam')) {
                annualExamFee += item.amount;
            } else if (desc.includes('station') || desc.includes('book') || desc.includes('material')) {
                stationaryFee += item.amount;
            } else {
                otherFee += item.amount;
            }
        });
    } else {
        monthlyFee = Math.max(0, challan.totalAmount - (challan.previousBalance || 0));
    }

    const previousDues = challan.previousBalance || 0;
    const currentFees = Math.max(0, challan.totalAmount - previousDues);
    const totalDues = challan.totalAmount;
    const discountAmount = challan.discount || 0;

    // Safely attempt to retrieve fees from DataContext if allFees prop is not passed
    let contextFees: FeeChallan[] = [];
    try {
        const data = useData();
        if (data && data.fees) {
            contextFees = data.fees;
        }
    } catch {
        // Fallback when rendered outside DataProvider context
    }

    const feesToSearch = allFees && allFees.length > 0 ? allFees : contextFees;

    // Helper to compute numeric month index
    const getMonthIndex = (monthStr?: string) => {
        if (!monthStr) return 0;
        const MONTH_NAMES = [
            "january", "february", "march", "april", "may", "june",
            "july", "august", "september", "october", "november", "december"
        ];
        const str = monthStr.toLowerCase().trim();
        for (let i = 0; i < MONTH_NAMES.length; i++) {
            if (str.includes(MONTH_NAMES[i]) || str.includes(MONTH_NAMES[i].substring(0, 3))) {
                return i;
            }
        }
        const num = parseInt(str, 10);
        if (!isNaN(num) && num >= 1 && num <= 12) {
            return num - 1;
        }
        return 0;
    };

    // Helper to compute numeric order for a fee challan (Year * 12 + Month)
    const getChallanVal = (f: FeeChallan) => {
        const monthIdx = getMonthIndex(f.month);
        let yearVal = 0;
        if (typeof f.year === 'number') {
            yearVal = f.year;
        } else if (typeof f.year === 'string') {
            yearVal = parseInt(f.year, 10);
        }
        if (!yearVal || isNaN(yearVal)) {
            if (f.dueDate) {
                const parts = String(f.dueDate).split('-');
                if (parts.length >= 1) yearVal = parseInt(parts[0], 10);
            }
        }
        if (!yearVal || isNaN(yearVal)) {
            yearVal = new Date().getFullYear();
        }
        return yearVal * 12 + monthIdx;
    };

    // Helper to extract the most recent payment date for a fee challan
    const getLatestPaymentDate = (f: FeeChallan) => {
        if (f.paymentHistory && f.paymentHistory.length > 0) {
            const dates = f.paymentHistory.map(p => p.date).filter(Boolean);
            if (dates.length > 0) {
                dates.sort();
                return dates[dates.length - 1];
            }
        }
        return f.paidDate || f.dueDate || '';
    };

    // Resolve Last Payment Detail values
    let computedLastDetail = lastPaymentDetail;

    if (!computedLastDetail && feesToSearch.length > 0) {
        const currentVal = getChallanVal(challan);
        const studentId = student?.id || challan.studentId;
        const currentPayDate = getLatestPaymentDate(challan);

        // Find candidate previous paid/partially-paid challans for this student
        const candidateChallans = feesToSearch.filter(f => {
            if (f.studentId !== studentId) return false;
            if (f.id === challan.id) return false; // Strictly exclude current challan!
            if (f.challanNumber && challan.challanNumber && f.challanNumber === challan.challanNumber) return false;

            const hasPayment = (f.paidAmount && f.paidAmount > 0) || f.status === 'Paid' || f.status === 'Partial' || (f.paymentHistory && f.paymentHistory.length > 0);
            if (!hasPayment) return false;

            const fVal = getChallanVal(f);
            if (fVal < currentVal) return true;
            if (fVal === currentVal) {
                const fDate = getLatestPaymentDate(f);
                if (fDate && currentPayDate && fDate < currentPayDate) return true;
            }

            return false;
        });

        // Sort candidates descending: most recent month/year first, then latest payment date
        candidateChallans.sort((a, b) => {
            const valA = getChallanVal(a);
            const valB = getChallanVal(b);
            if (valB !== valA) return valB - valA;

            const dateA = getLatestPaymentDate(a);
            const dateB = getLatestPaymentDate(b);
            if (dateB !== dateA) return dateB.localeCompare(dateA);

            return b.challanNumber.localeCompare(a.challanNumber);
        });

        if (candidateChallans.length > 0) {
            const prev = candidateChallans[0];
            const prevTotal = prev.totalAmount || 0;
            const prevPaid = prev.paidAmount || 0;
            const prevDiscount = prev.discount || 0;
            const prevBal = Math.max(0, prevTotal - prevPaid - prevDiscount);
            const prevDate = getLatestPaymentDate(prev) || prev.paidDate || prev.dueDate;

            computedLastDetail = {
                challanNumber: prev.challanNumber,
                date: prevDate,
                amount: prevTotal,
                paid: prevPaid,
                discount: prevDiscount,
                balance: prevBal
            };
        }
    }

    const lastChallanId = computedLastDetail?.challanNumber || '-';
    const lastDate = computedLastDetail?.date
        ? formatDate(computedLastDetail.date)
        : '-';
    const lastAmount = computedLastDetail?.amount !== undefined
        ? computedLastDetail.amount
        : 0;
    const lastPaid = computedLastDetail?.paid !== undefined
        ? computedLastDetail.paid
        : 0;
    const lastDA = computedLastDetail?.discount !== undefined
        ? computedLastDetail.discount
        : 0;
    const lastBalance = computedLastDetail?.balance !== undefined
        ? computedLastDetail.balance
        : 0;

    const studentRollOrId = student.rollNumber || student.grNumber || student.id.slice(0, 6);
    const formattedDueDate = challan.dueDate ? formatDate(challan.dueDate) : 'N/A';

    // QR Code Payload embedding student ID, payment due date, total amount, and challan number
    const qrData = JSON.stringify({
        challan: challan.challanNumber,
        stdId: studentRollOrId,
        dueDate: formattedDueDate,
        amount: totalDues
    });

    const ChallanBody: FC<{ copyName: string }> = ({ copyName }) => {
        const isSchoolCopy = copyName.toLowerCase().includes('school');
        const headerBgClass = isSchoolCopy ? 'bg-slate-700 text-white' : 'bg-slate-600 text-white';
        const copyBadgeClass = isSchoolCopy 
            ? 'bg-amber-300 text-slate-900 border-amber-500' 
            : 'bg-sky-300 text-slate-900 border-sky-500';

        return (
            <div className="printable-challan bg-white text-black font-sans leading-tight p-2 flex flex-col justify-between h-full border-2 border-slate-800 box-border rounded-xs">
                {/* Top Header with Soft Slate Background */}
                <div>
                    <div className={`${headerBgClass} p-1.5 flex justify-between items-center rounded-t-xs mb-1.5 border-b-2 border-slate-800`}>
                        <div className="flex items-center gap-1.5 min-w-0">
                            {school.logoUrl ? (
                                <img 
                                    src={school.logoUrl} 
                                    alt="School Logo" 
                                    className="w-7 h-7 sm:w-8 sm:h-8 object-contain bg-white rounded-xs p-0.5 flex-shrink-0 border border-slate-300" 
                                />
                            ) : (
                                <div className="w-7 h-7 sm:w-8 sm:h-8 bg-slate-800 text-amber-300 flex items-center justify-center rounded-xs flex-shrink-0 border border-slate-500">
                                    <GraduationCap className="w-5 h-5" />
                                </div>
                            )}
                            <div className="min-w-0">
                                <h2 className="font-extrabold text-xs sm:text-sm uppercase tracking-tight leading-none truncate text-white">
                                    {school.name}
                                </h2>
                                <p className="text-[8.5px] text-slate-100 leading-tight mt-0.5 truncate font-normal">
                                    {school.address}
                                </p>
                            </div>
                        </div>
                        <div className="flex-shrink-0 ml-1.5">
                            <span className={`border px-1.5 py-0.5 text-[9px] font-extrabold uppercase rounded-2xs tracking-wider shadow-2xs ${copyBadgeClass}`}>
                                {copyName}
                            </span>
                        </div>
                    </div>

                    {/* Metadata Header Line */}
                    <div className="text-[10px] space-y-0.5 mb-1.5 border-b border-slate-400 pb-1 px-0.5">
                        <div className="flex justify-between items-center text-[10px] font-semibold">
                            <div>
                                <span className="text-gray-700 font-normal">Challan ID: </span>
                                <span className="font-bold text-black ml-1">{challan.challanNumber}</span>
                            </div>
                            <div>
                                <span className="text-gray-700 font-normal">Std.ID </span>
                                <span className="font-bold text-black ml-1">{studentRollOrId}</span>
                            </div>
                            <div>
                                <span className="text-gray-700 font-normal">Class </span>
                                <span className="font-bold text-black ml-1 uppercase">{studentClass || 'N/A'}</span>
                            </div>
                        </div>
                        <div className="flex items-center justify-between text-[10px] pt-0.5">
                            <div className="flex items-center">
                                <span className="text-gray-700 w-16">Std.Name</span>
                                <span className="font-bold text-black uppercase">{student.name}</span>
                            </div>
                            <div>
                                <span className="text-gray-700 font-normal">Due Date: </span>
                                <span className="font-bold text-black">{formattedDueDate}</span>
                            </div>
                        </div>
                        <div className="flex items-center text-[10px]">
                            <span className="text-gray-700 w-16">FatherNam</span>
                            <span className="font-bold text-black uppercase">{student.fatherName}</span>
                        </div>
                    </div>

                    {/* Main Content Grid: Fee Breakdown (Left) + LAST PAYMENT DETAIL & QR Code (Right) */}
                    <div className="grid grid-cols-12 gap-1.5 text-[9.5px]">
                        {/* Left Column: Description & Breakdown */}
                        <div className="col-span-7 flex flex-col justify-between">
                            <div>
                                {/* Header */}
                                <div className="flex justify-between font-bold text-slate-900 bg-slate-200 px-1 py-0.5 border border-slate-700 mb-1 rounded-2xs">
                                    <span>Description</span>
                                    <span>{formattedMonthYear}</span>
                                </div>

                                {/* Item Rows */}
                                <div className="space-y-0.5 text-gray-900 px-0.5">
                                    <div className="flex justify-between">
                                        <span>Monthly</span>
                                        <span>{monthlyFee > 0 ? monthlyFee.toLocaleString() : '0'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Admission</span>
                                        <span>{admissionFee > 0 ? admissionFee.toLocaleString() : '0'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Annual/Exam</span>
                                        <span>{annualExamFee > 0 ? annualExamFee.toLocaleString() : '0'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Stationary</span>
                                        <span>{stationaryFee > 0 ? stationaryFee.toLocaleString() : '0'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Other</span>
                                        <span>{otherFee > 0 ? otherFee.toLocaleString() : '0'}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Breakdown Totals */}
                            <div className="mt-1 pt-1 border-t border-gray-400 space-y-0.5 px-0.5">
                                <div className="flex justify-between text-gray-900">
                                    <span>Current Fees</span>
                                    <span>{currentFees.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between text-gray-900">
                                    <span>PreviousDues</span>
                                    <span>{previousDues.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between font-bold text-black text-[10.5px]">
                                    <span>Total Dues</span>
                                    <span>Rs. {totalDues.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between text-gray-800">
                                    <span>Discount Amount (D.A.)</span>
                                    <span>{discountAmount.toLocaleString()}</span>
                                </div>
                            </div>
                        </div>

                        {/* Right Column: LAST PAYMENT DETAIL Box + QR Code */}
                        <div className="col-span-5 flex flex-col justify-between space-y-1">
                            {/* LAST PAYMENT DETAIL Table */}
                            <div className="border border-slate-800 bg-white rounded-2xs overflow-hidden">
                                <div className="border-b border-slate-800 text-center font-bold text-[8px] uppercase py-0.5 px-0.5 bg-slate-200 text-slate-900">
                                    LAST PAYMENT DETAIL
                                </div>
                                <div className="divide-y divide-gray-300 text-[8.5px] text-black">
                                    <div className="flex justify-between px-1 py-0.5">
                                        <span className="font-medium text-gray-700">Challan ID</span>
                                        <span className="font-semibold">{lastChallanId}</span>
                                    </div>
                                    <div className="flex justify-between px-1 py-0.5">
                                        <span className="font-medium text-gray-700">Date</span>
                                        <span>{lastDate}</span>
                                    </div>
                                    <div className="flex justify-between px-1 py-0.5">
                                        <span className="font-medium text-gray-700">Amount</span>
                                        <span>{lastAmount > 0 ? lastAmount.toLocaleString() : '-'}</span>
                                    </div>
                                    <div className="flex justify-between px-1 py-0.5">
                                        <span className="font-medium text-gray-700">Paid</span>
                                        <span>{lastPaid > 0 ? lastPaid.toLocaleString() : '-'}</span>
                                    </div>
                                    <div className="flex justify-between px-1 py-0.5">
                                        <span className="font-medium text-gray-700">Discount (D.A.)</span>
                                        <span>{lastDA > 0 ? lastDA.toLocaleString() : '0'}</span>
                                    </div>
                                    <div className="flex justify-between px-1 py-0.5 font-bold bg-slate-50">
                                        <span>Balance</span>
                                        <span>{lastBalance > 0 ? lastBalance.toLocaleString() : '0'}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Account Desk Quick Scan QR Code Box */}
                            <div className="border border-slate-800 bg-slate-50 p-1 flex flex-col items-center justify-center rounded-2xs">
                                <div className="bg-white p-1 border border-slate-300 rounded-2xs shadow-2xs">
                                    <QRCodeSVG 
                                        value={qrData}
                                        size={52}
                                        level="M"
                                        includeMargin={false}
                                    />
                                </div>
                                <span className="text-[7.5px] font-bold text-slate-800 uppercase tracking-tight mt-0.5">
                                    Desk Scan QR
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Bottom Payment Acknowledgment Row Box */}
                {/* Cashier fills these by hand upon payment; when recorded in app, values print automatically */}
                <div className="mt-1.5 border-2 border-slate-800 grid grid-cols-3 divide-x-2 divide-slate-800 text-[9.5px] text-black font-bold rounded-2xs overflow-hidden bg-white">
                    <div className="p-1 flex items-center justify-between min-h-[24px]">
                        <span className="text-slate-800">Pay Date:</span>
                        <span className="font-semibold text-[9px] text-right">
                            {challan.paidDate ? (
                                formatDate(challan.paidDate)
                            ) : (
                                <span className="inline-block border-b border-slate-500 min-w-[55px] text-center text-slate-300 font-normal">
                                    &nbsp;
                                </span>
                            )}
                        </span>
                    </div>
                    <div className="p-1 flex items-center justify-between min-h-[24px]">
                        <span className="text-slate-800">Paid:</span>
                        <span className="font-semibold text-[9px] text-right">
                            {challan.paidAmount > 0 ? (
                                `Rs. ${challan.paidAmount.toLocaleString()}`
                            ) : (
                                <span className="inline-block border-b border-slate-500 min-w-[55px] text-center text-slate-300 font-normal">
                                    &nbsp;
                                </span>
                            )}
                        </span>
                    </div>
                    <div className="p-1 flex items-center justify-between min-h-[24px]">
                        <span className="text-slate-800">Bal.:</span>
                        <span className="font-semibold text-[9px] text-right">
                            {challan.paidAmount > 0 ? (
                                `Rs. ${Math.max(0, totalDues - challan.paidAmount - discountAmount).toLocaleString()}`
                            ) : (
                                <span className="inline-block border-b border-slate-500 min-w-[55px] text-center text-slate-300 font-normal">
                                    &nbsp;
                                </span>
                            )}
                        </span>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="w-full h-full flex flex-row justify-between items-stretch bg-white text-black text-left box-border mx-auto p-2">
            {copyLabels.map((label, index) => (
                <React.Fragment key={index}>
                    <div style={{ width: copies === 2 ? '48%' : '31%' }} className="h-full flex flex-col justify-between">
                        <ChallanBody copyName={label} />
                    </div>
                    {index < copyLabels.length - 1 && (
                        <div className="border-r-2 border-dashed border-gray-600 my-1 self-stretch" />
                    )}
                </React.Fragment>
            ))}
        </div>
    );
};

export default PrintableChallan;

