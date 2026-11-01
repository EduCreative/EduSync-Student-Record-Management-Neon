import bcrypt from 'bcryptjs';
import { getDb, signToken, setSessionCookie, toCamelCase } from '../../_db';

// Rate limiting: 5 failed attempts per email per 15 minutes
interface FailedAttempt {
    count: number;
    resetTime: number;
}

const failedAttempts = new Map<string, FailedAttempt>();

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_FAILED_ATTEMPTS = 5;

function isRateLimited(email: string): boolean {
    const record = failedAttempts.get(email);
    if (!record) return false;
    
    if (Date.now() > record.resetTime) {
        failedAttempts.delete(email);
        return false;
    }
    
    return record.count >= MAX_FAILED_ATTEMPTS;
}

function recordFailedAttempt(email: string) {
    const record = failedAttempts.get(email);
    if (!record || Date.now() > record.resetTime) {
        failedAttempts.set(email, {
            count: 1,
            resetTime: Date.now() + RATE_LIMIT_WINDOW_MS
        });
    } else {
        record.count += 1;
    }
}

function clearFailedAttempts(email: string) {
    failedAttempts.delete(email);
}

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

        // Check Rate Limiting
        if (isRateLimited(email)) {
            return res.status(429).json({
                error: 'Too many failed login attempts. Please try again after 15 minutes.'
            });
        }

        const sql = getDb();
        const users = await sql`
            SELECT id, school_id, name, email, password, role, status, 
                   avatar_url, child_student_ids, disabled_nav_links, permissions_overrides, last_login
            FROM profiles 
            WHERE LOWER(email) = LOWER(${email}) 
            LIMIT 1
        `;

        if (!users || users.length === 0) {
            recordFailedAttempt(email);
            return res.status(401).json({ error: 'Invalid email or password.' });
        }

        const user = users[0];

        // Status checks
        if (user.status === 'Pending Approval' || user.status === 'Pending') {
            return res.status(403).json({ error: 'Your account is pending approval by administration.' });
        }

        if (user.status === 'Suspended' || user.status === 'Inactive') {
            return res.status(403).json({ error: 'Your account is inactive or suspended. Please contact administration.' });
        }

        // Password verification (supports bcrypt and legacy auto-upgrade)
        let isMatch = false;
        const storedPassword = user.password || '';

        if (storedPassword.startsWith('$2a$') || storedPassword.startsWith('$2b$') || storedPassword.startsWith('$2y$')) {
            isMatch = await bcrypt.compare(password, storedPassword);
        } else {
            // Legacy plain-text check & auto-upgrade to bcrypt
            if (storedPassword === password) {
                isMatch = true;
                try {
                    const newHash = await bcrypt.hash(password, 10);
                    await sql`UPDATE profiles SET password = ${newHash} WHERE id = ${user.id}`;
                } catch (hashErr) {
                    console.error("Auto-upgrade password hashing error:", hashErr);
                }
            }
        }

        if (!isMatch) {
            recordFailedAttempt(email);
            return res.status(401).json({ error: 'Invalid email or password.' });
        }

        // Successful login: clear failed attempts
        clearFailedAttempts(email);

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

        // Set httpOnly, Secure, SameSite=Strict cookie
        setSessionCookie(res, token);

        // Never return password to client
        const { password: _p, ...safeUserData } = user;
        const safeUser = toCamelCase(safeUserData);

        return res.status(200).json({
            success: true,
            user: safeUser,
            token // Also provided for cross-origin or fallback header authentication
        });

    } catch (err: any) {
        console.error("Login API error:", err);
        return res.status(500).json({ error: 'Server authentication error. Please try again.' });
    }
}
