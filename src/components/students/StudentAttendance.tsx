import React, { useState, useMemo } from 'react';
import { useData } from '../../context/DataContext';
import { Attendance } from '../../types';

interface StudentAttendanceProps {
    studentId: string;
}

const StudentAttendance: React.FC<StudentAttendanceProps> = ({ studentId }) => {
    const { attendance } = useData();
    const [currentDate, setCurrentDate] = useState(new Date());

    const eventsByDate = useMemo(() => {
        return attendance.reduce((acc, att: Attendance) => {
            if (att.studentId === studentId) {
                acc[att.date] = att.status;
            }
            return acc;
        }, {} as Record<string, 'Present' | 'Absent' | 'Leave'>);
    }, [attendance, studentId]);

    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    const startDate = new Date(startOfMonth);
    startDate.setDate(startDate.getDate() - startOfMonth.getDay());
    const endDate = new Date(endOfMonth);
    endDate.setDate(endDate.getDate() + (6 - endOfMonth.getDay()));
    
    const days = [];
    let day = new Date(startDate);
    while (day <= endDate) {
        days.push(new Date(day));
        day.setDate(day.getDate() + 1);
    }

    const changeMonth = (offset: number) => {
        setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + offset, 1));
    };

    const getStatusInfo = (status?: 'Present' | 'Absent' | 'Leave') => {
        if (status === 'Present') return { color: 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300', label: 'P' };
        if (status === 'Absent') return { color: 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-300', label: 'A' };
        if (status === 'Leave') return { color: 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-300', label: 'L' };
        return { color: 'bg-transparent', label: '' };
    };

    const attendanceSummary = useMemo(() => {
        const month = currentDate.getMonth();
        const year = currentDate.getFullYear();
        const summary = { Present: 0, Absent: 0, Leave: 0 };
        Object.entries(eventsByDate).forEach(([dateStr, status]) => {
            const date = new Date(dateStr);
            if (date.getMonth() === month && date.getFullYear() === year) {
                summary[status as keyof typeof summary]++;
            }
        });
        return summary;
    }, [eventsByDate, currentDate]);

    return (
        <div>
            <h3 className="text-lg font-medium text-secondary-900 dark:text-white mb-4">Attendance Record</h3>
            <div className="border dark:border-secondary-700 rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                    <button onClick={() => changeMonth(-1)} className="p-2 rounded-full hover:bg-secondary-100 dark:hover:bg-secondary-700">&lt;</button>
                    <h2 className="text-md font-semibold">{currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</h2>
                    <button onClick={() => changeMonth(1)} className="p-2 rounded-full hover:bg-secondary-100 dark:hover:bg-secondary-700">&gt;</button>
                </div>

                <div className="grid grid-cols-7 border-t border-l border-secondary-200 dark:border-secondary-700">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d} className="text-center py-2 bg-secondary-50 dark:bg-secondary-900 font-medium text-sm border-r border-b dark:border-secondary-700">{d}</div>)}
                    {days.map(d => {
                        const dateStr = d.toISOString().split('T')[0];
                        const status = eventsByDate[dateStr];
                        const statusInfo = getStatusInfo(status);
                        const isToday = new Date().toISOString().split('T')[0] === dateStr;
                        const isCurrentMonth = d.getMonth() === currentDate.getMonth();

                        return (
                            <div key={dateStr} className={`relative p-1 h-16 flex flex-col items-center justify-center border-r border-b dark:border-secondary-700 ${!isCurrentMonth ? 'bg-secondary-50 dark:bg-secondary-900/50 text-secondary-400' : 'text-secondary-800 dark:text-secondary-200'} ${statusInfo.color}`}>
                                <span className={`absolute top-1 right-1 text-xs font-semibold ${isToday ? 'bg-primary-600 text-white rounded-full h-5 w-5 flex items-center justify-center' : ''}`}>
                                    {d.getDate()}
                                </span>
                                <span className="text-lg font-bold">{statusInfo.label}</span>
                            </div>
                        );
                    })}
                </div>
                <div className="flex flex-wrap gap-4 p-4">
                    <div className="flex items-center gap-2 text-sm"><span className="w-4 h-4 rounded-full bg-green-400"></span> Present: <strong>{attendanceSummary.Present}</strong></div>
                    <div className="flex items-center gap-2 text-sm"><span className="w-4 h-4 rounded-full bg-red-400"></span> Absent: <strong>{attendanceSummary.Absent}</strong></div>
                    <div className="flex items-center gap-2 text-sm"><span className="w-4 h-4 rounded-full bg-yellow-400"></span> Leave: <strong>{attendanceSummary.Leave}</strong></div>
                </div>
            </div>
        </div>
    );
};

export default StudentAttendance;