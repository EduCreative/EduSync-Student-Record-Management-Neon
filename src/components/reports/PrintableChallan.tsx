import React, { FC } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { GraduationCap } from 'lucide-react';
import { FeeChallan, Student, School } from '../../types';
import { formatDate } from '../../constants';

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
}

const PrintableChallan: FC<PrintableChallanProps> = ({
    challan,
    student,
    school,
    studentClass,
    copies = 2,
    lastPaymentDetail
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

    // Resolve Last Payment Detail values
    const lastChallanId = lastPaymentDetail?.challanNumber ||
        (challan.paymentHistory && challan.paymentHistory.length > 0 ? (challan.challanNumber) : '-');
    const lastDate = lastPaymentDetail?.date
        ? formatDate(lastPaymentDetail.date)
        : (challan.paidDate ? formatDate(challan.paidDate) : '-');
    const lastAmount = lastPaymentDetail?.amount !== undefined
        ? lastPaymentDetail.amount
        : (challan.paidAmount > 0 ? challan.totalAmount : 0);
    const lastPaid = lastPaymentDetail?.paid !== undefined
        ? lastPaymentDetail.paid
        : (challan.paidAmount || 0);
    const lastDA = lastPaymentDetail?.discount !== undefined
        ? lastPaymentDetail.discount
        : (challan.discount || 0);
    const lastBalance = lastPaymentDetail?.balance !== undefined
        ? lastPaymentDetail.balance
        : (challan.paidAmount > 0 ? Math.max(0, lastAmount - lastPaid - lastDA) : 0);

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
        const headerBgClass = isSchoolCopy ? 'bg-slate-900 text-white' : 'bg-slate-800 text-white';
        const copyBadgeClass = isSchoolCopy 
            ? 'bg-amber-400 text-slate-950 border-amber-500' 
            : 'bg-sky-400 text-slate-950 border-sky-500';

        return (
            <div className="printable-challan bg-white text-black font-sans leading-tight p-2 flex flex-col justify-between h-full border-2 border-slate-900 box-border rounded-sm">
                {/* Top Header with Dark Background */}
                <div>
                    <div className={`${headerBgClass} p-1.5 flex justify-between items-center rounded-t-sm mb-1.5 border-b-2 border-black`}>
                        <div className="flex items-center gap-1.5 min-w-0">
                            {school.logoUrl ? (
                                <img 
                                    src={school.logoUrl} 
                                    alt="School Logo" 
                                    className="w-7 h-7 sm:w-8 sm:h-8 object-contain bg-white rounded-sm p-0.5 flex-shrink-0 border border-slate-300" 
                                />
                            ) : (
                                <div className="w-7 h-7 sm:w-8 sm:h-8 bg-slate-700 text-amber-300 flex items-center justify-center rounded-sm flex-shrink-0 border border-slate-500">
                                    <GraduationCap className="w-5 h-5" />
                                </div>
                            )}
                            <div className="min-w-0">
                                <h2 className="font-extrabold text-xs sm:text-sm uppercase tracking-tight leading-none truncate text-white">
                                    {school.name}
                                </h2>
                                <p className="text-[8.5px] text-slate-200 leading-tight mt-0.5 truncate font-normal">
                                    {school.address}
                                </p>
                            </div>
                        </div>
                        <div className="flex-shrink-0 ml-1.5">
                            <span className={`border px-1.5 py-0.5 text-[9px] font-black uppercase rounded-xs tracking-wider shadow-xs ${copyBadgeClass}`}>
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
                                <div className="flex justify-between font-bold text-white bg-slate-800 px-1 py-0.5 border-b border-black mb-1 rounded-xs">
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
                                    <span>D. A.</span>
                                    <span>{discountAmount.toLocaleString()}</span>
                                </div>
                            </div>
                        </div>

                        {/* Right Column: LAST PAYMENT DETAIL Box + QR Code */}
                        <div className="col-span-5 flex flex-col justify-between space-y-1">
                            {/* LAST PAYMENT DETAIL Table */}
                            <div className="border border-black bg-white rounded-xs overflow-hidden">
                                <div className="border-b border-black text-center font-bold text-[8px] uppercase py-0.5 px-0.5 bg-slate-800 text-white">
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
                                        <span className="font-medium text-gray-700">D.A.</span>
                                        <span>{lastDA > 0 ? lastDA.toLocaleString() : '0'}</span>
                                    </div>
                                    <div className="flex justify-between px-1 py-0.5 font-bold bg-slate-50">
                                        <span>Balance</span>
                                        <span>{lastBalance > 0 ? lastBalance.toLocaleString() : '0'}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Account Desk Quick Scan QR Code Box */}
                            <div className="border border-slate-900 bg-slate-50 p-1 flex flex-col items-center justify-center rounded-xs">
                                <div className="bg-white p-1 border border-slate-300 rounded-xs shadow-2xs">
                                    <QRCodeSVG 
                                        value={qrData}
                                        size={54}
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
                <div className="mt-1.5 border-2 border-slate-900 grid grid-cols-3 divide-x-2 divide-slate-900 text-[9.5px] text-black font-bold rounded-xs overflow-hidden bg-white">
                    <div className="p-1 flex items-center justify-between min-h-[22px]">
                        <span className="text-slate-800">Pay Date:</span>
                        <span className="font-normal text-[9px]">
                            {challan.paidDate ? formatDate(challan.paidDate) : ''}
                        </span>
                    </div>
                    <div className="p-1 flex items-center justify-between min-h-[22px]">
                        <span className="text-slate-800">Paid:</span>
                        <span className="font-normal text-[9px]">
                            {challan.paidAmount > 0 ? challan.paidAmount.toLocaleString() : ''}
                        </span>
                    </div>
                    <div className="p-1 flex items-center justify-between min-h-[22px]">
                        <span className="text-slate-800">Bal.:</span>
                        <span className="font-normal text-[9px]">
                            {challan.paidAmount > 0 ? Math.max(0, totalDues - challan.paidAmount - discountAmount).toLocaleString() : ''}
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

