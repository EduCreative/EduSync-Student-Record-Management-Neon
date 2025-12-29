
import React, { createContext, useState, useContext, useEffect, ReactNode, useCallback, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { sql } from '../lib/neonClient';
import { Notification } from '../types';
import { toCamelCase } from '../utils/caseConverter';

interface NotificationContextType {
    notifications: Notification[];
    unreadCount: number;
    markAsRead: (notificationId: string) => Promise<void>;
    markAllAsRead: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState<Notification[]>([]);

    const fetchNotifications = useCallback(async () => {
        if (!user) {
            setNotifications([]);
            return;
        }
        try {
            const data = await sql`
                SELECT * FROM notifications 
                WHERE user_id = ${user.id} 
                ORDER BY timestamp DESC 
                LIMIT 50
            `;
            setNotifications(toCamelCase(data) as Notification[]);
        } catch (error) {
            console.error('Error fetching notifications:', error);
        }
    }, [user]);

    useEffect(() => {
        fetchNotifications();
        
        // Polling as a fallback for realtime since moving away from Supabase
        const interval = setInterval(fetchNotifications, 60000); // Check every minute
        return () => clearInterval(interval);
    }, [fetchNotifications]);
    
    const unreadCount = useMemo(() => notifications.filter(n => !n.isRead).length, [notifications]);

    const markAsRead = async (notificationId: string) => {
        const notification = notifications.find(n => n.id === notificationId);
        if (!notification || notification.isRead) return;

        setNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, isRead: true } : n));
        
        try {
            await sql`UPDATE notifications SET is_read = true WHERE id = ${notificationId}`;
        } catch (error) {
            console.error('Failed to mark notification as read:', error);
            // Revert optimistic update
            setNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, isRead: false } : n));
        }
    };

    const markAllAsRead = async () => {
        if (!user || unreadCount === 0) return;

        const unreadIds = notifications.filter(n => !n.isRead).map(n => n.id);
        setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));

        try {
            await sql`UPDATE notifications SET is_read = true WHERE id = ANY(${unreadIds})`;
        } catch (error) {
            console.error('Failed to mark all as read:', error);
            setNotifications(prev => prev.map(n => unreadIds.includes(n.id) ? { ...n, isRead: false } : n));
        }
    };

    const value = {
        notifications,
        unreadCount,
        markAsRead,
        markAllAsRead,
    };

    return (
        <NotificationContext.Provider value={value}>
            {children}
        </NotificationContext.Provider>
    );
};

export const useNotification = (): NotificationContextType => {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error('useNotification must be used within a NotificationProvider');
    }
    return context;
};
