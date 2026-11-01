import bcrypt from 'bcryptjs';
import { getDb, verifyToken, extractToken } from '../_db';

export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }

    try {
        const token = extractToken(req);
        if (!token) {
            return res.status(401).json({ error: 'Unauthorized: No active session' });
        }

        const payload = verifyToken(token);
        if (!payload || !payload.userId) {
            return res.status(401).json({ error: 'Unauthorized: Session invalid or expired' });
        }

        const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
        const { currentPassword, newPassword, targetUserId } = body;

        if (!newPassword || newPassword.length < 6) {
            return res.status(400).json({ error: 'New password must be at least 6 characters long.' });
        }

        const sql = getDb();

        // If targetUserId is provided and different from logged in user, only Owner or Admin can change it
        const userIdToUpdate = (targetUserId && targetUserId !== payload.userId) 
            ? targetUserId 
            : payload.userId;

        if (userIdToUpdate !== payload.userId && payload.role !== 'Owner' && payload.role !== 'Admin') {
            return res.status(403).json({ error: 'Forbidden: Insufficient permissions to change other user passwords' });
        }

        const users = await sql`
            SELECT id, password, role FROM profiles WHERE id = ${userIdToUpdate} LIMIT 1
        `;

        if (!users || users.length === 0) {
            return res.status(404).json({ error: 'User profile not found.' });
        }

        const targetUser = users[0];

        // If user is changing their own password, verify current password if supplied
        if (userIdToUpdate === payload.userId && currentPassword) {
            const storedHash = targetUser.password || '';
            let isCurrentValid = false;
            if (storedHash.startsWith('$2a$') || storedHash.startsWith('$2b$') || storedHash.startsWith('$2y$')) {
                isCurrentValid = await bcrypt.compare(currentPassword, storedHash);
            } else {
                isCurrentValid = (currentPassword === storedHash);
            }

            if (!isCurrentValid) {
                return res.status(400).json({ error: 'Current password is incorrect.' });
            }
        }

        // Hash the new password with bcrypt
        const hashedNewPassword = await bcrypt.hash(newPassword, 10);

        await sql`
            UPDATE profiles 
            SET password = ${hashedNewPassword} 
            WHERE id = ${userIdToUpdate}
        `;

        return res.status(200).json({
            success: true,
            message: 'Password updated successfully.'
        });

    } catch (err: any) {
        console.error("Change password error:", err);
        return res.status(500).json({ error: 'Internal server error changing password.' });
    }
}
