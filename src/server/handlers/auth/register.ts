import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { getDb } from '../../_db';

export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }

    try {
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
        const { name, email, password, role } = body;

        if (!name || !email || !password || !role) {
            return res.status(400).json({ error: 'All fields (name, email, password, role) are required.' });
        }

        if (!['Teacher', 'Parent', 'Student'].includes(role)) {
            return res.status(403).json({ error: 'Registration is only permitted for Teacher, Parent, or Student roles.' });
        }

        const normalizedEmail = email.trim().toLowerCase();

        if (password.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
        }

        const sql = getDb();
        const ipHeader = req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress || '';
        const clientIp = typeof ipHeader === 'string' ? (ipHeader.split(',')[0].trim() || 'unknown') : 'unknown';
        const rateLimitKey = 'register:' + clientIp;

        // DB-backed rate limiting: 5 registration requests per hour per IP
        try {
            const attemptCountRows = await sql`
                SELECT COUNT(*)::int as count 
                FROM login_attempts 
                WHERE LOWER(email) = LOWER(${rateLimitKey}) 
                  AND attempted_at >= NOW() - INTERVAL '1 hour'
            `;
            const attempts = attemptCountRows?.[0]?.count || 0;
            if (attempts >= 5) {
                return res.status(429).json({
                    error: 'Too many registration requests. Please try again after one hour.'
                });
            }
        } catch (rlErr) {
            console.warn("Registration rate-limit check skipped due to DB error:", rlErr);
        }

        // Record attempt to enforce rate limiting
        try {
            await sql`INSERT INTO login_attempts (email, ip, attempted_at) VALUES (${rateLimitKey}, ${clientIp}, NOW())`;
            await sql`DELETE FROM login_attempts WHERE attempted_at < NOW() - INTERVAL '1 day'`;
        } catch (recordErr) {
            console.warn("Failed to record registration attempt:", recordErr);
        }

        const successMessage = 'Account registered successfully. An administrator must approve your account before you can log in.';

        const existing = await sql`SELECT id FROM profiles WHERE LOWER(email) = LOWER(${normalizedEmail}) LIMIT 1`;
        if (existing.length > 0) {
            // Return identical success response to prevent account enumeration
            return res.status(200).json({ success: true, message: successMessage });
        }

        // Query default/single school to associate the registered user with
        const schools = await sql`SELECT id, name FROM schools LIMIT 1`;
        const schoolId = schools.length > 0 ? schools[0].id : null;
        const schoolName = schools.length > 0 ? schools[0].name : 'Institution';

        const hashedPassword = await bcrypt.hash(password, 10);
        const userId = crypto.randomUUID();

        await sql`
            INSERT INTO profiles (id, name, email, password, role, school_id, status)
            VALUES (${userId}, ${name.trim()}, ${normalizedEmail}, ${hashedPassword}, ${role}, ${schoolId}, 'Pending Approval')
        `;

        // Send notifications to all Owners and Admins of this school
        try {
            const adminsAndOwners = schoolId
                ? await sql`SELECT id FROM profiles WHERE role IN ('Owner', 'Admin') AND (school_id = ${schoolId} OR school_id IS NULL) AND status = 'Active'`
                : await sql`SELECT id FROM profiles WHERE role IN ('Owner', 'Admin') AND status = 'Active'`;

            for (const admin of adminsAndOwners) {
                await sql`
                    INSERT INTO notifications (id, user_id, title, message, link, is_read, timestamp)
                    VALUES (
                        ${crypto.randomUUID()}, 
                        ${admin.id}, 
                        'New Account Registration', 
                        ${`${name.trim()} (${normalizedEmail}) has requested a ${role} account and is pending approval.`}, 
                        '/users', 
                        false, 
                        NOW()
                    )
                `;
            }
        } catch (notifErr) {
            console.warn('Failed to send registration notifications:', notifErr);
        }

        // Record activity log for audit
        try {
            await sql`
                INSERT INTO activity_logs (id, user_id, user_name, user_avatar, school_id, action, details, timestamp)
                VALUES (
                    ${crypto.randomUUID()}, 
                    ${userId}, 
                    ${name.trim()}, 
                    '', 
                    ${schoolId}, 
                    'Account Registration', 
                    ${`Self-registered as ${role} for ${schoolName} (Status: Pending Approval)`}, 
                    ${new Date().toISOString()}
                )
            `;
        } catch (logErr) {
            console.warn('Failed to insert registration activity log:', logErr);
        }

        return res.status(200).json({ success: true, message: successMessage });

    } catch (err: any) {
        console.error("Register API error:", err);
        return res.status(500).json({ error: 'Registration failed. Please try again.' });
    }
}
