import { getDb, getSessionUser } from '../../_db';

export default async function handler(req: any, res: any) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', ['GET']);
        return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }

    res.setHeader('Cache-Control', 'no-store');

    try {
        const session = await getSessionUser(req, res);
        if (!session || session.role !== 'Owner') {
            return res.status(403).json({ error: 'Access denied: Owner role required.' });
        }

        const sql = getDb();
        const [sizeRows, tableRows] = await sql.transaction(
            [
                sql`SELECT pg_database_size(current_database())::bigint AS bytes`,
                sql`SELECT relname, pg_total_relation_size(c.oid)::bigint AS bytes FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind = 'r' ORDER BY bytes DESC LIMIT 5`
            ],
            { readOnly: true }
        );

        const sizeBytes = Number(sizeRows?.[0]?.bytes ?? 0);
        const tables = (tableRows || []).map((row: any) => ({
            name: String(row.relname),
            bytes: Number(row.bytes ?? 0)
        }));

        return res.status(200).json({ sizeBytes, tables });
    } catch (err: any) {
        console.error('Database usage endpoint error:', err);
        return res.status(500).json({ error: 'Failed to read database usage.' });
    }
}
