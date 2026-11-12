import { getDb, getSessionUser } from '../../_db';
import { isBranchLocked } from '../write/_helpers';
import crypto from 'crypto';

export default async function handler(req: any, res: any) {
    const session = await getSessionUser(req, res);
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

                // Restrict recipients to the caller's school and branch if locked
                const recipientRows = isBranchLocked(session)
                    ? await sql`
                        SELECT p.id FROM profiles p
                        WHERE p.id = ANY(${uniqueUserIds})
                          AND p.school_id = ${session.schoolId}
                          AND (
                            p.branch_id = ${session.branchId}
                            OR EXISTS (
                              SELECT 1 FROM students s
                              JOIN classes c ON s.class_id = c.id
                              WHERE s.id = ANY(p.child_student_ids)
                                AND c.branch_id = ${session.branchId}
                            )
                          )
                      `
                    : await sql`
                        SELECT id FROM profiles
                        WHERE id = ANY(${uniqueUserIds})
                          AND (${session.role === 'Owner'}::boolean OR school_id = ${session.schoolId || null}::uuid)
                      `;

                const scopedUserIds: string[] = recipientRows.map((r: any) => r.id);
                if (scopedUserIds.length === 0) {
                    return res.status(403).json({ error: 'Outside your branch' });
                }

                const CHUNK_SIZE = 25;

                for (let i = 0; i < scopedUserIds.length; i += CHUNK_SIZE) {
                    const chunk = scopedUserIds.slice(i, i + CHUNK_SIZE);
                    await Promise.all(chunk.map((targetUserId: string) =>
                        sql`
                            INSERT INTO notifications (id, user_id, title, message, link, is_read, timestamp)
                            VALUES (${crypto.randomUUID()}, ${targetUserId}, ${title}, ${message}, ${link || null}, false, NOW())
                        `
                    ));
                }

                return res.status(200).json({ 
                    success: true, 
                    count: scopedUserIds.length,
                    skipped: uniqueUserIds.length - scopedUserIds.length
                });
            }

            return res.status(400).json({ error: 'Unknown action specified' });
        } catch (error: any) {
            console.error('Error handling notification action:', error);
            return res.status(500).json({ error: error.message || 'Operation failed' });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
