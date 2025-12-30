
import React, { useState, useRef, useEffect } from 'react';
import { useNotification } from '../../context/NotificationContext';
import { formatDateTime } from '../../constants';

const BellIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
);

const NotificationBell: React.FC = () => {
    const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotification();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 rounded-full text-secondary-500 hover:bg-secondary-100 dark:text-secondary-400 dark:hover:bg-secondary-700 transition-colors"
                title="Notifications"
            >
                <BellIcon className="w-6 h-6" />
                {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white ring-2 ring-white dark:ring-secondary-800 animate-pulse">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-80 max-h-[32rem] overflow-hidden rounded-xl bg-white dark:bg-secondary-800 shadow-2xl ring-1 ring-black ring-opacity-5 z-50">
                    <div className="flex items-center justify-between border-b dark:border-secondary-700 p-4">
                        <h3 className="font-bold text-secondary-900 dark:text-white">Notifications</h3>
                        {unreadCount > 0 && (
                            <button 
                                onClick={markAllAsRead}
                                className="text-xs font-semibold text-primary-600 hover:text-primary-700 dark:text-primary-400"
                            >
                                Mark all as read
                            </button>
                        )}
                    </div>

                    <div className="overflow-y-auto max-h-96 divide-y dark:divide-secondary-700">
                        {notifications.length > 0 ? (
                            notifications.map((n) => (
                                <div 
                                    key={n.id} 
                                    className={`p-4 hover:bg-secondary-50 dark:hover:bg-secondary-700/50 transition-colors cursor-pointer ${!n.isRead ? 'bg-primary-50/30 dark:bg-primary-900/10' : ''}`}
                                    onClick={() => markAsRead(n.id)}
                                >
                                    <div className="flex justify-between items-start gap-2">
                                        <h4 className={`text-sm font-semibold ${!n.isRead ? 'text-primary-700 dark:text-primary-300' : 'text-secondary-900 dark:text-white'}`}>
                                            {n.title}
                                        </h4>
                                        {!n.isRead && <div className="w-2 h-2 mt-1.5 rounded-full bg-primary-600 flex-shrink-0"></div>}
                                    </div>
                                    <p className="mt-1 text-xs text-secondary-600 dark:text-secondary-400 line-clamp-3">
                                        {n.message}
                                    </p>
                                    <span className="mt-2 block text-[10px] text-secondary-400 uppercase font-medium">
                                        {formatDateTime(n.timestamp)}
                                    </span>
                                </div>
                            ))
                        ) : (
                            <div className="py-12 text-center text-secondary-500 dark:text-secondary-400">
                                <BellIcon className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                <p className="text-sm">No notifications yet</p>
                            </div>
                        )}
                    </div>

                    <div className="border-t dark:border-secondary-700 p-3 text-center">
                        <button className="text-xs font-bold text-secondary-500 hover:text-primary-600 uppercase tracking-wider">
                            View All Notifications
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default NotificationBell;
