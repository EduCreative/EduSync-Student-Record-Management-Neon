import { authenticateRequest, getDb, serializeCookie, COOKIE_NAME, TokenPayload } from '../../_db';
import crypto from 'crypto';

export type UserRoleType = 'Owner' | 'Admin' | 'Accountant' | 'Teacher' | 'Parent' | 'Student';

export interface AuthenticatedContext {
    sql: ReturnType<typeof getDb>;
    session: TokenPayload;
    userSchoolId: string | null;
}

export async function verifySession(req: any, res: any): Promise<{ session: TokenPayload; sql: ReturnType<typeof getDb> } | null> {
    const session = authenticateRequest(req);
    if (!session) {
        res.status(401).json({ error: 'Unauthorized: Valid session required.' });
        return null;
    }
    const sql = getDb();
    try {
        console.log("verifySession userId:", session.userId);
        const users = await sql`SELECT status FROM profiles WHERE id = ${session.userId} LIMIT 1`;
        console.log("verifySession user status check result:", users);
        if (!users || users.length === 0 || (users[0].status && (users[0].status === 'Inactive' || users[0].status === 'Suspended'))) {
            console.log("verifySession status check failed, clearing cookie");
            res.setHeader('Set-Cookie', serializeCookie(COOKIE_NAME, '', { maxAge: 0, path: '/' }));
            res.status(401).json({ error: 'Unauthorized: Account is inactive or suspended.' });
            return null;
        }
    } catch (err) {
        console.error("verifySession status check error:", err);
        res.status(401).json({ error: 'Unauthorized: Session validation failed.' });
        return null;
    }
    return { session, sql };
}

export function requireSameSchool(session: TokenPayload, recordSchoolId: string | null | undefined): boolean {
    if (session.role === 'Owner') {
        return true;
    }
    if (!session.schoolId || !recordSchoolId) {
        return false;
    }
    return recordSchoolId === session.schoolId;
}

export function isAuthorized(
    session: TokenPayload,
    allowedRoles: string[],
    targetSchoolId?: string | null
): boolean {
    if (session.role !== 'Owner' && !session.schoolId) {
        return false;
    }

    if (session.role === 'Owner') {
        return true;
    }

    if (!allowedRoles.includes(session.role)) {
        return false;
    }

    // If targetSchoolId is specified, ensure user's school matches targetSchoolId
    if (targetSchoolId && session.schoolId && session.schoolId !== targetSchoolId) {
        return false;
    }

    return true;
}

export async function writeServerAuditLog(
    sql: any,
    session: TokenPayload,
    action: string,
    details: string,
    schoolId?: string | null
) {
    try {
        const id = crypto.randomUUID();
        const effectiveSchoolId = schoolId || session.schoolId || null;
        const userName = session.name || session.email.split('@')[0];
        const userAvatar = session.avatarUrl || '';
        
        await sql`
            INSERT INTO activity_logs (id, user_id, user_name, user_avatar, school_id, action, details, timestamp)
            VALUES (${id}, ${session.userId}, ${userName}, ${userAvatar}, ${effectiveSchoolId}, ${action}, ${details}, ${new Date().toISOString()})
        `;
    } catch (err) {
        console.warn('Failed to record server audit log:', err);
    }
}
