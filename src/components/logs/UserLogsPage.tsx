import React, { useState, useMemo, useEffect } from 'react';
import { useData } from '../../context/DataContext';
import { formatDateTime } from '../../constants';
import { User } from '../../types';
import Avatar from '../common/Avatar';

const UserLogsPage: React.FC = () => {
    const { logs, users } = useData();
    const [currentPage, setCurrentPage] = useState(1);
    const [searchTerm, setSearchTerm] = useState('');
    const [actionFilter, setActionFilter] = useState('all');
    const [dateRange, setDateRange] = useState({ start: '', end: '' });
    const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
    
    const LOGS_PER_PAGE = 15;

    const userMap = new Map(users.map((u: User) => [u.id, u]));

    // Extract unique actions for filter dropdown
    const uniqueActions = useMemo(() => {
        const actions = new Set(logs.map(log => log.action));
        return Array.from(actions).sort();
    }, [logs]);

    const filteredAndSortedLogs = useMemo(() => {
        let result = logs;

        // Filter by Search Term
        if (searchTerm) {
            const lowerTerm = searchTerm.toLowerCase();
            result = result.filter(log => 
                log.userName.toLowerCase().includes(lowerTerm) || 
                log.action.toLowerCase().includes(lowerTerm) || 
                log.details.toLowerCase().includes(lowerTerm)
            );
        }

        // Filter by Action
        if (actionFilter !== 'all') {
            result = result.filter(log => log.action === actionFilter);
        }

        // Filter by Date Range
        if (dateRange.start) {
            result = result.filter(log => new Date(log.timestamp) >= new Date(dateRange.start));
        }
        if (dateRange.end) {
            // Set end date to end of day
            const endDate = new Date(dateRange.end);
            endDate.setHours(23, 59, 59, 999);
            result = result.filter(log => new Date(log.timestamp) <= endDate);
        }

        // Sort
        return result.sort((a, b) => {
            const timeA = new Date(a.timestamp).getTime();
            const timeB = new Date(b.timestamp).getTime();
            return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
        });
    }, [logs, searchTerm, actionFilter, dateRange, sortOrder]);

    // Reset pagination when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, actionFilter, dateRange, sortOrder]);

    const totalPages = Math.ceil(filteredAndSortedLogs.length / LOGS_PER_PAGE);
    const paginatedLogs = filteredAndSortedLogs.slice((currentPage - 1) * LOGS_PER_PAGE, currentPage * LOGS_PER_PAGE);

    const showingFrom = filteredAndSortedLogs.length > 0 ? (currentPage - 1) * LOGS_PER_PAGE + 1 : 0;
    const showingTo = Math.min(currentPage * LOGS_PER_PAGE, filteredAndSortedLogs.length);

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-secondary-900 dark:text-white">User Activity Logs</h1>

            {/* Filters */}
            <div className="bg-white dark:bg-secondary-800 p-4 rounded-lg shadow-md">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                    <div className="lg:col-span-2">
                        <label className="input-label">Search</label>
                        <input 
                            type="text" 
                            placeholder="Search user, action, details..." 
                            value={searchTerm} 
                            onChange={e => setSearchTerm(e.target.value)} 
                            className="input-field"
                        />
                    </div>
                    <div>
                        <label className="input-label">Action Type</label>
                        <select 
                            value={actionFilter} 
                            onChange={e => setActionFilter(e.target.value)} 
                            className="input-field"
                        >
                            <option value="all">All Actions</option>
                            {uniqueActions.map(action => (
                                <option key={action} value={action}>{action}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="input-label">From Date</label>
                        <input 
                            type="date" 
                            value={dateRange.start} 
                            onChange={e => setDateRange(prev => ({ ...prev, start: e.target.value }))} 
                            className="input-field" 
                        />
                    </div>
                    <div>
                        <label className="input-label">To Date</label>
                        <input 
                            type="date" 
                            value={dateRange.end} 
                            onChange={e => setDateRange(prev => ({ ...prev, end: e.target.value }))} 
                            className="input-field" 
                        />
                    </div>
                </div>
                <div className="mt-4 flex justify-end">
                    <button 
                        onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')} 
                        className="btn-secondary text-sm flex items-center gap-2"
                    >
                        Sort: {sortOrder === 'desc' ? 'Newest First' : 'Oldest First'}
                    </button>
                </div>
            </div>

             <div className="bg-white dark:bg-secondary-800 rounded-lg shadow-md">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-secondary-500 dark:text-secondary-400">
                        <thead className="text-xs text-secondary-700 uppercase bg-secondary-50 dark:bg-secondary-700 dark:text-secondary-300">
                            <tr>
                                <th className="px-6 py-3">User</th>
                                <th className="px-6 py-3">Action</th>
                                <th className="px-6 py-3">Details</th>
                                <th className="px-6 py-3">Timestamp</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedLogs.length > 0 ? (
                                paginatedLogs.map(log => {
                                    const user = userMap.get(log.userId);
                                    return (
                                    <tr key={log.id} className="border-b dark:border-secondary-700 hover:bg-secondary-50 dark:hover:bg-secondary-700/50">
                                        <td className="px-6 py-4">
                                             <div className="flex items-center space-x-3">
                                                <Avatar user={user} className="w-8 h-8"/>
                                                <span className="font-medium text-secondary-900 dark:text-white">{log.userName}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="px-2 py-1 text-xs font-medium rounded-full bg-secondary-100 text-secondary-800 dark:bg-secondary-700 dark:text-secondary-300 whitespace-nowrap">
                                                {log.action}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 min-w-[200px]">{log.details}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-xs">{formatDateTime(log.timestamp)}</td>
                                    </tr>
                                )})
                            ) : (
                                <tr>
                                    <td colSpan={4} className="px-6 py-8 text-center text-secondary-500">
                                        No logs found matching criteria.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                 {totalPages > 0 && (
                    <div className="flex justify-between items-center p-4 border-t dark:border-secondary-700">
                        <span className="text-sm text-secondary-700 dark:text-secondary-400">
                            Showing {showingFrom} - {showingTo} of {filteredAndSortedLogs.length} logs
                        </span>
                        <div className="flex items-center space-x-2">
                            <button 
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
                                disabled={currentPage === 1} 
                                className="pagination-btn"
                            >
                                Previous
                            </button>
                            <span className="text-sm px-2">Page {currentPage} of {totalPages}</span>
                            <button 
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} 
                                disabled={currentPage === totalPages} 
                                className="pagination-btn"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>
             <style>{`.pagination-btn { @apply px-3 py-1 text-sm rounded-md border dark:border-secondary-600 disabled:opacity-50 hover:bg-secondary-50 dark:hover:bg-secondary-700; }`}</style>
        </div>
    );
};

export default UserLogsPage;