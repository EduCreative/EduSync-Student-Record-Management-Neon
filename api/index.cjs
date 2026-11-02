const express = require('express');
const { neon } = require('@neondatabase/serverless');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json({ limit: '50mb' }));

const SESSION_SECRET = process.env.SESSION_SECRET || 'edusync_default_session_secret_min_32_chars_long_key_fallback';
const COOKIE_NAME = 'edusync_session';

const getDb = () => {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL is not configured in Vercel environment variables.');
    return neon(url);
};

function parseCookies(req) {
    const header = req.headers?.cookie || req.headers?.Cookie || '';
    if (!header || typeof header !== 'string') return {};
    const cookies = {};
    for (const pair of header.split(';')) {
        const trimmed = pair.trim();
        if (!trimmed) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx !== -1) {
            const key = trimmed.slice(0, eqIdx).trim();
            const val = trimmed.slice(eqIdx + 1).trim();
            try { cookies[key] = decodeURIComponent(val); } catch { cookies[key] = val; }
        }
    }
    return cookies;
}

function verifyToken(token) {
    try { return jwt.verify(token, SESSION_SECRET); } catch { return null; }
}

async function authenticate(req, res, next) {
    const cookies = parseCookies(req);
    let token = cookies[COOKIE_NAME];
    if (!token) {
        const authHeader = req.headers?.authorization || req.headers?.Authorization;
        if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
            token = authHeader.slice(7).trim();
        }
    }
    if (!token) return res.status(401).json({ error: 'No active session found' });
    const payload = verifyToken(token);
    if (!payload) return res.status(401).json({ error: 'Invalid or expired session' });
    req.user = payload;
    next();
}

// Health check / Auth check
app.get('/api/auth/me', async (req, res) => {
    try {
        const cookies = parseCookies(req);
        let token = cookies[COOKIE_NAME];
        if (!token) {
            const authHeader = req.headers?.authorization;
            if (authHeader && authHeader.startsWith('Bearer ')) token = authHeader.slice(7).trim();
        }
        if (!token) return res.json({ user: null });
        const payload = verifyToken(token);
        if (!payload) return res.json({ user: null });

        const sql = getDb();
        const users = await sql`SELECT id, email, full_name, role, school_id, status FROM users WHERE id = ${payload.userId} LIMIT 1`;
        if (users.length === 0) return res.json({ user: null });
        res.json({ user: users[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Login
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

        const sql = getDb();
        const users = await sql`SELECT * FROM users WHERE email = ${email.toLowerCase().trim()} LIMIT 1`;
        if (users.length === 0) return res.status(401).json({ error: 'Invalid email or password' });

        const user = users[0];
        if (user.status !== 'active') return res.status(403).json({ error: 'Account is inactive' });

        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

        const token = jwt.sign({ userId: user.id, email: user.email, role: user.role, schoolId: user.school_id }, SESSION_SECRET, { expiresIn: '12h' });

        const isProd = process.env.NODE_ENV === 'production' || true;
        const cookieOptions = `Path=/; HttpOnly; SameSite=None; Secure; Max-Age=${12 * 3600}`;
        res.setHeader('Set-Cookie', `${COOKIE_NAME}=${encodeURIComponent(token)}; ${cookieOptions}`);

        res.json({
            token,
            user: { id: user.id, email: user.email, fullName: user.full_name, role: user.role, schoolId: user.school_id, status: user.status }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/auth/logout', (_, res) => {
    res.setHeader('Set-Cookie', `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=None; Secure; Max-Age=0`);
    res.json({ success: true });
});

// Generic Data GET handler
app.get('/api/:resource', authenticate, async (req, res) => {
    try {
        const { resource } = req.params;
        const sql = getDb();
        let data = [];
        if (resource === 'students') {
            data = req.user.role === 'super_admin' ? await sql`SELECT * FROM students` : await sql`SELECT * FROM students WHERE school_id = ${req.user.schoolId}`;
        } else if (resource === 'classes') {
            data = req.user.role === 'super_admin' ? await sql`SELECT * FROM classes` : await sql`SELECT * FROM classes WHERE school_id = ${req.user.schoolId}`;
        } else if (resource === 'teachers') {
            data = req.user.role === 'super_admin' ? await sql`SELECT * FROM teachers` : await sql`SELECT * FROM teachers WHERE school_id = ${req.user.schoolId}`;
        } else if (resource === 'fees') {
            data = req.user.role === 'super_admin' ? await sql`SELECT * FROM fee_heads` : await sql`SELECT * FROM fee_heads WHERE school_id = ${req.user.schoolId}`;
        } else if (resource === 'challans') {
            data = req.user.role === 'super_admin' ? await sql`SELECT * FROM fee_challans` : await sql`SELECT * FROM fee_challans WHERE school_id = ${req.user.schoolId}`;
        } else if (resource === 'schools') {
            data = await sql`SELECT * FROM schools`;
        } else if (resource === 'users') {
            data = req.user.role === 'super_admin' ? await sql`SELECT id, email, full_name, role, school_id, status FROM users` : await sql`SELECT id, email, full_name, role, school_id, status FROM users WHERE school_id = ${req.user.schoolId}`;
        } else {
            return res.status(404).json({ error: `Resource ${resource} not found` });
        }
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Fallback catch-all for any other API route
app.all('/api/*', (req, res) => {
    res.status(404).json({ error: `API route ${req.method} ${req.url} not found` });
});

module.exports = app;
