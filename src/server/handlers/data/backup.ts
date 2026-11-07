import { getDb, getSessionUser } from '../../_db';

const ALLOWED_TABLES = [
    'schools',
    'branches',
    'profiles',
    'classes',
    'subjects',
    'exams',
    'fee_heads',
    'students',
    'fee_challans',
    'attendance',
    'results',
    'activity_logs',
    'school_events'
] as const;

export default async function handler(req: any, res: any) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', ['GET']);
        return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }

    try {
        const session = await getSessionUser(req, res);
        if (!session || session.role !== 'Owner') {
            return res.status(403).json({ error: 'Access denied: Owner role required for database backup.' });
        }

        const table = req.query?.table as string;
        const cursor = req.query?.cursor as string | undefined;

        if (!table || !ALLOWED_TABLES.includes(table as any)) {
            return res.status(400).json({ 
                error: `Invalid table "${table}". Whitelisted tables: ${ALLOWED_TABLES.join(', ')}` 
            });
        }

        const sql = getDb();
        const CHUNK_QUERY_LIMIT = 500;
        let queryRows: any[] = [];

        if (cursor && typeof cursor === 'string' && cursor.trim() !== '') {
            const trimmedCursor = cursor.trim();
            if (!/^[0-9a-fA-F-]{36}$/.test(trimmedCursor)) {
                return res.status(400).json({ error: 'Invalid cursor format (expected UUID).' });
            }
            queryRows = await sql`
                SELECT * FROM ${sql(table)}
                WHERE id > ${trimmedCursor}::uuid
                ORDER BY id ASC
                LIMIT ${CHUNK_QUERY_LIMIT}
            `;
        } else {
            queryRows = await sql`
                SELECT * FROM ${sql(table)}
                ORDER BY id ASC
                LIMIT ${CHUNK_QUERY_LIMIT}
            `;
        }

        // Keyset pagination chunking with safe ~3 MB ceiling
        const rows: any[] = [];
        let nextCursor: string | null = null;
        const MAX_BYTES = 3 * 1024 * 1024; // 3 MB payload safety budget
        let currentBytes = 2; // baseline for "[]"

        for (let i = 0; i < queryRows.length; i++) {
            const row = queryRows[i];
            const rowJson = JSON.stringify(row);
            const rowBytes = Buffer.byteLength(rowJson, 'utf8') + 1; // +1 for comma

            if (rows.length >= 1 && (currentBytes + rowBytes) > MAX_BYTES) {
                nextCursor = rows[rows.length - 1].id;
                break;
            }

            rows.push(row);
            currentBytes += rowBytes;
        }

        // If all queryRows were included without exceeding MAX_BYTES
        if (!nextCursor) {
            if (queryRows.length === CHUNK_QUERY_LIMIT) {
                // Next page available
                nextCursor = queryRows[queryRows.length - 1].id;
            } else {
                // Table fully exhausted
                nextCursor = null;
            }
        }

        return res.status(200).json({
            table,
            rows,
            nextCursor
        });

    } catch (err: any) {
        console.error("Backup data endpoint error:", err);
        return res.status(500).json({ error: 'Failed to stream backup records.' });
    }
}
