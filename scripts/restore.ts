/**
 * EduSync CLI Database Restore Script
 * 
 * Usage:
 *   npm run restore -- <path-to-backup.json>
 *   npm run restore -- <path-to-backup.json> --wipe
 * 
 * Uses standard node-postgres (pg) client with SSL for multi-statement atomic transactions.
 * Computes topological insertion order using foreign-key constraints from information_schema/pg_catalog.
 * Inserts are batched into multi-row parameterized statements (up to 200 rows per query) inside
 * a single BEGIN ... COMMIT block. If any insert fails, ROLLBACK is executed immediately.
 */

import pg from 'pg';
const { Client } = pg;
import fs from 'fs';
import path from 'path';
import readline from 'readline';

function askConfirmation(question: string): Promise<string> {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            rl.close();
            resolve(answer.trim());
        });
    });
}

async function runRestore() {
    console.log('=== EduSync CLI Database Restore ===\n');

    const args = process.argv.slice(2);
    let filePath: string | null = null;
    let allowWipe = false;

    for (const arg of args) {
        if (arg === '--wipe') {
            allowWipe = true;
        } else if (!arg.startsWith('-') && !filePath) {
            filePath = arg;
        }
    }

    if (!filePath) {
        console.error('Usage: npm run restore -- <path-to-backup.json> [--wipe]');
        process.exit(1);
    }

    const resolvedPath = path.resolve(process.cwd(), filePath);
    if (!fs.existsSync(resolvedPath)) {
        console.error(`Error: Backup file not found at: ${resolvedPath}`);
        process.exit(1);
    }

    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
        console.error('Error: DATABASE_URL environment variable is required.');
        process.exit(1);
    }

    console.log(`Reading backup file: ${resolvedPath}`);
    let backupPayload: any;
    try {
        const rawContent = fs.readFileSync(resolvedPath, 'utf8');
        backupPayload = JSON.parse(rawContent);
    } catch (err: any) {
        console.error('Error parsing JSON backup file:', err.message);
        process.exit(1);
    }

    if (!backupPayload.tables || typeof backupPayload.tables !== 'object') {
        console.error('Invalid backup format: missing "tables" object.');
        process.exit(1);
    }

    const tablesInBackup = Object.keys(backupPayload.tables);
    console.log(`Backup version: ${backupPayload.version || 'unknown'}, tables: ${tablesInBackup.length}`);

    const sslRejectUnauthorized = process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' && process.env.NODE_TLS_REJECT_UNAUTHORIZED !== '0';
    const client = new Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: sslRejectUnauthorized } });
    await client.connect();

    try {
        // 1. Check whether target tables are empty
        console.log('\nChecking target database state...');
        const nonEmptyTables: string[] = [];
        for (const tbl of tablesInBackup) {
            try {
                const quotedTbl = `"${tbl.replace(/"/g, '""')}"`;
                const countRes = await client.query(`SELECT count(*)::int as count FROM ${quotedTbl}`);
                const c = Number(countRes.rows[0]?.count || 0);
                if (c > 0) {
                    nonEmptyTables.push(`${tbl} (${c} rows)`);
                }
            } catch (e: any) {
                // Table might not exist yet if schema wasn't loaded
                console.error(`Error accessing table "${tbl}":`, e?.message || e);
            }
        }

        if (nonEmptyTables.length > 0) {
            if (!allowWipe) {
                console.error('\nRESTORE REFUSAL: Target database tables are not empty:');
                for (const t of nonEmptyTables) {
                    console.error(`  - ${t}`);
                }
                console.error('\nTo overwrite existing data, run with --wipe:');
                console.error(`npm run restore -- ${filePath} --wipe`);
                process.exit(1);
            } else {
                console.warn('\nWARNING: Target tables contain existing data and will be WIPED:');
                for (const t of nonEmptyTables) {
                    console.warn(`  - ${t}`);
                }
                const confirm = await askConfirmation('\nType "RESTORE" to permanently wipe existing data and proceed: ');
                if (confirm !== 'RESTORE') {
                    console.log('Confirmation cancelled. Restore aborted.');
                    process.exit(0);
                }
            }
        }

        // 2. Discover Foreign Keys from information_schema
        console.log('\nAnalyzing table dependency graph (Foreign Keys)...');
        const fkRes = await client.query(`
            SELECT
                tc.table_name AS child_table,
                ccu.table_name AS parent_table
            FROM information_schema.table_constraints AS tc
            JOIN information_schema.key_column_usage AS kcu
                ON tc.constraint_name = kcu.constraint_name
                AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage AS ccu
                ON ccu.constraint_name = tc.constraint_name
                AND ccu.table_schema = tc.table_schema
            WHERE tc.constraint_type = 'FOREIGN KEY'
                AND tc.table_schema = 'public'
        `);

        // Map dependencies: parent -> set of children, and child -> set of parents
        const parentsOf: Record<string, Set<string>> = {};
        const childrenOf: Record<string, Set<string>> = {};

        for (const tbl of tablesInBackup) {
            parentsOf[tbl] = new Set();
            childrenOf[tbl] = new Set();
        }

        for (const r of fkRes.rows) {
            const child = r.child_table as string;
            const parent = r.parent_table as string;
            // Ignore self-references or tables not in backup
            if (child === parent) continue;
            if (tablesInBackup.includes(child) && tablesInBackup.includes(parent)) {
                parentsOf[child].add(parent);
                childrenOf[parent].add(child);
            }
        }

        // Topological Sort (Kahn's Algorithm)
        const sortedOrder: string[] = [];
        const inDegree: Record<string, number> = {};
        const queue: string[] = [];

        for (const tbl of tablesInBackup) {
            inDegree[tbl] = parentsOf[tbl].size;
            if (inDegree[tbl] === 0) {
                queue.push(tbl);
            }
        }

        while (queue.length > 0) {
            const current = queue.shift()!;
            sortedOrder.push(current);

            for (const child of childrenOf[current]) {
                inDegree[child]--;
                if (inDegree[child] === 0) {
                    queue.push(child);
                }
            }
        }

        if (sortedOrder.length < tablesInBackup.length) {
            const cyclicTables = tablesInBackup.filter(t => !sortedOrder.includes(t));
            console.error('CRITICAL ERROR: Cyclic foreign key dependency detected among tables:');
            console.error(cyclicTables.join(', '));
            process.exit(1);
        }

        console.log('Computed topological insertion order:');
        sortedOrder.forEach((tbl, idx) => {
            console.log(`  ${idx + 1}. ${tbl}`);
        });

        // 3. Inspect column types for proper jsonb / array formatting
        const colTypesRes = await client.query(`
            SELECT table_name, column_name, data_type, udt_name
            FROM information_schema.columns
            WHERE table_schema = 'public'
        `);
        const colTypeMap: Record<string, Record<string, { dataType: string; udtName: string }>> = {};
        for (const r of colTypesRes.rows) {
            if (!colTypeMap[r.table_name]) colTypeMap[r.table_name] = {};
            colTypeMap[r.table_name][r.column_name] = { dataType: r.data_type, udtName: r.udt_name };
        }

        // 4. Begin Transaction
        console.log('\nBeginning database transaction...');
        await client.query('BEGIN');

        try {
            // If wiping, truncate in reverse topological order (or CASCADE)
            if (allowWipe && nonEmptyTables.length > 0) {
                console.log('Wiping existing records...');
                const quotedTables = sortedOrder.map(t => `"${t.replace(/"/g, '""')}"`).join(', ');
                await client.query(`TRUNCATE TABLE ${quotedTables} CASCADE`);
                console.log('✓ Target tables truncated.');
            }

            // 5. Insert rows in multi-row parameterized statements (up to 200 rows per batch)
            const BATCH_SIZE = 200;
            const startTime = Date.now();

            for (const tableName of sortedOrder) {
                const rows: any[] = backupPayload.tables[tableName] || [];
                process.stdout.write(`Restoring table "${tableName}" (${rows.length} rows)... `);
                if (rows.length === 0) {
                    console.log('✓ 0 rows');
                    continue;
                }

                const tableColMeta = colTypeMap[tableName] || {};
                const columnSet = new Set<string>();
                for (const r of rows) {
                    for (const k of Object.keys(r)) {
                        if (tableColMeta[k]) {
                            columnSet.add(k);
                        }
                    }
                }
                const columns = Array.from(columnSet);
                if (columns.length === 0) {
                    console.log('✓ skipped (no matching columns)');
                    continue;
                }

                const quotedTable = `"${tableName.replace(/"/g, '""')}"`;
                const quotedCols = columns.map(c => `"${c.replace(/"/g, '""')}"`).join(', ');

                for (let i = 0; i < rows.length; i += BATCH_SIZE) {
                    const chunk = rows.slice(i, i + BATCH_SIZE);
                    const valueClauses: string[] = [];
                    const params: any[] = [];
                    let paramIdx = 1;

                    for (const row of chunk) {
                        const rowPlaceholders: string[] = [];
                        for (const col of columns) {
                            rowPlaceholders.push(`$${paramIdx++}`);
                            const rawVal = row[col];
                            if (rawVal === null || rawVal === undefined) {
                                params.push(null);
                                continue;
                            }

                            const colMeta = tableColMeta[col];
                            const dType = colMeta?.dataType || '';
                            const udt = colMeta?.udtName || '';

                            if (dType === 'jsonb' || dType === 'json') {
                                params.push(typeof rawVal === 'string' ? rawVal : JSON.stringify(rawVal));
                            } else if (dType === 'ARRAY' || udt.startsWith('_')) {
                                if (Array.isArray(rawVal)) {
                                    params.push(rawVal);
                                } else if (typeof rawVal === 'string' && rawVal.startsWith('{') && rawVal.endsWith('}')) {
                                    const cleaned = rawVal.slice(1, -1);
                                    params.push(cleaned ? cleaned.split(',') : []);
                                } else {
                                    params.push(rawVal);
                                }
                            } else {
                                params.push(rawVal);
                            }
                        }
                        valueClauses.push(`(${rowPlaceholders.join(', ')})`);
                    }

                    const insertSql = `INSERT INTO ${quotedTable} (${quotedCols}) VALUES ${valueClauses.join(', ')}`;
                    await client.query(insertSql, params);
                }

                console.log('✓ OK');
            }

            await client.query('COMMIT');
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
            console.log(`\n✓ All tables committed successfully in ${elapsed}s.`);

        } catch (txErr: any) {
            await client.query('ROLLBACK');
            console.error('\nTRANSACTION FAILED: Database rolled back. Nothing was written.');
            console.error('Error details:', txErr?.message || txErr);
            process.exit(1);
        }

        // 6. Verify per-table row counts
        console.log('\n================ RESTORE VERIFICATION ================');
        let hasMismatch = false;
        for (const tableName of sortedOrder) {
            const expectedCount = (backupPayload.tables[tableName] || []).length;
            const quotedTable = `"${tableName.replace(/"/g, '""')}"`;
            const countRes = await client.query(`SELECT count(*)::int as count FROM ${quotedTable}`);
            const actualCount = Number(countRes.rows[0]?.count || 0);

            const status = actualCount === expectedCount ? 'OK' : 'MISMATCH';
            if (status === 'MISMATCH') hasMismatch = true;
            console.log(`  - ${tableName.padEnd(20)}: File = ${expectedCount}, DB = ${actualCount} [${status}]`);
        }
        console.log('======================================================\n');

        if (hasMismatch) {
            console.error('Warning: One or more table row counts mismatched.');
            process.exit(1);
        } else {
            console.log('Restore completed successfully with 100% count verification.');
        }

    } finally {
        await client.end();
    }
}

runRestore().catch((err) => {
    console.error('Fatal restore error:', err);
    process.exit(1);
});
