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
        const [sizeRows, tableRows, backupRows] = await sql.transaction(
            [
                sql`SELECT pg_database_size(current_database())::bigint AS bytes`,
                sql`SELECT relname, pg_total_relation_size(c.oid)::bigint AS bytes FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind = 'r' ORDER BY bytes DESC LIMIT 5`,
                sql`SELECT max(timestamp) AS last_backup FROM activity_logs WHERE action = 'Full backup downloaded'`
            ],
            { readOnly: true }
        );

        const sizeBytes = Number(sizeRows?.[0]?.bytes ?? 0);
        const tables = (tableRows || []).map((row: any) => ({
            name: String(row.relname),
            bytes: Number(row.bytes ?? 0)
        }));

        const rawLastBackup = backupRows?.[0]?.last_backup ?? null;
        let lastBackupAt: string | null = null;
        if (rawLastBackup instanceof Date) {
            lastBackupAt = isNaN(rawLastBackup.getTime()) ? null : rawLastBackup.toISOString();
        } else if (typeof rawLastBackup === 'string' && rawLastBackup.trim() !== '') {
            const parsed = new Date(rawLastBackup);
            lastBackupAt = isNaN(parsed.getTime()) ? rawLastBackup : parsed.toISOString();
        }

        return res.status(200).json({ sizeBytes, tables, lastBackupAt });
    } catch (err: any) {
        console.error('Database usage endpoint error:', err);
        return res.status(500).json({ error: 'Failed to read database usage.' });
    }
}
