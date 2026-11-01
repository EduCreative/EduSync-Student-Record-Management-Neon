import { clearSessionCookie } from '../_db';

export default async function handler(req: any, res: any) {
    if (req.method !== 'POST' && req.method !== 'GET') {
        res.setHeader('Allow', ['POST', 'GET']);
        return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }

    try {
        clearSessionCookie(res);
        return res.status(200).json({ success: true, message: 'Logged out successfully.' });
    } catch (err: any) {
        console.error("Logout error:", err);
        return res.status(500).json({ error: 'Failed to log out.' });
    }
}
