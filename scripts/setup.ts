import { neon } from '@neondatabase/serverless';
import readline from 'readline';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

function ask(rl: readline.Interface, questionText: string): Promise<string> {
    return new Promise((resolve) => {
        rl.question(questionText, (answer) => {
            resolve(answer.trim());
        });
    });
}

function askHidden(promptText: string): Promise<string> {
    return new Promise((resolve) => {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        (rl as any)._writeToOutput = (stringToWrite: string) => {
            if (stringToWrite.includes('\n') || stringToWrite.includes('\r')) {
                process.stdout.write(stringToWrite);
            } else if (stringToWrite.includes(promptText)) {
                process.stdout.write(stringToWrite);
            }
        };
        rl.question(promptText, (answer) => {
            rl.close();
            console.log();
            resolve(answer.trim());
        });
    });
}

async function runSetup() {
    console.log('=== EduSync Initial Setup ===\n');

    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
        console.error('Error: DATABASE_URL environment variable is required.');
        process.exit(1);
    }

    const sql = neon(databaseUrl);

    // 1. Check whether table profiles exists
    try {
        const tableCheck = await sql`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'profiles'
            ) as exists;
        `;

        if (!tableCheck[0]?.exists) {
            console.log('Database tables not found. Please initialize the database schema first:');
            console.log('psql "$DATABASE_URL" -f schema.sql');
            console.log('Open the Neon SQL Editor, paste the whole content of schema.sql, run it, then run npm run setup again.');
            process.exit(2);
        }
    } catch (err: any) {
        console.error('Failed to verify database connection or schema:', err.message || err);
        console.log('psql "$DATABASE_URL" -f schema.sql');
        console.log('Open the Neon SQL Editor, paste the whole content of schema.sql, run it, then run npm run setup again.');
        process.exit(2);
    }

    // 2. Refuse to continue if profiles already has rows, unless --force
    const isForce = process.argv.includes('--force');
    const existingUsers = await sql`SELECT count(*)::int as count FROM profiles`;
    if (existingUsers[0]?.count > 0 && !isForce) {
        console.error("Refusing to continue: table 'profiles' already contains user records. Pass --force to override.");
        process.exit(1);
    }

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    try {
        // 3. Ask interactively
        let schoolName = '';
        while (!schoolName) {
            schoolName = await ask(rl, 'Enter School Name: ');
            if (!schoolName) console.log('School name cannot be empty.');
        }

        let schoolAddress = await ask(rl, 'Enter School Address: ');

        let ownerName = '';
        while (!ownerName) {
            ownerName = await ask(rl, 'Enter Owner Full Name: ');
            if (!ownerName) console.log('Owner name cannot be empty.');
        }

        let ownerEmail = '';
        while (!ownerEmail || !ownerEmail.includes('@')) {
            ownerEmail = await ask(rl, 'Enter Owner Email: ');
            if (!ownerEmail || !ownerEmail.includes('@')) {
                console.log('Please enter a valid email address.');
            }
        }

        let ownerPassword = '';
        while (!ownerPassword) {
            const pass1 = await askHidden('Enter Owner Password (min 10 characters): ');
            if (pass1.length < 10) {
                console.log('Password must be at least 10 characters long.');
                continue;
            }
            const pass2 = await askHidden('Confirm Owner Password: ');
            if (pass1 !== pass2) {
                console.log('Passwords do not match. Please try again.');
                continue;
            }
            ownerPassword = pass1;
        }

        console.log('\nCreating institution and owner account...');

        // Create school
        const schoolId = crypto.randomUUID();
        await sql`
            INSERT INTO schools (id, name, address, logo_url)
            VALUES (${schoolId}, ${schoolName}, ${schoolAddress || ''}, null)
        `;

        // Hash owner password with bcrypt cost 12
        const hashedPassword = await bcrypt.hash(ownerPassword, 12);
        const ownerId = crypto.randomUUID();

        await sql`
            INSERT INTO profiles (id, name, email, password, role, school_id, status, avatar_url)
            VALUES (${ownerId}, ${ownerName}, ${ownerEmail.toLowerCase().trim()}, ${hashedPassword}, 'Owner', ${schoolId}, 'Active', null)
        `;

        // 4. Create default fee head "Tuition Fee" (amount 0)
        const tuitionHeadId = crypto.randomUUID();
        await sql`
            INSERT INTO fee_heads (id, name, default_amount, school_id)
            VALUES (${tuitionHeadId}, 'Tuition Fee', 0, ${schoolId})
        `;
        console.log('Default fee head "Tuition Fee" created (default amount: Rs. 0).');

        // Ask whether to add more fee heads
        let addMore = await ask(rl, 'Do you want to add additional fee heads? (y/N): ');
        while (addMore.toLowerCase() === 'y' || addMore.toLowerCase() === 'yes') {
            const headName = await ask(rl, 'Fee Head Name: ');
            if (headName) {
                const defaultAmountStr = await ask(rl, 'Default Amount (Rs.): ');
                const defaultAmount = Number(defaultAmountStr) || 0;
                await sql`
                    INSERT INTO fee_heads (id, name, default_amount, school_id)
                    VALUES (${crypto.randomUUID()}, ${headName}, ${defaultAmount}, ${schoolId})
                `;
                console.log(`Created fee head "${headName}" with default amount Rs. ${defaultAmount}.`);
            }
            addMore = await ask(rl, 'Add another fee head? (y/N): ');
        }

        // 5. Create schema_migrations if missing and record every file in migrations/ as already applied
        await sql`
            CREATE TABLE IF NOT EXISTS schema_migrations (
                filename TEXT PRIMARY KEY,
                applied_at TIMESTAMPTZ DEFAULT now()
            );
        `;

        const migrationsDir = path.resolve(process.cwd(), 'migrations');
        let recordedMigrations = 0;
        if (fs.existsSync(migrationsDir)) {
            const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
            for (const file of files) {
                await sql`
                    INSERT INTO schema_migrations (filename)
                    VALUES (${file})
                    ON CONFLICT (filename) DO NOTHING
                `;
                recordedMigrations++;
            }
        }

        // 6. Print summary without the password
        console.log('\n===========================================');
        console.log('   EduSync Setup Completed Successfully   ');
        console.log('===========================================');
        console.log(`School Name:          ${schoolName}`);
        console.log(`School ID:            ${schoolId}`);
        console.log(`School Address:       ${schoolAddress || 'N/A'}`);
        console.log(`Owner Name:           ${ownerName}`);
        console.log(`Owner Email:          ${ownerEmail}`);
        console.log(`Owner Role:           Owner`);
        console.log(`Initial Migrations:   ${recordedMigrations} marked applied`);
        console.log('===========================================\n');
        console.log('You may now log in to the application using your owner credentials.\n');

    } finally {
        rl.close();
    }
}

runSetup().catch(err => {
    console.error('Setup failed with error:', err);
    process.exit(1);
});
