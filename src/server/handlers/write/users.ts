import { verifySession, isAuthorized, writeServerAuditLog, requireSameSchool } from './_helpers';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }

    const auth = await verifySession(req, res);
    if (!auth) return;
    const { session, sql } = auth;

    try {
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
        const { action } = body;

        // User Management (Owner, Admin)
        if (action === 'add-user') {
            if (!isAuthorized(session, ['Owner', 'Admin'])) {
                return res.status(403).json({ error: 'Access denied: Cannot create user accounts.' });
            }

            const { name, email, password, role, schoolId, avatarUrl } = body;
            if (!name || !email || !password || !role) {
                return res.status(400).json({ error: 'Name, email, password, and role are required.' });
            }

            if (session.role === 'Admin') {
                if (!['Accountant', 'Teacher', 'Parent', 'Student'].includes(role)) {
                    return res.status(403).json({ error: 'Admin may create only Accountant, Teacher, Parent, or Student accounts.' });
                }
            } else if (session.role === 'Owner') {
                if (!['Owner', 'Admin', 'Accountant', 'Teacher', 'Parent', 'Student'].includes(role)) {
                    return res.status(400).json({ error: 'Invalid role specified.' });
                }
            }

            const effectiveSchoolId = session.role === 'Admin' ? session.schoolId : (session.role === 'Owner' && schoolId ? schoolId : session.schoolId);

            // Security fix: Hash password with bcrypt before inserting
            const saltRounds = 10;
            const hashedPassword = await bcrypt.hash(password, saltRounds);
            const id = crypto.randomUUID();

            await sql`
                INSERT INTO profiles (id, name, email, password, role, school_id, status, avatar_url)
                VALUES (${id}, ${name}, ${email.toLowerCase().trim()}, ${hashedPassword}, ${role}, ${effectiveSchoolId}, 'Active', ${avatarUrl || null})
            `;

            await writeServerAuditLog(
                sql,
                session,
                'Add User',
                `Created ${role} account for ${name} (${email})`,
                effectiveSchoolId
            );

            return res.status(200).json({ success: true, id });

        } else if (action === 'update-user') {
            if (!isAuthorized(session, ['Owner', 'Admin'])) {
                return res.status(403).json({ error: 'Access denied: Cannot update user accounts.' });
            }

            const { id, name, avatarUrl, status } = body;
            if (!id) {
                return res.status(400).json({ error: 'User ID is required.' });
            }

            const targetUsers = await sql`SELECT id, role, school_id FROM profiles WHERE id = ${id} LIMIT 1`;
            if (!targetUsers || targetUsers.length === 0) {
                return res.status(404).json({ error: 'User not found.' });
            }
            const targetUser = targetUsers[0];

            if (targetUser.role === 'Owner' && session.role !== 'Owner') {
                return res.status(403).json({ error: 'Access denied: Admin cannot touch an Owner account.' });
            }

            if (!requireSameSchool(session, targetUser.school_id)) {
                return res.status(403).json({ error: 'Access denied: Cannot update user from another school.' });
            }

            await sql`
                UPDATE profiles 
                SET name = ${name}, avatar_url = ${avatarUrl || null}, status = ${status || 'Active'}
                WHERE id = ${id}
            `;

            return res.status(200).json({ success: true });

        } else if (action === 'delete-user') {
            if (!isAuthorized(session, ['Owner', 'Admin'])) {
                return res.status(403).json({ error: 'Access denied: Cannot deactivate user accounts.' });
            }

            const { userId } = body;
            if (!userId) {
                return res.status(400).json({ error: 'User ID is required.' });
            }

            const targetUserResult = await sql`SELECT id, role, school_id FROM profiles WHERE id = ${userId} LIMIT 1`;
            if (!targetUserResult || targetUserResult.length === 0) {
                return res.status(404).json({ error: 'User not found.' });
            }
            const targetUser = targetUserResult[0];

            // Cannot deactivate Owner
            if (targetUser.role === 'Owner') {
                return res.status(400).json({ error: 'Cannot deactivate an Owner account.' });
            }
            if (targetUser.role === 'Admin' && session.role !== 'Owner') {
                // Admin cannot touch Owner
            }

            if (!requireSameSchool(session, targetUser.school_id)) {
                return res.status(403).json({ error: 'Access denied: Cannot deactivate user from another school.' });
            }

            await sql`UPDATE profiles SET status = 'Inactive' WHERE id = ${userId}`;

            await writeServerAuditLog(
                sql,
                session,
                'Deactivate User',
                `Deactivated account for user ID ${userId}`
            );

            return res.status(200).json({ success: true });

        } else if (action === 'bulk-add-users') {
            if (!isAuthorized(session, ['Owner', 'Admin'])) {
                return res.status(403).json({ error: 'Access denied: Cannot bulk import user accounts.' });
            }

            const { users, schoolId } = body;
            if (!Array.isArray(users) || users.length === 0) {
                return res.status(400).json({ error: 'Users array is required.' });
            }

            const effectiveSchoolId = session.role === 'Admin' ? session.schoolId : (session.role === 'Owner' && schoolId ? schoolId : session.schoolId);

            for (const u of users) {
                if (!u.password) {
                    return res.status(400).json({ error: `Password is required for user ${u.email || u.name || 'unknown'}.` });
                }
                if (!u.role) {
                    return res.status(400).json({ error: `Role is required for user ${u.email || u.name || 'unknown'}.` });
                }
                if (session.role === 'Admin') {
                    if (!['Accountant', 'Teacher', 'Parent', 'Student'].includes(u.role)) {
                        return res.status(403).json({ error: 'Admin may create only Accountant, Teacher, Parent, or Student accounts.' });
                    }
                } else if (session.role === 'Owner') {
                    if (!['Owner', 'Admin', 'Accountant', 'Teacher', 'Parent', 'Student'].includes(u.role)) {
                        return res.status(400).json({ error: `Invalid role specified for user ${u.email || u.name || 'unknown'}.` });
                    }
                }
                const id = crypto.randomUUID();
                const hashedPassword = await bcrypt.hash(u.password, 10);
                await sql`
                    INSERT INTO profiles (id, name, email, password, role, school_id, status, avatar_url)
                    VALUES (${id}, ${u.name}, ${u.email.toLowerCase().trim()}, ${hashedPassword}, ${u.role}, ${effectiveSchoolId}, 'Active', ${u.avatarUrl || u.avatar_url || null})
                `;
            }

            return res.status(200).json({ success: true, count: users.length });

        // School operations (Owner only)
        } else if (action === 'add-school') {
            if (session.role !== 'Owner') {
                return res.status(403).json({ error: 'Only Owner can create schools.' });
            }

            const { name, address, logoUrl } = body;
            const id = crypto.randomUUID();
            await sql`INSERT INTO schools (id, name, address, logo_url) VALUES (${id}, ${name}, ${address || ''}, ${logoUrl || null})`;
            return res.status(200).json({ success: true, id });

        } else if (action === 'update-school') {
            if (session.role !== 'Owner') {
                return res.status(403).json({ error: 'Only Owner can edit schools.' });
            }

            const { id, name, address, logoUrl } = body;
            if (!id) {
                return res.status(400).json({ error: 'School ID is required.' });
            }

            const schools = await sql`SELECT id FROM schools WHERE id = ${id} LIMIT 1`;
            if (!schools || schools.length === 0) {
                return res.status(404).json({ error: 'School not found.' });
            }

            if (!requireSameSchool(session, id)) {
                return res.status(403).json({ error: 'Access denied: Cannot update school outside jurisdiction.' });
            }

            await sql`UPDATE schools SET name = ${name}, address = ${address || ''}, logo_url = ${logoUrl || null} WHERE id = ${id}`;
            return res.status(200).json({ success: true });

        } else if (action === 'delete-school') {
            if (session.role !== 'Owner') {
                return res.status(403).json({ error: 'Only Owner can delete schools.' });
            }

            const { id } = body;
            await sql`DELETE FROM schools WHERE id = ${id}`;
            return res.status(200).json({ success: true });

        } else if (action === 'add-log') {
            if (!isAuthorized(session, ['Owner', 'Admin', 'Accountant'])) {
                return res.status(403).json({ error: 'Access denied: Cannot add system logs.' });
            }
            const { actionName, details, schoolId } = body;
            const effectiveSchoolId = session.role === 'Owner' && schoolId ? schoolId : session.schoolId;
            await writeServerAuditLog(sql, session, actionName || 'Action', details || '', effectiveSchoolId);
            return res.status(200).json({ success: true });

        } else {
            return res.status(400).json({ error: `Unknown action: ${action}` });
        }

    } catch (err: any) {
        console.error("Users/Schools API error:", err);
        return res.status(500).json({ error: err.message || 'Server error updating users/schools.' });
    }
}
