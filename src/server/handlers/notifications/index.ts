import { getDb, authenticateRequest } from '../../_db';
import crypto from 'crypto';

export default async function handler(req: any, res: any) {
    const session = authenticateRequest(req);
    if (!session) {
        return res.status(401).json({ error: 'Unauthorized: Valid session required.' });
    }

    const sql = getDb();

    if (req.method === 'GET') {
        try {
            const rows = await sql`
                SELECT id, user_id as "userId", title, message, link, is_read as "isRead", timestamp
                FROM notifications
                WHERE user_id = ${session.userId}
                ORDER BY timestamp DESC
                LIMIT 50
            `;
            return res.status(200).json({ notifications: rows });
        } catch (error: any) {
            console.error('Error fetching notifications:', error);
            return res.status(500).json({ error: error.message || 'Failed to fetch notifications' });
        }
    }

    if (req.method === 'POST') {
        const body = req.body || {};
        const { action } = body;

        try {
            if (action === 'mark_read') {
                const { notificationId } = body;
                if (!notificationId) {
                    return res.status(400).json({ error: 'Missing notificationId' });
                }
                await sql`
                    UPDATE notifications
                    SET is_read = true
                    WHERE id = ${notificationId} AND user_id = ${session.userId}
                `;
                return res.status(200).json({ success: true });
            }

            if (action === 'mark_all_read') {
                await sql`
                    UPDATE notifications
                    SET is_read = true
                    WHERE user_id = ${session.userId}
                `;
                return res.status(200).json({ success: true });
            }

            if (action === 'send') {
                const { userIds, title, message, link } = body;
                if (!Array.isArray(userIds) || userIds.length === 0 || !title || !message) {
                    return res.status(400).json({ error: 'Missing userIds, title, or message' });
                }

                // Check permissions: Owner, Admin, Accountant, Teacher can send
                const allowedRoles = ['Owner', 'Admin', 'Accountant', 'Teacher'];
                if (!allowedRoles.includes(session.role)) {
                    return res.status(403).json({ error: 'Forbidden: Insufficient permissions to send notifications' });
                }

                const uniqueUserIds = Array.from(new Set(userIds));
                const CHUNK_SIZE = 25;

                for (let i = 0; i < uniqueUserIds.length; i += CHUNK_SIZE) {
                    const chunk = uniqueUserIds.slice(i, i + CHUNK_SIZE);
                    await Promise.all(chunk.map((targetUserId: string) =>
                        sql`
                            INSERT INTO notifications (id, user_id, title, message, link, is_read, timestamp)
                            VALUES (${crypto.randomUUID()}, ${targetUserId}, ${title}, ${message}, ${link || null}, false, NOW())
                        `
                    ));
                }

                return res.status(200).json({ success: true, count: uniqueUserIds.length });
            }

            return res.status(400).json({ error: 'Unknown action specified' });
        } catch (error: any) {
            console.error('Error handling notification action:', error);
            return res.status(500).json({ error: error.message || 'Operation failed' });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
