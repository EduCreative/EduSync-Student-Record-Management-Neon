import { getDb, getSessionUser, toCamelCase } from '../../_db';

export default async function handler(req: any, res: any) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', ['GET']);
        return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }

    try {
        const session = await getSessionUser(req, res);
        if (!session) {
            return res.status(401).json({ error: 'Unauthorized: Session invalid or expired' });
        }

        const sql = getDb();
        const { role, schoolId } = session;
        const requestedSchoolId = req.query?.schoolId;

        // Parents and Students are not allowed to view other user profiles
        if (role === 'Parent' || role === 'Student') {
            return res.status(200).json({ users: [] });
        }

        let users: any[] = [];

        const isLocked = Boolean(role !== 'Owner' && session.branchId);

        if (role === 'Owner') {
            const effectiveSchoolId = requestedSchoolId || null;
            users = effectiveSchoolId
                ? await sql`
                    SELECT id, school_id, branch_id, name, email, role, status, 
                           (avatar_url IS NOT NULL AND avatar_url <> '') AS has_avatar, 
                           length(avatar_url) AS avatar_len, 
                           child_student_ids, disabled_nav_links, permissions_overrides, last_login 
                    FROM profiles 
                    WHERE school_id = ${effectiveSchoolId} OR school_id IS NULL
                    ORDER BY name ASC
                  `
                : await sql`
                    SELECT id, school_id, branch_id, name, email, role, status, 
                           (avatar_url IS NOT NULL AND avatar_url <> '') AS has_avatar, 
                           length(avatar_url) AS avatar_len, 
                           child_student_ids, disabled_nav_links, permissions_overrides, last_login 
                    FROM profiles 
                    ORDER BY name ASC
                  `;
        } else if (role === 'Admin' || role === 'Accountant') {
            users = isLocked
                ? await sql`
                    SELECT id, school_id, branch_id, name, email, role, status, 
                           (avatar_url IS NOT NULL AND avatar_url <> '') AS has_avatar, 
                           length(avatar_url) AS avatar_len, 
                           child_student_ids, disabled_nav_links, permissions_overrides, last_login 
                    FROM profiles 
                    WHERE (school_id = ${schoolId} OR school_id IS NULL) 
                      AND branch_id = ${session.branchId} 
                      AND role != 'Owner'
                    ORDER BY name ASC
                  `
                : await sql`
                    SELECT id, school_id, branch_id, name, email, role, status, 
                           (avatar_url IS NOT NULL AND avatar_url <> '') AS has_avatar, 
                           length(avatar_url) AS avatar_len, 
                           child_student_ids, disabled_nav_links, permissions_overrides, last_login 
                    FROM profiles 
                    WHERE (school_id = ${schoolId} OR school_id IS NULL) AND role != 'Owner'
                    ORDER BY name ASC
                  `;
        } else if (role === 'Teacher') {
            // Teachers only see colleagues in their school
            users = isLocked
                ? await sql`
                    SELECT id, school_id, branch_id, name, email, role, status, 
                           (avatar_url IS NOT NULL AND avatar_url <> '') AS has_avatar, 
                           length(avatar_url) AS avatar_len, 
                           last_login 
                    FROM profiles 
                    WHERE school_id = ${schoolId} 
                      AND branch_id = ${session.branchId}
                      AND role IN ('Admin', 'Accountant', 'Teacher')
                    ORDER BY name ASC
                  `
                : await sql`
                    SELECT id, school_id, branch_id, name, email, role, status, 
                           (avatar_url IS NOT NULL AND avatar_url <> '') AS has_avatar, 
                           length(avatar_url) AS avatar_len, 
                           last_login 
                    FROM profiles 
                    WHERE school_id = ${schoolId} AND role IN ('Admin', 'Accountant', 'Teacher')
                    ORDER BY name ASC
                  `;
        }

        const transformed = toCamelCase(users).map((u: any) => ({
            ...u,
            avatarUrl: u.hasAvatar ? `/api/photo?kind=user&id=${u.id}&v=${u.avatarLen || 0}` : null
        }));
        return res.status(200).json({ users: transformed });
    } catch (err: any) {
        console.error("Users read API error:", err);
        return res.status(500).json({ error: 'Failed to read users from database.' });
    }
}
