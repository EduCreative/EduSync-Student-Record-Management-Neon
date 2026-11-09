import { getSessionUser, getDb, TokenPayload } from '../../_db';
import crypto from 'crypto';

export type UserRoleType = 'Owner' | 'Admin' | 'Accountant' | 'Teacher' | 'Parent' | 'Student';

export interface AuthenticatedContext {
    sql: ReturnType<typeof getDb>;
    session: TokenPayload;
    userSchoolId: string | null;
}

export async function verifySession(req: any, res: any): Promise<{ session: TokenPayload; sql: ReturnType<typeof getDb> } | null> {
    const session = await getSessionUser(req, res);
    if (!session) {
        res.status(401).json({ error: 'Unauthorized: Session invalid or account inactive.' });
        return null;
    }
    const sql = getDb();
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

export const ALLOWED_AVATAR_MIMES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_AVATAR_PAYLOAD_CHARS = Math.ceil((500 * 1024 * 4) / 3) + 100; // ~500 KB binary in base64

export function validateAvatarDataUrl(dataUrl: any): { valid: boolean; error?: string } {
    if (!dataUrl || typeof dataUrl !== 'string' || dataUrl.trim() === '') {
        return { valid: true };
    }
    const trimmed = dataUrl.trim();
    if (trimmed.startsWith('/api/photo')) {
        return { valid: true };
    }
    if (!trimmed.startsWith('data:')) {
        return { valid: false, error: 'Avatar must be a valid image data URL.' };
    }
    if (trimmed.length > MAX_AVATAR_PAYLOAD_CHARS) {
        return { valid: false, error: 'Avatar image payload exceeds 500 KB limit.' };
    }
    const commaIndex = trimmed.indexOf(',');
    if (commaIndex === -1) {
        return { valid: false, error: 'Malformed avatar data URL.' };
    }
    const meta = trimmed.slice(0, commaIndex);
    const mimeMatch = meta.match(/data:([^;]+)/);
    const mime = mimeMatch ? mimeMatch[1].toLowerCase().trim() : '';
    if (!ALLOWED_AVATAR_MIMES.includes(mime)) {
        return { valid: false, error: 'Avatar must be a JPEG, PNG, or WebP image.' };
    }
    return { valid: true };
}
