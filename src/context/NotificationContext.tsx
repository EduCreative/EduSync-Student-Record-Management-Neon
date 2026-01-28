
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
    sendAnnouncement: (userIds: string[], title: string, message: string, link?: string) => Promise<void>;
    refreshNotifications: () => Promise<void>;
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
        
        // Polling as a fallback for realtime
        const interval = setInterval(fetchNotifications, 60000); 
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

    const sendAnnouncement = async (userIds: string[], title: string, message: string, link?: string) => {
        if (userIds.length === 0) return;

        try {
            // Process in chunks of 20 to balance performance and connection stability
            const CHUNK_SIZE = 20;
            const uniqueUserIds = Array.from(new Set(userIds));

            for (let i = 0; i < uniqueUserIds.length; i += CHUNK_SIZE) {
                const chunk = uniqueUserIds.slice(i, i + CHUNK_SIZE);
                await Promise.all(chunk.map(id => 
                    sql`
                        INSERT INTO notifications (id, user_id, title, message, link, is_read, timestamp)
                        VALUES (${crypto.randomUUID()}, ${id}, ${title}, ${message}, ${link || null}, false, NOW())
                    `
                ));
            }
        } catch (error) {
            console.error('Failed to send announcements:', error);
            throw error;
        }
    };

    const value = {
        notifications,
        unreadCount,
        markAsRead,
        markAllAsRead,
        sendAnnouncement,
        refreshNotifications: fetchNotifications
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
