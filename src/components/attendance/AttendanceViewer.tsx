import React, { useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
// FIX: Import UserRole to resolve 'Cannot find name' error.
import { UserRole } from '../../types';

const AttendanceViewer: React.FC = () => {
    const { user } = useAuth();
    const { students, attendance } = useData();
    const [currentDate, setCurrentDate] = useState(new Date());

    const myChildren = useMemo(() => {
        if (!user) return [];
        if (user.role === UserRole.Student) {
            const studentProfile = students.find(s => s.userId === user.id);
            return studentProfile ? [studentProfile] : [];
        }
        if (user.role === UserRole.Parent && user.childStudentIds) {
            return students.filter(s => user.childStudentIds!.includes(s.id));
        }
        return [];
    }, [user, students]);

    const [selectedChildId, setSelectedChildId] = useState<string>(myChildren[0]?.id || '');

    const eventsByDate = useMemo(() => {
        if (!selectedChildId) return {};
        return attendance.reduce((acc, att) => {
            if (att.studentId === selectedChildId) {
                acc[att.date] = att.status;
            }
            return acc;
        }, {} as Record<string, 'Present' | 'Absent' | 'Leave'>);
    }, [attendance, selectedChildId]);
    
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

    const getStatusColor = (status?: 'Present' | 'Absent' | 'Leave') => {
        if (status === 'Present') return 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300';
        if (status === 'Absent') return 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-300';
        if (status === 'Leave') return 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-300';
        return 'bg-transparent';
    };
    
    const attendanceSummary = useMemo(() => {
        const month = currentDate.getMonth();
        const year = currentDate.getFullYear();
        const summary = { Present: 0, Absent: 0, Leave: 0 };
        Object.entries(eventsByDate).forEach(([dateStr, status]) => {
            const date = new Date(dateStr);
            if(date.getMonth() === month && date.getFullYear() === year) {
                // FIX: Cast status to a valid key type for the summary object.
                summary[status as keyof typeof summary]++;
            }
        });
        return summary;
    }, [eventsByDate, currentDate]);

    if(myChildren.length === 0) {
        return (
            <div className="p-8 text-center bg-white dark:bg-secondary-800 rounded-lg shadow-md">
                <h1 className="text-xl font-semibold">No Student Linked</h1>
                <p className="text-secondary-500 mt-2">Your account is not linked to a student profile. Please contact administration.</p>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-secondary-900 dark:text-white">My Attendance</h1>
            
            {myChildren.length > 1 && (
                <div className="max-w-xs">
                    <label htmlFor="child-select" className="input-label">Viewing Attendance For</label>
                    <select id="child-select" value={selectedChildId} onChange={e => setSelectedChildId(e.target.value)} className="input-field">
                        {myChildren.map(child => <option key={child.id} value={child.id}>{child.name}</option>)}
                    </select>
                </div>
            )}
            
            <div className="bg-white dark:bg-secondary-800 rounded-lg shadow-md p-4">
                <div className="flex items-center justify-between mb-4">
                    <button onClick={() => changeMonth(-1)} className="p-2 rounded-full hover:bg-secondary-100 dark:hover:bg-secondary-700">&lt;</button>
                    <h2 className="text-xl font-semibold">{currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</h2>
                    <button onClick={() => changeMonth(1)} className="p-2 rounded-full hover:bg-secondary-100 dark:hover:bg-secondary-700">&gt;</button>
                </div>

                <div className="grid grid-cols-7 border-t border-l border-secondary-200 dark:border-secondary-700">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d} className="text-center py-2 bg-secondary-50 dark:bg-secondary-900 font-medium text-sm border-r border-b dark:border-secondary-700">{d}</div>)}
                    {days.map(d => {
                        const dateStr = d.toISOString().split('T')[0];
                        const status = eventsByDate[dateStr];
                        const isToday = new Date().toISOString().split('T')[0] === dateStr;
                        const isCurrentMonth = d.getMonth() === currentDate.getMonth();

                        return (
                            <div key={dateStr} className={`relative p-1 h-20 flex flex-col border-r border-b dark:border-secondary-700 ${!isCurrentMonth ? 'bg-secondary-50 dark:bg-secondary-900/50' : ''} ${getStatusColor(status)}`}>
                                <span className={`self-end text-xs font-semibold px-1.5 py-0.5 rounded-full ${isToday ? 'bg-primary-600 text-white' : ''}`}>
                                    {d.getDate()}
                                </span>
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

export default AttendanceViewer;