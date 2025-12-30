
import React, { useMemo } from 'react';
import { useData } from '../../context/DataContext';
import { formatDate, formatMonthDisplay } from '../../constants';
import Badge from '../common/Badge';
import { FeeChallan } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { Permission } from '../../permissions';

interface StudentFeeHistoryProps {
    studentId: string;
    onEditChallan: (challan: FeeChallan) => void;
}

const StudentFeeHistory: React.FC<StudentFeeHistoryProps> = ({ studentId, onEditChallan }) => {
    const { fees } = useData();
    const { hasPermission } = useAuth();
    const canEdit = hasPermission(Permission.CAN_MANAGE_FEES);
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

    const studentChallans = useMemo(() => {
        return fees
            .filter((f: FeeChallan) => f.studentId === studentId)
            .sort((a, b) => {
                const dateA = new Date(a.year, months.indexOf(a.month));
                const dateB = new Date(b.year, months.indexOf(b.month));
                return dateB.getTime() - dateA.getTime();
            });
    }, [fees, studentId, months]);

    const getStatusColor = (status: FeeChallan['status']) => {
        if (status === 'Paid') return 'green';
        if (status === 'Unpaid') return 'red';
        if (status === 'Cancelled') return 'secondary';
        return 'yellow'; // Partial
    }

    return (
        <div>
            <h3 className="text-lg font-medium text-secondary-900 dark:text-white mb-4">Fee Payment History</h3>
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="text-xs text-secondary-700 uppercase bg-secondary-50 dark:bg-secondary-700 dark:text-secondary-300">
                        <tr>
                            <th className="px-4 py-2">Month/Year</th>
                            <th className="px-4 py-2">Challan #</th>
                            <th className="px-4 py-2 text-right">Total Due</th>
                            <th className="px-4 py-2 text-right">Amount Paid</th>
                            <th className="px-4 py-2 text-right">Balance</th>
                            <th className="px-4 py-2 text-center">Status</th>
                            <th className="px-4 py-2">Due Date</th>
                            <th className="px-4 py-2">Paid Date</th>
                            {canEdit && <th className="px-4 py-2">Actions</th>}
                        </tr>
                    </thead>
                    <tbody className="divide-y dark:divide-secondary-700">
                        {studentChallans.map(challan => {
                            const totalDue = challan.totalAmount - challan.discount;
                            const balance = totalDue - challan.paidAmount;
                            return (
                                <tr key={challan.id} className="hover:bg-secondary-50 dark:hover:bg-secondary-700/50">
                                    <td className="px-4 py-3 font-medium whitespace-nowrap">{formatMonthDisplay(challan.month, challan.year)}</td>
                                    <td className="px-4 py-3">{challan.challanNumber}</td>
                                    <td className="px-4 py-3 text-right">Rs. {totalDue.toLocaleString()}</td>
                                    <td className="px-4 py-3 text-right">Rs. {challan.paidAmount.toLocaleString()}</td>
                                    <td className={`px-4 py-3 text-right font-semibold ${balance > 0 ? 'text-red-600 dark:text-red-400' : ''}`}>Rs. {balance.toLocaleString()}</td>
                                    <td className="px-4 py-3 text-center"><Badge color={getStatusColor(challan.status)}>{challan.status}</Badge></td>
                                    <td className="px-4 py-3">{formatDate(challan.dueDate)}</td>
                                    <td className="px-4 py-3">{challan.paidDate ? formatDate(challan.paidDate) : 'N/A'}</td>
                                    {canEdit && (
                                        <td className="px-4 py-3">
                                            {(challan.status === 'Paid' || challan.status === 'Partial') && (
                                                <button
                                                    onClick={() => onEditChallan(challan)}
                                                    className="font-medium text-primary-600 dark:text-primary-500 hover:underline"
                                                >
                                                    Edit
                                                </button>
                                            )}
                                        </td>
                                    )}
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
                {studentChallans.length === 0 && <p className="text-center p-8 text-secondary-500">No fee history found for this student.</p>}
            </div>
        </div>
    );
};

export default StudentFeeHistory;
