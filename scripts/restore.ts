/**
 * EduSync CLI Database Restore Script
 * 
 * Usage:
 *   npm run restore -- <path-to-backup.json>
 *   npm run restore -- <path-to-backup.json> --wipe
 * 
 * Computes topological insertion order using foreign-key constraints from information_schema/pg_catalog.
 * All writes execute in ONE atomic transaction (sql.transaction); if any insert fails, nothing is committed.
 */

import { neon } from '@neondatabase/serverless';
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

    const sql = neon(databaseUrl);

    // 1. Check whether target tables are empty
    console.log('\nChecking target database state...');
    const nonEmptyTables: string[] = [];
    for (const tbl of tablesInBackup) {
        try {
            const countRes = await sql`SELECT count(*)::int as count FROM ${sql(tbl)}`;
            const c = Number(countRes[0]?.count || 0);
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
    const fkRows = await sql`
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
    `;

    // Map dependencies: parent -> set of children, and child -> set of parents
    // Table U must be inserted before Table V if Table V has a foreign key referencing Table U
    const parentsOf: Record<string, Set<string>> = {};
    const childrenOf: Record<string, Set<string>> = {};

    for (const tbl of tablesInBackup) {
        parentsOf[tbl] = new Set();
        childrenOf[tbl] = new Set();
    }

    for (const r of fkRows) {
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

    // 3. If wiping, truncate in reverse topological order (or CASCADE)
    if (allowWipe && nonEmptyTables.length > 0) {
        console.log('\nWiping existing records...');
        const wipeTablesSql = sortedOrder.join(', ');
        await sql`TRUNCATE TABLE ${sql(sortedOrder)} CASCADE`;
        console.log('✓ Target tables truncated.');
    }

    // 4. Inspect column types for proper jsonb / array formatting
    const colTypesRes = await sql`
        SELECT table_name, column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = 'public'
    `;
    const colTypeMap: Record<string, Record<string, string>> = {};
    for (const r of colTypesRes) {
        if (!colTypeMap[r.table_name]) colTypeMap[r.table_name] = {};
        colTypeMap[r.table_name][r.column_name] = r.data_type;
    }

    // 5. Build all insert statements
    console.log('\nPreparing transactional insertion batch...');
    const allQueries: any[] = [];
    let totalRowsToInsert = 0;

    for (const tableName of sortedOrder) {
        const rows = backupPayload.tables[tableName] || [];
        totalRowsToInsert += rows.length;
        if (rows.length === 0) continue;

        const tableColTypes = colTypeMap[tableName] || {};

        for (const row of rows) {
            const columns = Object.keys(row).filter(c => tableColTypes[c] !== undefined);
            if (columns.length === 0) continue;

            const values = columns.map(c => {
                const val = row[c];
                if (val === null || val === undefined) return null;
                const dType = tableColTypes[c];
                if (dType === 'jsonb' || dType === 'json') {
                    return typeof val === 'string' ? val : JSON.stringify(val);
                }
                return val;
            });

            allQueries.push(sql`
                INSERT INTO ${sql(tableName)} (${sql(columns)})
                VALUES (${sql(values)})
            `);
        }
    }

    console.log(`Executing ${allQueries.length} row inserts in ONE atomic transaction...`);
    const startTime = Date.now();
    try {
        // Execute inside single transaction
        if (allQueries.length > 0) {
            // Neon transaction accepts array of queries
            await sql.transaction(allQueries);
        }
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`✓ All rows committed successfully in ${elapsed}s.`);
    } catch (txErr: any) {
        console.error('\nTRANSACTION FAILED: Database rolled back. Nothing was written.');
        console.error('Error details:', txErr?.message || txErr);
        process.exit(1);
    }

    // 6. Verify per-table row counts
    console.log('\n================ RESTORE VERIFICATION ================');
    let hasMismatch = false;
    for (const tableName of sortedOrder) {
        const expectedCount = (backupPayload.tables[tableName] || []).length;
        const countRes = await sql`SELECT count(*)::int as count FROM ${sql(tableName)}`;
        const actualCount = Number(countRes[0]?.count || 0);

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
}

runRestore().catch((err) => {
    console.error('Fatal restore error:', err);
    process.exit(1);
});
