import { getDb, getSessionUser } from '../_db';
import crypto from 'crypto';

export default async function handler(req: any, res: any) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', ['GET']);
        return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }

    try {
        const session = await getSessionUser(req, res);
        if (!session) {
            return res.status(401).json({ error: 'Unauthorized: Session required' });
        }

        const { kind, id } = req.query || {};

        if (!kind || !id || typeof id !== 'string') {
            return res.status(400).json({ error: 'Parameters "kind" (student|user) and "id" are required.' });
        }

        if (kind !== 'student' && kind !== 'user') {
            return res.status(400).json({ error: 'Parameter "kind" must be "student" or "user".' });
        }

        const sql = getDb();
        const { role, userId, schoolId } = session;
        let rawAvatar: string | null = null;

        if (kind === 'user') {
            // Any user can fetch their own avatar
            if (userId === id) {
                const rows = await sql`SELECT avatar_url FROM profiles WHERE id = ${id} LIMIT 1`;
                if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
                rawAvatar = rows[0].avatar_url;
            } else if (role === 'Owner') {
                const rows = await sql`SELECT avatar_url FROM profiles WHERE id = ${id} LIMIT 1`;
                if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
                rawAvatar = rows[0].avatar_url;
            } else if (role === 'Admin' || role === 'Accountant' || role === 'Teacher') {
                // Staff can only view users in their own school
                const rows = await sql`SELECT school_id, avatar_url FROM profiles WHERE id = ${id} LIMIT 1`;
                if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
                if (rows[0].school_id && rows[0].school_id !== schoolId) {
                    return res.status(403).json({ error: 'Forbidden: User belongs to another institution' });
                }
                rawAvatar = rows[0].avatar_url;
            } else {
                // Parents and Students cannot view avatars of other arbitrary users
                return res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
            }
        } else if (kind === 'student') {
            if (role === 'Owner') {
                const rows = await sql`SELECT avatar_url FROM students WHERE id = ${id} LIMIT 1`;
                if (rows.length === 0) return res.status(404).json({ error: 'Student not found' });
                rawAvatar = rows[0].avatar_url;
            } else if (role === 'Admin' || role === 'Accountant' || role === 'Teacher') {
                // Staff only for their own school's students
                const rows = await sql`SELECT school_id, avatar_url FROM students WHERE id = ${id} LIMIT 1`;
                if (rows.length === 0) return res.status(404).json({ error: 'Student not found' });
                if (rows[0].school_id !== schoolId) {
                    return res.status(403).json({ error: 'Forbidden: Student belongs to another institution' });
                }
                rawAvatar = rows[0].avatar_url;
            } else if (role === 'Student') {
                // Student only for themselves
                const rows = await sql`SELECT user_id, avatar_url FROM students WHERE id = ${id} LIMIT 1`;
                if (rows.length === 0) return res.status(404).json({ error: 'Student not found' });
                if (rows[0].user_id !== userId) {
                    return res.status(403).json({ error: 'Forbidden: Students may only view their own avatar' });
                }
                rawAvatar = rows[0].avatar_url;
            } else if (role === 'Parent') {
                // Parent only for their own children
                const parentProfile = await sql`SELECT child_student_ids FROM profiles WHERE id = ${userId} LIMIT 1`;
                let childIds: string[] = [];
                if (parentProfile.length > 0) {
                    const p = parentProfile[0];
                    if (Array.isArray(p.child_student_ids)) childIds = p.child_student_ids;
                    else if (typeof p.child_student_ids === 'string') {
                        try { childIds = JSON.parse(p.child_student_ids); } catch { childIds = []; }
                    }
                }
                if (!childIds.includes(id)) {
                    return res.status(403).json({ error: 'Forbidden: Student is not linked to parent' });
                }
                const rows = await sql`SELECT avatar_url FROM students WHERE id = ${id} LIMIT 1`;
                if (rows.length === 0) return res.status(404).json({ error: 'Student not found' });
                rawAvatar = rows[0].avatar_url;
            } else {
                return res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
            }
        }

        if (!rawAvatar || typeof rawAvatar !== 'string' || rawAvatar.trim() === '') {
            return res.status(404).json({ error: 'No avatar found' });
        }

        let mimeType = 'image/jpeg';
        let buffer: Buffer;

        if (rawAvatar.startsWith('data:')) {
            const commaIndex = rawAvatar.indexOf(',');
            if (commaIndex === -1) {
                return res.status(400).json({ error: 'Invalid image data' });
            }
            const meta = rawAvatar.slice(0, commaIndex);
            const mimeMatch = meta.match(/data:([^;]+)/);
            if (mimeMatch && mimeMatch[1]) {
                mimeType = mimeMatch[1];
            }
            const base64Data = rawAvatar.slice(commaIndex + 1);
            buffer = Buffer.from(base64Data, 'base64');
        } else {
            buffer = Buffer.from(rawAvatar, 'base64');
        }

        const hash = crypto.createHash('md5').update(buffer).digest('hex');
        const etag = `"${hash}"`;

        if (req.headers['if-none-match'] === etag) {
            return res.status(304).end();
        }

        res.setHeader('Content-Type', mimeType);
        res.setHeader('Content-Length', buffer.length.toString());
        res.setHeader('Cache-Control', 'private, max-age=86400');
        res.setHeader('ETag', etag);

        return res.status(200).send(buffer);

    } catch (err: any) {
        console.error("Photo endpoint error:", err);
        return res.status(500).json({ error: 'Failed to retrieve photo.' });
    }
}
