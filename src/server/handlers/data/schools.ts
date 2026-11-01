import { getDb, authenticateRequest, toCamelCase } from '../../_db';

export default async function handler(req: any, res: any) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', ['GET']);
        return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }

    try {
        const session = authenticateRequest(req);
        if (!session) {
            return res.status(401).json({ error: 'Unauthorized: Session invalid or expired' });
        }

        const sql = getDb();
        const { role, schoolId } = session;

        let schools: any[] = [];
        if (role === 'Owner') {
            schools = await sql`SELECT id, name, address, logo_url FROM schools ORDER BY name ASC`;
        } else if (schoolId) {
            schools = await sql`SELECT id, name, address, logo_url FROM schools WHERE id = ${schoolId}`;
        }

        const transformed = toCamelCase(schools);
        return res.status(200).json({ schools: transformed });
    } catch (err: any) {
        console.error("Schools read API error:", err);
        return res.status(500).json({ error: 'Failed to read schools from database.' });
    }
}
