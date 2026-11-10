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
    'school_events',
    'notifications'
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
        const trimmedCursor = (cursor && typeof cursor === 'string' && cursor.trim() !== '') ? cursor.trim() : null;

        if (trimmedCursor) {
            if (!/^[0-9a-fA-F-]{36}$/.test(trimmedCursor)) {
                return res.status(400).json({ error: 'Invalid cursor format (expected UUID).' });
            }
            switch (table) {
                case 'schools': queryRows = await sql`SELECT * FROM schools WHERE id > ${trimmedCursor}::uuid ORDER BY id ASC LIMIT ${CHUNK_QUERY_LIMIT}`; break;
                case 'branches': queryRows = await sql`SELECT * FROM branches WHERE id > ${trimmedCursor}::uuid ORDER BY id ASC LIMIT ${CHUNK_QUERY_LIMIT}`; break;
                case 'profiles': queryRows = await sql`SELECT * FROM profiles WHERE id > ${trimmedCursor}::uuid ORDER BY id ASC LIMIT ${CHUNK_QUERY_LIMIT}`; break;
                case 'classes': queryRows = await sql`SELECT * FROM classes WHERE id > ${trimmedCursor}::uuid ORDER BY id ASC LIMIT ${CHUNK_QUERY_LIMIT}`; break;
                case 'subjects': queryRows = await sql`SELECT * FROM subjects WHERE id > ${trimmedCursor}::uuid ORDER BY id ASC LIMIT ${CHUNK_QUERY_LIMIT}`; break;
                case 'exams': queryRows = await sql`SELECT * FROM exams WHERE id > ${trimmedCursor}::uuid ORDER BY id ASC LIMIT ${CHUNK_QUERY_LIMIT}`; break;
                case 'fee_heads': queryRows = await sql`SELECT * FROM fee_heads WHERE id > ${trimmedCursor}::uuid ORDER BY id ASC LIMIT ${CHUNK_QUERY_LIMIT}`; break;
                case 'students': queryRows = await sql`SELECT * FROM students WHERE id > ${trimmedCursor}::uuid ORDER BY id ASC LIMIT ${CHUNK_QUERY_LIMIT}`; break;
                case 'fee_challans': queryRows = await sql`SELECT * FROM fee_challans WHERE id > ${trimmedCursor}::uuid ORDER BY id ASC LIMIT ${CHUNK_QUERY_LIMIT}`; break;
                case 'attendance': queryRows = await sql`SELECT * FROM attendance WHERE id > ${trimmedCursor}::uuid ORDER BY id ASC LIMIT ${CHUNK_QUERY_LIMIT}`; break;
                case 'results': queryRows = await sql`SELECT * FROM results WHERE id > ${trimmedCursor}::uuid ORDER BY id ASC LIMIT ${CHUNK_QUERY_LIMIT}`; break;
                case 'activity_logs': queryRows = await sql`SELECT * FROM activity_logs WHERE id > ${trimmedCursor}::uuid ORDER BY id ASC LIMIT ${CHUNK_QUERY_LIMIT}`; break;
                case 'school_events': queryRows = await sql`SELECT * FROM school_events WHERE id > ${trimmedCursor}::uuid ORDER BY id ASC LIMIT ${CHUNK_QUERY_LIMIT}`; break;
                case 'notifications': queryRows = await sql`SELECT * FROM notifications WHERE id > ${trimmedCursor}::uuid ORDER BY id ASC LIMIT ${CHUNK_QUERY_LIMIT}`; break;
                default: queryRows = [];
            }
        } else {
            switch (table) {
                case 'schools': queryRows = await sql`SELECT * FROM schools ORDER BY id ASC LIMIT ${CHUNK_QUERY_LIMIT}`; break;
                case 'branches': queryRows = await sql`SELECT * FROM branches ORDER BY id ASC LIMIT ${CHUNK_QUERY_LIMIT}`; break;
                case 'profiles': queryRows = await sql`SELECT * FROM profiles ORDER BY id ASC LIMIT ${CHUNK_QUERY_LIMIT}`; break;
                case 'classes': queryRows = await sql`SELECT * FROM classes ORDER BY id ASC LIMIT ${CHUNK_QUERY_LIMIT}`; break;
                case 'subjects': queryRows = await sql`SELECT * FROM subjects ORDER BY id ASC LIMIT ${CHUNK_QUERY_LIMIT}`; break;
                case 'exams': queryRows = await sql`SELECT * FROM exams ORDER BY id ASC LIMIT ${CHUNK_QUERY_LIMIT}`; break;
                case 'fee_heads': queryRows = await sql`SELECT * FROM fee_heads ORDER BY id ASC LIMIT ${CHUNK_QUERY_LIMIT}`; break;
                case 'students': queryRows = await sql`SELECT * FROM students ORDER BY id ASC LIMIT ${CHUNK_QUERY_LIMIT}`; break;
                case 'fee_challans': queryRows = await sql`SELECT * FROM fee_challans ORDER BY id ASC LIMIT ${CHUNK_QUERY_LIMIT}`; break;
                case 'attendance': queryRows = await sql`SELECT * FROM attendance ORDER BY id ASC LIMIT ${CHUNK_QUERY_LIMIT}`; break;
                case 'results': queryRows = await sql`SELECT * FROM results ORDER BY id ASC LIMIT ${CHUNK_QUERY_LIMIT}`; break;
                case 'activity_logs': queryRows = await sql`SELECT * FROM activity_logs ORDER BY id ASC LIMIT ${CHUNK_QUERY_LIMIT}`; break;
                case 'school_events': queryRows = await sql`SELECT * FROM school_events ORDER BY id ASC LIMIT ${CHUNK_QUERY_LIMIT}`; break;
                case 'notifications': queryRows = await sql`SELECT * FROM notifications ORDER BY id ASC LIMIT ${CHUNK_QUERY_LIMIT}`; break;
                default: queryRows = [];
            }
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
