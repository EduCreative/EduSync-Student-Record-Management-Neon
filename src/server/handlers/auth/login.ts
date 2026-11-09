import bcrypt from 'bcryptjs';
import { getDb, signToken, setSessionCookie, toCamelCase } from '../../_db';

export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }

    try {
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
        const email = (body.email || '').trim().toLowerCase();
        const password = body.password || body.pass || '';

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required.' });
        }

        const sql = getDb();
        const ipHeader = req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress || '';
        const clientIp = typeof ipHeader === 'string' ? (ipHeader.split(',')[0].trim() || null) : null;

        // DB-backed rate limiting: 5 failed attempts per email per 15 minutes
        try {
            const attemptCountRows = await sql`
                SELECT COUNT(*)::int as count 
                FROM login_attempts 
                WHERE LOWER(email) = LOWER(${email}) 
                  AND attempted_at >= NOW() - INTERVAL '15 minutes'
            `;
            const failedCount = attemptCountRows?.[0]?.count || 0;
            if (failedCount >= 5) {
                return res.status(429).json({
                    error: 'Too many failed login attempts. Please try again after 15 minutes.'
                });
            }
        } catch (rlErr) {
            console.warn("Rate-limit check skipped due to DB error:", rlErr);
        }

        const users = await sql`
            SELECT id, school_id, name, email, password, role, status, 
                   avatar_url, child_student_ids, disabled_nav_links, permissions_overrides, last_login
            FROM profiles 
            WHERE LOWER(email) = LOWER(${email}) 
            LIMIT 1
        `;

        if (!users || users.length === 0) {
            try {
                await sql`INSERT INTO login_attempts (email, ip, attempted_at) VALUES (${email}, ${clientIp}, NOW())`;
                await sql`DELETE FROM login_attempts WHERE attempted_at < NOW() - INTERVAL '1 day'`;
            } catch {}
            return res.status(401).json({ error: 'Invalid email or password.' });
        }

        const user = users[0];

        // Strict bcrypt password verification first (prevents account status enumeration)
        const storedPassword = user.password || '';
        const isBcrypt = storedPassword.startsWith('$2a$') || storedPassword.startsWith('$2b$') || storedPassword.startsWith('$2y$');
        let isMatch = false;

        if (isBcrypt) {
            isMatch = await bcrypt.compare(password, storedPassword);
        }

        if (!isMatch) {
            try {
                await sql`INSERT INTO login_attempts (email, ip, attempted_at) VALUES (${email}, ${clientIp}, NOW())`;
                await sql`DELETE FROM login_attempts WHERE attempted_at < NOW() - INTERVAL '1 day'`;
            } catch {}
            return res.status(401).json({ error: 'Invalid email or password.' });
        }

        // Status checks only after password is authenticated
        if (user.status === 'Pending Approval' || user.status === 'Pending') {
            return res.status(403).json({ error: 'Your account is pending approval by administration.' });
        }

        if (user.status === 'Suspended' || user.status === 'Inactive') {
            return res.status(403).json({ error: 'Your account is inactive or suspended. Please contact administration.' });
        }

        if (user.status !== 'Active') {
            return res.status(403).json({ error: 'Your account is not active. Please contact administration.' });
        }

        // Successful login: delete failed attempts for this email
        try {
            await sql`DELETE FROM login_attempts WHERE LOWER(email) = LOWER(${email})`;
        } catch {}

        // Update last login
        try {
            await sql`UPDATE profiles SET last_login = NOW() WHERE id = ${user.id}`;
        } catch (loginTimeErr) {
            console.error("Failed to update last_login:", loginTimeErr);
        }

        // Issue JWT token (12h expiration)
        const tokenPayload = {
            userId: user.id,
            email: user.email,
            role: user.role,
            schoolId: user.school_id || null,
            name: user.name || '',
            avatarUrl: user.avatar_url || ''
        };
        const token = signToken(tokenPayload);

        // Set httpOnly, Lax cookie
        setSessionCookie(res, token);

        // Never return password to client
        const { password: _p, ...safeUserData } = user;
        const safeUser = toCamelCase(safeUserData);

        return res.status(200).json({
            success: true,
            user: safeUser
        });

    } catch (err: any) {
        console.error("Login API error:", err);
        return res.status(500).json({ error: 'Server authentication error. Please try again.' });
    }
}
