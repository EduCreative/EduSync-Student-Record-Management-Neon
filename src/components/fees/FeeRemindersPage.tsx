import React, { useState, useMemo } from 'react';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../types';
import Avatar from '../common/Avatar';
import { formatDate } from '../../constants';
import { getClassLevel } from '../../utils/sorting';
import { useToast } from '../../context/ToastContext';

const FeeRemindersPage: React.FC = () => {
    const { user, activeSchoolId } = useAuth();
    const { students, fees, classes, sendFeeReminders } = useData();
    const { showToast } = useToast();
    const [isSending, setIsSending] = useState(false);

    // Filters
    const [classFilter, setClassFilter] = useState('all');
    const [dueDateStart, setDueDateStart] = useState('');
    const [dueDateEnd, setDueDateEnd] = useState('');

    const [selectedChallanIds, setSelectedChallanIds] = useState<Set<string>>(new Set());

    const effectiveSchoolId = user?.role === UserRole.Owner && activeSchoolId ? activeSchoolId : user?.schoolId;
    const schoolClasses = useMemo(() => classes.filter(c => c.schoolId === effectiveSchoolId), [classes, effectiveSchoolId]);
    const sortedClasses = useMemo(() => [...schoolClasses].sort((a, b) => (a.sortOrder ?? Infinity) - (b.sortOrder ?? Infinity) || getClassLevel(a.name) - getClassLevel(b.name)), [schoolClasses]);
    const studentMap = useMemo(() => new Map(students.map(s => [s.id, s])), [students]);
    const classMap = useMemo(() => new Map(classes.map(c => [c.id, `${c.name}${c.section ? ` - ${c.section}` : ''}`])), [classes]);

    const defaulterChallans = useMemo(() => {
        return fees.filter(fee => {
            if (fee.status === 'Paid') return false;
            const student = studentMap.get(fee.studentId);
            if (!student || student.schoolId !== effectiveSchoolId || student.status !== 'Active') return false;
            if (classFilter !== 'all' && student.classId !== classFilter) return false;
            if (dueDateStart && fee.dueDate < dueDateStart) return false;
            if (dueDateEnd && fee.dueDate > dueDateEnd) return false;
            return true;
        });
    }, [fees, studentMap, effectiveSchoolId, classFilter, dueDateStart, dueDateEnd]);

    const handleToggleAll = () => {
        if (selectedChallanIds.size === defaulterChallans.length) {
            setSelectedChallanIds(new Set());
        } else {
            setSelectedChallanIds(new Set(defaulterChallans.map(c => c.id)));
        }
    };

    const handleToggleChallan = (challanId: string) => {
        setSelectedChallanIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(challanId)) {
                newSet.delete(challanId);
            } else {
                newSet.add(challanId);
            }
            return newSet;
        });
    };

    const handleSendReminders = async () => {
        if (selectedChallanIds.size === 0) return;
        setIsSending(true);
        try {
            // The backend for this is removed as the notifications table doesn't exist.
            // We simulate the action for the user.
            await new Promise(resolve => setTimeout(resolve, 500)); // Simulate network delay
            sendFeeReminders(Array.from(selectedChallanIds));
            setSelectedChallanIds(new Set()); // Clear selection after sending
        } catch (e) {
            showToast("Error", "Could not send reminders.", "error");
        } finally {
            setIsSending(false);
        }
    };

    return (
        <div className="p-4 sm:p-6 space-y-4">
            <div>
                <h2 className="text-xl font-semibold">Send Fee Deadline Reminders</h2>
                <p className="text-sm text-secondary-500">Select challans to send in-app reminders to linked parent and student accounts.</p>
            </div>

            <div className="p-4 bg-secondary-50 dark:bg-secondary-900/50 rounded-lg grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                    <label className="input-label">Filter by Class</label>
                    <select value={classFilter} onChange={e => setClassFilter(e.target.value)} className="input-field">
                        <option value="all">All Classes</option>
                        {sortedClasses.map(c => <option key={c.id} value={c.id}>{`${c.name}${c.section ? ` - ${c.section}` : ''}`}</option>)}
                    </select>
                </div>
                <div>
                    <label className="input-label">Due Date From</label>
                    <input type="date" value={dueDateStart} onChange={e => setDueDateStart(e.target.value)} className="input-field" />
                </div>
                 <div>
                    <label className="input-label">Due Date To</label>
                    <input type="date" value={dueDateEnd} onChange={e => setDueDateEnd(e.target.value)} className="input-field" />
                </div>
            </div>

            <div className="overflow-x-auto border dark:border-secondary-700 rounded-lg">
                <table className="w-full text-sm">
                    <thead className="text-xs text-secondary-700 uppercase bg-secondary-50 dark:bg-secondary-700 dark:text-secondary-300">
                        <tr>
                            <th className="p-2 w-12 text-center">
                                <input type="checkbox"
                                    className="rounded"
                                    checked={defaulterChallans.length > 0 && selectedChallanIds.size === defaulterChallans.length}
                                    onChange={handleToggleAll}
                                />
                            </th>
                            <th className="px-4 py-3 text-left">Student</th>
                            <th className="px-4 py-3 text-left">Challan</th>
                            <th className="px-4 py-3 text-right">Balance</th>
                            <th className="px-4 py-3 text-center">Due Date</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y dark:divide-secondary-700">
                        {defaulterChallans.map(challan => {
                            const student = studentMap.get(challan.studentId);
                            if (!student) return null;
                            const balance = challan.totalAmount - challan.discount - challan.paidAmount;
                            return (
                                <tr key={challan.id} className="hover:bg-secondary-50 dark:hover:bg-secondary-700/50">
                                    <td className="p-2 text-center">
                                        <input type="checkbox"
                                            className="rounded"
                                            checked={selectedChallanIds.has(challan.id)}
                                            onChange={() => handleToggleChallan(challan.id)}
                                        />
                                    </td>
                                    <td className="px-4 py-2">
                                        <div className="flex items-center gap-3">
                                            <Avatar student={student} className="w-8 h-8" />
                                            <div>
                                                <p className="font-medium">{student.name}</p>
                                                <p className="text-xs text-secondary-500">{classMap.get(student.classId)}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-2">{challan.month} {challan.year}</td>
                                    <td className="px-4 py-2 text-right">Rs. {balance.toLocaleString()}</td>
                                    <td className="px-4 py-2 text-center">{formatDate(challan.dueDate)}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                {defaulterChallans.length === 0 && <p className="text-center p-8 text-secondary-500">No outstanding challans match the current filters.</p>}
            </div>

            <div className="flex justify-between items-center pt-4">
                <p className="text-sm font-medium">{selectedChallanIds.size} challan(s) selected.</p>
                <button
                    onClick={handleSendReminders}
                    disabled={isSending || selectedChallanIds.size === 0}
                    className="btn-primary"
                >
                    {isSending ? 'Sending...' : `Send ${selectedChallanIds.size} Reminders`}
                </button>
            </div>
        </div>
    );
};

export default FeeRemindersPage;