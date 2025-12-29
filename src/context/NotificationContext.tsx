

import React, { createContext, useState, useContext, useEffect, ReactNode, useCallback, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabaseClient';
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
        const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', user.id)
            .order('timestamp', { ascending: false })
            .limit(50);
        
        if (error) {
            console.error('Error fetching notifications:', error);
        } else if (data) {
            setNotifications(toCamelCase(data) as Notification[]);
        }
    }, [user]);

    useEffect(() => {
        fetchNotifications();
    }, [fetchNotifications]);
    
    useEffect(() => {
        if (!user) return;

        const channel = supabase.channel('public:notifications')
            .on('postgres_changes', { 
                event: 'INSERT', 
                schema: 'public', 
                table: 'notifications',
                filter: `user_id=eq.${user.id}`
            }, 
            (payload) => {
                const newNotification = toCamelCase(payload.new) as Notification;
                setNotifications(prev => [newNotification, ...prev]);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user]);

    const unreadCount = useMemo(() => notifications.filter(n => !n.isRead).length, [notifications]);

    const markAsRead = async (notificationId: string) => {
        const notification = notifications.find(n => n.id === notificationId);
        if (!notification || notification.isRead) return;

        setNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, isRead: true } : n));
        
        const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', notificationId);
        if (error) {
            console.error('Failed to mark notification as read:', error);
            // Revert optimistic update on failure
            setNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, isRead: false } : n));
        }
    };

    const markAllAsRead = async () => {
        if (!user || unreadCount === 0) return;

        const unreadIds = notifications.filter(n => !n.isRead).map(n => n.id);
        setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));

        const { error } = await supabase.from('notifications').update({ is_read: true }).in('id', unreadIds);
        if (error) {
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