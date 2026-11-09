/**
 * EduSync CLI Database Backup Script
 * 
 * Usage:
 *   npm run backup
 * 
 * Dumps every database table (all rows, columns, and years) into a timestamped JSON file:
 *   backups/edusync-YYYYMMDD-HHmmss.json
 * 
 * Tables are discovered dynamically from information_schema (excluding transient tables).
 * Queries use keyset pagination (500 rows per batch) to prevent memory spikes on large tables or photo blobs.
 */

import { neon } from '@neondatabase/serverless';
import fs from 'fs';
import path from 'path';

async function runBackup() {
    console.log('=== EduSync CLI Database Backup ===\n');

    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
        console.error('Error: DATABASE_URL environment variable is required.');
        process.exit(1);
    }

    const sql = neon(databaseUrl);

    // Read current package version
    let appVersion = '3.41.0';
    try {
        const pkg = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf8'));
        if (pkg.version) appVersion = pkg.version;
    } catch {
        // Fallback
    }

    // 1. Discover all tables in public schema
    console.log('Discovering database tables...');
    const tableRows = await sql`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND table_type = 'BASE TABLE'
        ORDER BY table_name ASC
    `;

    const EXCLUDED_TABLES = new Set(['login_attempts', 'schema_migrations']);
    const targetTables = tableRows
        .map((r: any) => r.table_name as string)
        .filter((t: string) => !EXCLUDED_TABLES.has(t));

    console.log(`Found ${targetTables.length} tables to backup: ${targetTables.join(', ')}\n`);

    const tablesData: Record<string, any[]> = {};
    const countsData: Record<string, number> = {};

    const BATCH_LIMIT = 500;

    for (const tableName of targetTables) {
        process.stdout.write(`Exporting table "${tableName}"... `);
        const rows: any[] = [];
        let lastId: string | null = null;
        let hasMore = true;

        // Check if table has 'id' column for keyset pagination
        const colCheck = await sql`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
              AND table_name = ${tableName} 
              AND column_name = 'id'
        `;
        const hasIdCol = colCheck.length > 0;

        const quotedTable = `"${tableName.replace(/"/g, '""')}"`;

        while (hasMore) {
            let batch: any[] = [];
            if (hasIdCol) {
                if (lastId) {
                    batch = await sql(
                        `SELECT * FROM ${quotedTable} WHERE id > $1::uuid ORDER BY id ASC LIMIT $2`,
                        [lastId, BATCH_LIMIT]
                    );
                } else {
                    batch = await sql(
                        `SELECT * FROM ${quotedTable} ORDER BY id ASC LIMIT $1`,
                        [BATCH_LIMIT]
                    );
                }
            } else {
                // Fallback for tables without id column
                batch = await sql(
                    `SELECT * FROM ${quotedTable} OFFSET $1 LIMIT $2`,
                    [rows.length, BATCH_LIMIT]
                );
            }

            if (batch.length > 0) {
                rows.push(...batch);
                if (hasIdCol) {
                    lastId = batch[batch.length - 1].id;
                }
                if (batch.length < BATCH_LIMIT) {
                    hasMore = false;
                }
            } else {
                hasMore = false;
            }
        }

        tablesData[tableName] = rows;
        countsData[tableName] = rows.length;
        console.log(`✓ ${rows.length} row(s)`);
    }

    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const timestampStr = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;

    const backupPayload = {
        version: appVersion,
        createdAt: now.toISOString(),
        tables: tablesData,
        counts: countsData
    };

    const backupsDir = path.resolve(process.cwd(), 'backups');
    if (!fs.existsSync(backupsDir)) {
        fs.mkdirSync(backupsDir, { recursive: true });
    }

    const fileName = `edusync-${timestampStr}.json`;
    const targetFilePath = path.join(backupsDir, fileName);

    fs.writeFileSync(targetFilePath, JSON.stringify(backupPayload, null, 2), 'utf8');

    const fileStat = fs.statSync(targetFilePath);
    const sizeMb = (fileStat.size / (1024 * 1024)).toFixed(2);

    console.log('\n================ BACKUP SUMMARY ================');
    console.log(`Destination: ${targetFilePath}`);
    console.log(`File Size:   ${sizeMb} MB (${fileStat.size.toLocaleString()} bytes)`);
    console.log(`Version:     ${appVersion}`);
    console.log(`Created At:  ${now.toISOString()}`);
    console.log('Row Counts:');
    for (const [tbl, count] of Object.entries(countsData)) {
        console.log(`  - ${tbl.padEnd(20)}: ${count}`);
    }
    console.log('================================================\n');
    console.log('Backup completed successfully.');
}

runBackup().catch((err) => {
    console.error('Fatal backup error:', err);
    process.exit(1);
});
