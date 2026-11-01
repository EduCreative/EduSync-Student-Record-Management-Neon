import { getDb, verifyToken, extractToken, toCamelCase } from '../_db';

export default async function handler(req: any, res: any) {
    if (req.method !== 'GET' && req.method !== 'POST') {
        res.setHeader('Allow', ['GET', 'POST']);
        return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }

    try {
        const token = extractToken(req);

        if (!token) {
            return res.status(401).json({ user: null, error: 'No active session found' });
        }

        const payload = verifyToken(token);
        if (!payload || !payload.userId) {
            return res.status(401).json({ user: null, error: 'Session expired or invalid' });
        }

        const sql = getDb();
        const users = await sql`
            SELECT id, school_id, name, email, role, status, 
                   avatar_url, child_student_ids, disabled_nav_links, permissions_overrides, last_login
            FROM profiles 
            WHERE id = ${payload.userId} 
            LIMIT 1
        `;

        if (!users || users.length === 0) {
            return res.status(401).json({ user: null, error: 'User not found' });
        }

        const user = users[0];

        if (user.status === 'Suspended' || user.status === 'Inactive') {
            return res.status(403).json({ user: null, error: 'Account suspended or inactive' });
        }

        // Return user profile without password
        const safeUser = toCamelCase(user);

        return res.status(200).json({
            user: safeUser
        });

    } catch (err: any) {
        console.error("Auth me API error:", err);
        return res.status(500).json({ user: null, error: 'Failed to verify session' });
    }
}
