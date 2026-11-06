import { neon } from '@neondatabase/serverless';
import fs from 'fs';
import path from 'path';

async function runMigrations() {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
        console.error("Error: DATABASE_URL environment variable is required.");
        process.exit(1);
    }

    const sql = neon(databaseUrl);

    // Ensure schema_migrations tracking table exists
    await sql`
        CREATE TABLE IF NOT EXISTS schema_migrations (
            filename TEXT PRIMARY KEY,
            applied_at TIMESTAMPTZ DEFAULT now()
        );
    `;

    // Fetch already applied migrations
    const appliedRows = await sql`SELECT filename FROM schema_migrations`;
    const appliedSet = new Set(appliedRows.map((r: any) => r.filename));

    const migrationsDir = path.resolve(process.cwd(), 'migrations');
    if (!fs.existsSync(migrationsDir)) {
        console.log("No migrations directory found.");
        return;
    }

    const files = fs.readdirSync(migrationsDir)
        .filter(f => f.endsWith('.sql'))
        .sort();

    let appliedCount = 0;

    for (const file of files) {
        if (appliedSet.has(file)) {
            continue;
        }

        const filePath = path.join(migrationsDir, file);
        const content = fs.readFileSync(filePath, 'utf8');

        if (content.includes('$$')) {
            console.error(`Migration error: File "${file}" contains "$$" blocks which are disallowed.`);
            process.exit(1);
        }

        // Split statements by semicolon at the end of lines
        const statements = content
            .split(/;\s*$/m)
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.startsWith('--'));

        try {
            console.log(`Applying migration ${file}...`);
            if (statements.length > 0) {
                const queries = statements.map(stmt => sql(stmt));
                queries.push(sql`INSERT INTO schema_migrations (filename) VALUES (${file})`);
                await sql.transaction(queries);
            } else {
                await sql`INSERT INTO schema_migrations (filename) VALUES (${file})`;
            }

            console.log(`Applied ${file}`);
            appliedCount++;
        } catch (err: any) {
            console.error(`Failed to apply migration "${file}":`, err.message || err);
            process.exit(1);
        }
    }

    if (appliedCount === 0) {
        console.log("Database migrations: Already up to date.");
    } else {
        console.log(`Successfully applied ${appliedCount} migration(s).`);
    }
}

runMigrations().catch(err => {
    console.error("Migration execution failed:", err);
    process.exit(1);
});
