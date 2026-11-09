import bcrypt from 'bcryptjs';
import { verifySession, writeServerAuditLog } from '../write/_helpers';

export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }

    try {
        const auth = await verifySession(req, res);
        if (!auth) return;
        const { session, sql } = auth;

        const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
        const { currentPassword, newPassword, targetUserId } = body;

        if (!newPassword || newPassword.length < 8) {
            return res.status(400).json({ error: 'New password must be at least 8 characters long.' });
        }

        const userIdToUpdate = (targetUserId && targetUserId !== session.userId) 
            ? targetUserId 
            : session.userId;

        const isSelf = (userIdToUpdate === session.userId);

        const users = await sql`
            SELECT id, password, role, school_id FROM profiles WHERE id = ${userIdToUpdate} LIMIT 1
        `;

        if (!users || users.length === 0) {
            return res.status(404).json({ error: 'User profile not found.' });
        }

        const targetUser = users[0];

        // Nobody may reset an Owner's password except that Owner
        if (targetUser.role === 'Owner' && !isSelf) {
            return res.status(403).json({ error: 'Forbidden: Nobody may reset an Owner password except that Owner.' });
        }

        if (!isSelf) {
            if (session.role === 'Owner') {
                if (targetUser.role === 'Owner') {
                    return res.status(403).json({ error: 'Forbidden: Owner cannot reset another Owner password.' });
                }
            } else if (session.role === 'Admin') {
                if (targetUser.school_id !== session.schoolId) {
                    return res.status(403).json({ error: 'Forbidden: Admin can only reset passwords for users in their own school.' });
                }
                const rolesBelowAdmin = ['Accountant', 'Teacher', 'Parent', 'Student'];
                if (!rolesBelowAdmin.includes(targetUser.role)) {
                    return res.status(403).json({ error: 'Forbidden: Admin can only reset passwords for users with a role below Admin.' });
                }
            } else {
                return res.status(403).json({ error: 'Forbidden: Insufficient permissions to change other user passwords' });
            }
        }

        // Changing your own password requires currentPassword (reject if missing)
        if (isSelf) {
            if (!currentPassword) {
                return res.status(400).json({ error: 'Current password is required.' });
            }
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

        await writeServerAuditLog(
            sql,
            session,
            isSelf ? 'Change Password' : 'Reset Password',
            isSelf ? 'User changed their own password' : `Reset password for user ID ${userIdToUpdate} (${targetUser.role})`,
            targetUser.school_id
        );

        return res.status(200).json({
            success: true,
            message: 'Password updated successfully.'
        });

    } catch (err: any) {
        console.error("Change password error:", err);
        return res.status(500).json({ error: 'Internal server error changing password.' });
    }
}
