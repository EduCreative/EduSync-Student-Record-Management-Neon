import { neon } from '@neondatabase/serverless';
import jwt from 'jsonwebtoken';

if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
    throw new Error("SESSION_SECRET environment variable is required and must be at least 32 characters long.");
}
export const SESSION_SECRET = process.env.SESSION_SECRET;
export const COOKIE_NAME = 'edusync_session';

// Server-only database connection
const getDatabaseUrl = () => {
    return process.env.DATABASE_URL || '';
};

export const getDb = () => {
    const url = getDatabaseUrl();
    if (!url) {
        throw new Error("DATABASE_URL is not configured in server environment. Please set DATABASE_URL in Vercel Environment Variables.");
    }
    return neon(url);
};

export interface TokenPayload {
    userId: string;
    email: string;
    role: string;
    schoolId: string | null;
    branchId: string | null;
    name?: string;
    avatarUrl?: string;
}

export function signToken(payload: TokenPayload): string {
    return jwt.sign(payload, SESSION_SECRET, { expiresIn: '12h' });
}

export function verifyToken(token: string): TokenPayload | null {
    try {
        return jwt.verify(token, SESSION_SECRET) as TokenPayload;
    } catch {
        return null;
    }
}

export function parseCookies(req: any): Record<string, string> {
    const header = req.headers?.cookie || req.headers?.Cookie || '';
    if (!header || typeof header !== 'string') return {};
    const cookies: Record<string, string> = {};
    const pairs = header.split(';');
    for (const pair of pairs) {
        const trimmed = pair.trim();
        if (!trimmed) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx !== -1) {
            const key = trimmed.slice(0, eqIdx).trim();
            const val = trimmed.slice(eqIdx + 1).trim();
            try {
                cookies[key] = decodeURIComponent(val);
            } catch {
                cookies[key] = val;
            }
        }
    }
    return cookies;
}

export function serializeCookie(name: string, val: string, options: { httpOnly?: boolean; secure?: boolean; sameSite?: string; path?: string; maxAge?: number; partitioned?: boolean } = {}): string {
    let cookie = `${encodeURIComponent(name)}=${encodeURIComponent(val)}`;
    if (options.maxAge !== undefined) {
        cookie += `; Max-Age=${Math.floor(options.maxAge)}`;
    }
    if (options.path) {
        cookie += `; Path=${options.path}`;
    }
    if (options.httpOnly) {
        cookie += `; HttpOnly`;
    }
    if (options.secure) {
        cookie += `; Secure`;
    }
    if (options.sameSite) {
        cookie += `; SameSite=${options.sameSite.charAt(0).toUpperCase() + options.sameSite.slice(1).toLowerCase()}`;
    }
    if (options.partitioned) {
        cookie += `; Partitioned`;
    }
    return cookie;
}

export function extractToken(req: any): string | null {
    const cookies = parseCookies(req);
    if (cookies[COOKIE_NAME]) {
        return cookies[COOKIE_NAME];
    }
    const authHeader = req.headers?.authorization || req.headers?.Authorization;
    if (authHeader && typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer ')) {
        return authHeader.substring(7).trim();
    }
    return null;
}

export function authenticateRequest(req: any): TokenPayload | null {
    const token = extractToken(req);
    if (!token) return null;
    return verifyToken(token);
}

/**
 * Validates session against live database record.
 * Re-queries role, school_id, status, name, and avatar directly from DB,
 * preventing stale privilege claims from token payloads.
 */
export async function getSessionUser(req: any, res?: any): Promise<TokenPayload | null> {
    const token = extractToken(req);
    if (!token) return null;
    const payload = verifyToken(token);
    if (!payload || !payload.userId) return null;

    try {
        const sql = getDb();
        const rows = await sql`
            SELECT id, name, email, role, school_id, branch_id, status, avatar_url
            FROM profiles
            WHERE id = ${payload.userId}
            LIMIT 1
        `;

        if (!rows || rows.length === 0) {
            if (res) clearSessionCookie(res);
            return null;
        }

        const user = rows[0];
        const invalidStatuses = ['Inactive', 'Suspended', 'Pending Approval', 'Pending'];
        if (invalidStatuses.includes(user.status)) {
            if (res) clearSessionCookie(res);
            return null;
        }

        return {
            userId: user.id,
            email: user.email,
            role: user.role,
            schoolId: user.school_id || null,
            branchId: user.role === 'Owner' ? null : (user.branch_id || null),
            name: user.name || '',
            avatarUrl: user.avatar_url || ''
        };
    } catch (err) {
        console.error("getSessionUser error:", err);
        return null;
    }
}

export function setSessionCookie(res: any, token: string) {
    const isProd = process.env.NODE_ENV === 'production' || !!process.env.VERCEL;
    const cookieStr = serializeCookie(COOKIE_NAME, token, {
        httpOnly: true,
        secure: isProd,
        sameSite: 'lax',
        path: '/',
        maxAge: 12 * 60 * 60 // 12 hours
    });
    res.setHeader('Set-Cookie', cookieStr);
}

export function clearSessionCookie(res: any) {
    const isProd = process.env.NODE_ENV === 'production' || !!process.env.VERCEL;
    const cookieStr = serializeCookie(COOKIE_NAME, '', {
        httpOnly: true,
        secure: isProd,
        sameSite: 'lax',
        path: '/',
        maxAge: 0
    });
    res.setHeader('Set-Cookie', cookieStr);
}

export function toCamelCase(obj: any): any {
    if (!obj || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(toCamelCase);
    const newObj: any = {};
    for (const key of Object.keys(obj)) {
        const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
        newObj[camelKey] = toCamelCase(obj[key]);
    }
    return newObj;
}
