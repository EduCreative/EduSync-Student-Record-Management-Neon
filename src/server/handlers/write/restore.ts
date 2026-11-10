import { verifySession, writeServerAuditLog } from './_helpers';
import { SESSION_SECRET } from '../../_db';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const RESTORE_TABLE_ORDER = [
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
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }

    const auth = await verifySession(req, res);
    if (!auth) return;
    const { session, sql } = auth;

    if (session.role !== 'Owner') {
        return res.status(403).json({ error: 'Access denied: Only Institutional Owners can restore the database.' });
    }

    try {
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
        const { action } = body;

        // 1. Initialize Staging Environment with Owner Password Verification
        if (action === 'init') {
            const { password } = body;
            if (!password || typeof password !== 'string') {
                return res.status(400).json({ error: 'Owner account password is required to initiate database restore.' });
            }

            const ownerRows = await sql`
                SELECT password FROM profiles 
                WHERE id = ${session.userId} 
                LIMIT 1
            `;

            if (!ownerRows || ownerRows.length === 0) {
                return res.status(404).json({ error: 'Owner profile not found in active database.' });
            }

            const storedPassword = ownerRows[0].password || '';
            const isMatch = await bcrypt.compare(password, storedPassword);

            if (!isMatch) {
                return res.status(401).json({ error: 'Incorrect Owner password. Database restore aborted.' });
            }

            // Create staging tables if they don't exist and truncate any previous staging data
            for (const tbl of RESTORE_TABLE_ORDER) {
                const quotedLive = `"${tbl.replace(/"/g, '""')}"`;
                const stagingTable = `"staging_${tbl.replace(/"/g, '""')}"`;
                await sql(`CREATE TABLE IF NOT EXISTS ${stagingTable} (LIKE ${quotedLive} INCLUDING DEFAULTS)`);
                await sql(`TRUNCATE TABLE ${stagingTable}`);
            }

            // Issue short-lived HMAC token for upload session
            const restoreToken = jwt.sign(
                { userId: session.userId, role: 'Owner', type: 'db_restore' },
                SESSION_SECRET,
                { expiresIn: '30m' }
            );

            return res.status(200).json({
                success: true,
                restoreToken,
                message: 'Staging environment initialized and verified.'
            });

        // 2. Upload Table Chunks into Staging Tables
        } else if (action === 'upload-chunk') {
            const { restoreToken, table, rows } = body;
            if (!restoreToken || !table) {
                return res.status(400).json({ error: 'Missing restoreToken or table name.' });
            }

            try {
                const decoded: any = jwt.verify(restoreToken, SESSION_SECRET);
                if (decoded.role !== 'Owner' || decoded.type !== 'db_restore') {
                    return res.status(403).json({ error: 'Invalid restore authorization token.' });
                }
            } catch {
                return res.status(401).json({ error: 'Restore session has expired. Please re-enter your password.' });
            }

            if (!RESTORE_TABLE_ORDER.includes(table as any)) {
                return res.status(400).json({ error: `Table "${table}" is not an allowed institutional table.` });
            }

            if (!Array.isArray(rows) || rows.length === 0) {
                return res.status(200).json({ success: true, count: 0 });
            }

            const stagingTable = `"staging_${table.replace(/"/g, '""')}"`;

            // Inspect staging table column data types
            const colRes = await sql`
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_schema = 'public' AND table_name = ${'staging_' + table}
            `;
            const colTypes: Record<string, string> = {};
            for (const r of colRes) {
                colTypes[r.column_name] = r.data_type;
            }

            const queries: any[] = [];
            for (const row of rows) {
                const cols = Object.keys(row).filter(c => colTypes[c] !== undefined);
                if (cols.length === 0) continue;

                const values = cols.map(c => {
                    const val = row[c];
                    if (val === null || val === undefined) return null;
                    const dType = colTypes[c];
                    if (dType === 'jsonb' || dType === 'json') {
                        return typeof val === 'string' ? val : JSON.stringify(val);
                    }
                    return val;
                });

                const quotedCols = cols.map(c => `"${c.replace(/"/g, '""')}"`).join(', ');
                const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');

                queries.push(sql(
                    `INSERT INTO ${stagingTable} (${quotedCols}) VALUES (${placeholders})`,
                    values
                ));
            }

            if (queries.length > 0) {
                await sql.transaction(queries);
            }

            return res.status(200).json({ success: true, count: rows.length });

        // 3. Finalize: Validate Staging Counts and Execute Atomic Swap
        } else if (action === 'finalize') {
            const { restoreToken, expectedCounts } = body;
            if (!restoreToken || !expectedCounts) {
                return res.status(400).json({ error: 'Missing restoreToken or expectedCounts.' });
            }

            try {
                const decoded: any = jwt.verify(restoreToken, SESSION_SECRET);
                if (decoded.role !== 'Owner' || decoded.type !== 'db_restore') {
                    return res.status(403).json({ error: 'Invalid restore authorization token.' });
                }
            } catch {
                return res.status(401).json({ error: 'Restore session has expired. Please re-enter your password.' });
            }

            // Step A: Count verification across all staging tables
            const actualCounts: Record<string, number> = {};
            for (const tbl of RESTORE_TABLE_ORDER) {
                const exp = Number(expectedCounts[tbl] || 0);
                const stagingTable = `"staging_${tbl.replace(/"/g, '""')}"`;
                const countRes = await sql(`SELECT count(*)::int as count FROM ${stagingTable}`);
                const actual = Number(countRes[0]?.count || 0);
                actualCounts[tbl] = actual;

                if (actual !== exp) {
                    return res.status(400).json({
                        error: `Integrity check failed: Table "${tbl}" has ${actual} rows in staging, but backup contains ${exp} rows. Production database was not modified.`
                    });
                }
            }

            // Step B: Atomic Swap in ONE transaction
            const swapQueries: any[] = [];

            // Truncate all live tables CASCADE
            const quotedLiveTables = RESTORE_TABLE_ORDER.map(t => `"${t.replace(/"/g, '""')}"`).join(', ');
            swapQueries.push(sql(`TRUNCATE TABLE ${quotedLiveTables} CASCADE`));

            // Insert from staging in strict topological foreign-key order
            for (const tbl of RESTORE_TABLE_ORDER) {
                const liveTbl = `"${tbl.replace(/"/g, '""')}"`;
                const stagingTbl = `"staging_${tbl.replace(/"/g, '""')}"`;
                swapQueries.push(sql(`INSERT INTO ${liveTbl} SELECT * FROM ${stagingTbl}`));
            }

            // Clean up staging tables
            const quotedStagingTables = RESTORE_TABLE_ORDER.map(t => `"staging_${t.replace(/"/g, '""')}"`).join(', ');
            swapQueries.push(sql(`TRUNCATE TABLE ${quotedStagingTables}`));

            // Commit atomic transaction
            await sql.transaction(swapQueries);

            // Audit Log
            await writeServerAuditLog(
                sql,
                session,
                'Restore Database',
                `Restored complete institutional database from backup archive via browser disaster recovery modal.`
            );

            return res.status(200).json({
                success: true,
                message: 'Database restored and verified successfully.',
                restoredCounts: actualCounts
            });

        // 4. Cancel: Clear Staging Environment
        } else if (action === 'cancel') {
            for (const tbl of RESTORE_TABLE_ORDER) {
                const stagingTable = `"staging_${tbl.replace(/"/g, '""')}"`;
                try {
                    await sql(`TRUNCATE TABLE ${stagingTable}`);
                } catch {}
            }
            return res.status(200).json({ success: true, message: 'Staging environment cleared.' });

        } else {
            return res.status(400).json({ error: `Unknown action: ${action}` });
        }

    } catch (err: any) {
        console.error("Restore API handler error:", err);
        return res.status(500).json({ error: err.message || 'Server error processing restore operation.' });
    }
}
