
import { type FC } from 'react';
import { FeeChallan, Student, School } from '../../types';
import { formatDate, EduSyncLogo } from '../../constants';
import Barcode from '../common/Barcode';

interface PrintableChallanProps {
    challan: FeeChallan;
    student: Student;
    school: School;
    studentClass?: string;
    copies?: 2 | 3;
    lateFee?: number;
}

const ChallanRow: FC<{ label: string; value: string | number; bold?: boolean }> = ({ label, value, bold }) => (
    <div className={`flex justify-between items-baseline border-b border-gray-300 leading-none ${bold ? 'font-bold' : ''}`}>
        <span className="text-[9px] py-0.5">{label}</span>
        <span className="text-[9px] py-0.5 text-right whitespace-nowrap">{typeof value === 'number' ? `Rs. ${value.toLocaleString()}` : value}</span>
    </div>
);

const PrintableChallan: FC<PrintableChallanProps> = ({ challan, student, school, studentClass, copies = 3, lateFee = 500 }) => {
    
    const copyLabels = copies === 2 
        ? ["School Copy", "Parent/Student Copy"] 
        : ["Bank Copy", "School Copy", "Student Copy"];

    const currentBalance = challan.totalAmount - challan.discount - challan.paidAmount;

    const ChallanBody: FC<{ copyName: string }> = ({ copyName }) => (
        <div className="printable-challan border-2 border-gray-800 p-0.5 h-full flex flex-col justify-between bg-white text-black relative box-border overflow-hidden">
            {/* Header */}
            <div className="flex items-start gap-1 border-b-2 border-gray-800 pb-1 mb-1">
                <div className="h-8 w-8 flex-shrink-0 flex items-center justify-center mt-1">
                    {school.logoUrl ? (
                        <img src={school.logoUrl} alt="logo" className="max-h-8 max-w-8 object-contain" />
                    ) : (
                        <EduSyncLogo className="h-6 text-primary-700" />
                    )}
                </div>
                <div className="flex-1 text-center overflow-hidden">
                    <h3 className="font-bold text-xs uppercase leading-tight truncate">{school.name}</h3>
                    <p className="text-[7px] leading-tight line-clamp-2">{school.address}</p>
                    <div className="mt-0.5">
                        <span className="text-[8px] font-bold bg-black text-white px-2 py-0.5 rounded-sm uppercase">{copyName}</span>
                    </div>
                </div>
            </div>

            {/* Info Grid */}
            <div className="grid grid-cols-2 gap-x-1 gap-y-0.5 text-[8px] mb-1 leading-tight">
                <div className="flex justify-between whitespace-nowrap"><span>Challan #:</span> <span className="font-bold ml-1">{challan.challanNumber}</span></div>
                <div className="flex justify-between whitespace-nowrap"><span>Due Date:</span> <span className="font-bold ml-1">{formatDate(challan.dueDate)}</span></div>
                <div className="col-span-2 flex justify-between border-b border-dotted border-gray-400"><span>Student:</span> <span className="font-bold truncate ml-1">{student.name}</span></div>
                <div className="col-span-2 flex justify-between border-b border-dotted border-gray-400"><span>Father:</span> <span className="font-bold truncate ml-1">{student.fatherName}</span></div>
                
                {/* Class, GR, ID Line */}
                <div className="col-span-2 flex justify-between border-b border-dotted border-gray-400">
                    <div className="flex gap-1">
                        <span>Class:</span> <span className="font-bold truncate max-w-[50px]">{studentClass || 'N/A'}</span>
                    </div>
                    <div className="flex gap-1">
                        <span>GR #:</span> <span className="font-bold">{student.grNumber || '-'}</span>
                    </div>
                    <div className="flex gap-1">
                        <span>ID:</span> <span className="font-bold">{student.rollNumber}</span>
                    </div>
                </div>
            </div>

            {/* Fee Table */}
            <div className="flex-1 border border-gray-400 mb-1 flex flex-col min-h-0">
                <div className="flex justify-between bg-gray-200 px-1 py-0.5 border-b border-gray-400">
                    <span className="text-[8px] font-bold">Description</span>
                    <span className="text-[8px] font-bold">Amount</span>
                </div>
                <div className="flex-1 overflow-hidden px-1">
                    {challan.feeItems.map((item, index) => (
                        <ChallanRow key={index} label={item.description} value={item.amount} />
                    ))}
                    {challan.previousBalance > 0 && (
                         <ChallanRow label="Arrears" value={challan.previousBalance} />
                    )}
                </div>
            </div>

            {/* Totals */}
            <div className="text-[9px] space-y-0.5">
                <div className="flex justify-between border-b border-dotted border-gray-400">
                    <span>Current Amount:</span>
                    <span>Rs. {(challan.totalAmount - (challan.previousBalance || 0)).toLocaleString()}</span>
                </div>
                 <div className="flex justify-between border-b border-dotted border-gray-400">
                    <span>Total Arrears:</span>
                    <span>Rs. {(challan.previousBalance || 0).toLocaleString()}</span>
                </div>
                 <div className="flex justify-between border-b border-dotted border-gray-400">
                    <span>Discount:</span>
                    <span>Rs. {(challan.discount || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between font-bold text-[10px] bg-gray-100 px-1 py-0.5 border border-gray-400">
                    <span>Payable By Due Date:</span>
                    <span>Rs. {(challan.totalAmount - (challan.discount || 0)).toLocaleString()}</span>
                </div>
                <div className="flex justify-between font-bold text-[10px] bg-gray-100 px-1 py-0.5 border-x border-b border-gray-400 mb-1">
                    <span>Payable After Due Date:</span>
                    <span>Rs. {(challan.totalAmount - (challan.discount || 0) + lateFee).toLocaleString()}</span>
                </div>
                
                {/* Manual Entry Fields for Accountant */}
                <div className="border-t border-gray-400 pt-0.5 mt-0.5">
                    <div className="flex justify-between items-end text-[9px]">
                        <span>Payment Amount:</span>
                        <span className="border-b border-black w-14 text-right">
                            {challan.paidAmount > 0 ? challan.paidAmount.toLocaleString() : '\u00A0'}
                        </span>
                    </div>
                    <div className="flex justify-between items-end text-[9px] mt-0.5">
                        <span className="whitespace-nowrap">Payment Date:</span>
                        <span className="border-b border-black w-14 text-right whitespace-nowrap">
                            {challan.paidDate ? formatDate(challan.paidDate) : '\u00A0'}
                        </span>
                    </div>
                    <div className="flex justify-between items-end text-[9px] mt-0.5">
                        <span>Balance:</span>
                        <span className="border-b border-black w-14 text-right font-bold">
                            {challan.paidAmount > 0 ? currentBalance.toLocaleString() : '\u00A0'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="mt-1 pt-1 flex justify-between items-end">
                 <div className="flex flex-col items-center w-[25%]">
                     <div className="h-4 w-full border-b border-black"></div>
                     <span className="text-[7px] uppercase">Officer</span>
                 </div>
                 <div className="flex-1 px-1 flex justify-center overflow-hidden">
                    <div className="scale-75 origin-bottom">
                        <Barcode value={challan.challanNumber} height={25} barWidth={0.8} />
                    </div>
                 </div>
                 <div className="flex flex-col items-center w-[25%]">
                     <div className="h-4 w-full border-b border-black"></div>
                     <span className="text-[7px] uppercase">Cashier</span>
                 </div>
            </div>
            
            <div className="text-[6px] text-center text-gray-400 leading-none mt-0.5">
                Generated: {formatDate(new Date())}
            </div>
        </div>
    );

    return (
        <div className="w-full h-full flex flex-row justify-between gap-0.5 px-8 box-border mx-auto">
             {copyLabels.map((label, index) => (
                <div key={index} style={{ width: copies === 2 ? '48%' : '32%' }} className="h-full">
                    <ChallanBody copyName={label} />
                </div>
             ))}
        </div>
    );
};

export default PrintableChallan;
