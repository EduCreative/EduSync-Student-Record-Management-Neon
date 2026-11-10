import { verifySession, isAuthorized, writeServerAuditLog, requireSameSchool, validateAvatarDataUrl } from './_helpers';
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

            if (password.length < 8) {
                return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
            }

            if (avatarUrl) {
                const avatarCheck = validateAvatarDataUrl(avatarUrl);
                if (!avatarCheck.valid) {
                    return res.status(400).json({ error: avatarCheck.error });
                }
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
            const avatarUrlToInsert = (avatarUrl && typeof avatarUrl === 'string' && avatarUrl.startsWith('data:'))
                ? avatarUrl
                : null;

            try {
                await sql`
                    INSERT INTO profiles (id, name, email, password, role, school_id, status, avatar_url)
                    VALUES (${id}, ${name}, ${email.toLowerCase().trim()}, ${hashedPassword}, ${role}, ${effectiveSchoolId}, 'Active', ${avatarUrlToInsert})
                `;
            } catch (err: any) {
                if (err?.code === '23505' || err?.message?.includes('23505') || err?.message?.includes('profiles_email_key')) {
                    return res.status(409).json({ error: 'Email already exists', message: `A user with email "${email}" already exists.` });
                }
                throw err;
            }

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

            if (avatarUrl) {
                const avatarCheck = validateAvatarDataUrl(avatarUrl);
                if (!avatarCheck.valid) {
                    return res.status(400).json({ error: avatarCheck.error });
                }
            }

            await sql`
                UPDATE profiles 
                SET name = ${name}, 
                    avatar_url = CASE 
                        WHEN ${Boolean(avatarUrl && typeof avatarUrl === 'string' && avatarUrl.startsWith('/api/photo'))} THEN avatar_url
                        WHEN ${Boolean(avatarUrl && typeof avatarUrl === 'string' && avatarUrl.startsWith('data:'))} THEN ${avatarUrl}
                        WHEN ${avatarUrl === null || avatarUrl === ''} THEN NULL
                        ELSE avatar_url
                    END,
                    status = ${status || 'Active'}
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

            // P10: Validate all rows and detect duplicates in payload first
            const seenEmails = new Set<string>();
            const duplicateEmailsInFile: string[] = [];
            for (const u of users) {
                const cleanEmail = (u.email || '').toLowerCase().trim();
                if (cleanEmail) {
                    if (seenEmails.has(cleanEmail)) {
                        duplicateEmailsInFile.push(cleanEmail);
                    }
                    seenEmails.add(cleanEmail);
                }
            }

            if (duplicateEmailsInFile.length > 0) {
                const uniqueDupes = Array.from(new Set(duplicateEmailsInFile));
                return res.status(400).json({ error: `Duplicate email(s) found in payload: ${uniqueDupes.join(', ')}` });
            }

            // Validate fields, roles, and hash all passwords BEFORE writing to DB (P10)
            const preparedUsers: any[] = [];
            for (let i = 0; i < users.length; i++) {
                const u = users[i];
                if (!u.name || !u.email || !u.password || !u.role) {
                    return res.status(400).json({ error: `Name, email, password, and role are required for all users (row ${i + 1} is missing required fields).` });
                }
                if (typeof u.password !== 'string' || u.password.length < 8) {
                    return res.status(400).json({ error: `Password for user '${u.email}' (row ${i + 1}) must be at least 8 characters long.` });
                }
                const avUrl = u.avatarUrl || u.avatar_url;
                if (avUrl) {
                    const avatarCheck = validateAvatarDataUrl(avUrl);
                    if (!avatarCheck.valid) {
                        return res.status(400).json({ error: `User '${u.email}' (row ${i + 1}): ${avatarCheck.error}` });
                    }
                }
                if (session.role === 'Admin') {
                    if (!['Accountant', 'Teacher', 'Parent', 'Student'].includes(u.role)) {
                        return res.status(403).json({ error: `Admin may create only Accountant, Teacher, Parent, or Student accounts (found '${u.role}' at row ${i + 1}).` });
                    }
                } else if (session.role === 'Owner') {
                    if (!['Owner', 'Admin', 'Accountant', 'Teacher', 'Parent', 'Student'].includes(u.role)) {
                        return res.status(400).json({ error: `Invalid role specified for user '${u.email}' at row ${i + 1}.` });
                    }
                }

                const hashedPassword = await bcrypt.hash(u.password, 10);
                preparedUsers.push({
                    id: crypto.randomUUID(),
                    name: u.name.trim(),
                    email: u.email.toLowerCase().trim(),
                    password: hashedPassword,
                    role: u.role,
                    avatarUrl: u.avatarUrl || u.avatar_url || null
                });
            }

            // Insert in one atomic sql.transaction (P10)
            const queries = preparedUsers.map(u => sql`
                INSERT INTO profiles (id, name, email, password, role, school_id, status, avatar_url)
                VALUES (${u.id}, ${u.name}, ${u.email}, ${u.password}, ${u.role}, ${effectiveSchoolId}, 'Active', ${u.avatarUrl})
            `);

            try {
                await sql.transaction(queries);
            } catch (err: any) {
                if (err?.code === '23505' || err?.message?.includes('23505') || err?.message?.includes('profiles_email_key')) {
                    const match = err?.detail?.match(/Key \(email\)=\(([^)]+)\)/);
                    const conflictedEmail = match ? match[1] : 'duplicate email';
                    return res.status(409).json({ error: `Email "${conflictedEmail}" already exists. No users were created.`, email: conflictedEmail });
                }
                throw err;
            }

            await writeServerAuditLog(
                sql,
                session,
                'Bulk Import Users',
                `Bulk created ${preparedUsers.length} user accounts`,
                effectiveSchoolId
            );

            return res.status(200).json({ success: true, count: preparedUsers.length });

        // School operations
        } else if (action === 'add-school') {
            return res.status(403).json({ error: 'Single-school installation: Adding additional schools is disabled.' });

        } else if (action === 'update-school') {
            if (!isAuthorized(session, ['Owner', 'Admin'])) {
                return res.status(403).json({ error: 'Access denied: Only Owner or Admin can update institution profile.' });
            }

            const { id, name, address, logoUrl } = body;
            if (!id) {
                return res.status(400).json({ error: 'School ID is required.' });
            }

            if (logoUrl) {
                const logoCheck = validateAvatarDataUrl(logoUrl);
                if (!logoCheck.valid) {
                    return res.status(400).json({ error: logoCheck.error });
                }
            }

            const schools = await sql`SELECT id FROM schools WHERE id = ${id} LIMIT 1`;
            if (!schools || schools.length === 0) {
                return res.status(404).json({ error: 'School not found.' });
            }

            if (!requireSameSchool(session, id)) {
                return res.status(403).json({ error: 'Access denied: Cannot update school outside jurisdiction.' });
            }

            await sql`UPDATE schools SET name = ${name}, address = ${address || ''}, logo_url = ${logoUrl || null} WHERE id = ${id}`;
            await writeServerAuditLog(sql, session, 'Update School', `Updated institution profile: ${name}`, id);
            return res.status(200).json({ success: true });

        } else if (action === 'delete-school') {
            return res.status(403).json({ error: 'Single-school installation: Deleting the school institution is disabled.' });

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
