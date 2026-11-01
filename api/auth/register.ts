import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { getDb } from '../_db';

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

        const normalizedEmail = email.trim().toLowerCase();

        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
        }

        const sql = getDb();
        const existing = await sql`SELECT id FROM profiles WHERE LOWER(email) = LOWER(${normalizedEmail}) LIMIT 1`;
        if (existing.length > 0) {
            return res.status(409).json({ error: 'Email is already registered.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const userId = crypto.randomUUID();

        await sql`
            INSERT INTO profiles (id, name, email, password, role, status)
            VALUES (${userId}, ${name.trim()}, ${normalizedEmail}, ${hashedPassword}, ${role}, 'Pending Approval')
        `;

        return res.status(201).json({ success: true, message: 'Account registered successfully.' });

    } catch (err: any) {
        console.error("Register API error:", err);
        return res.status(500).json({ error: 'Registration failed. Please try again.' });
    }
}
