import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';

async function main() {
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
        console.error("❌ Error: DATABASE_URL environment variable is required.");
        process.exit(1);
    }

    console.log("🔒 EduSync: Starting one-time password hashing migration...");
    const sql = neon(databaseUrl);

    try {
        const profiles = await sql`SELECT id, email, password FROM profiles`;
        console.log(`Found ${profiles.length} total user profile(s).`);

        let hashedCount = 0;
        let skippedCount = 0;
        let errorCount = 0;

        for (const user of profiles) {
            const rawPassword = user.password || '';

            // Skip if already hashed with bcrypt ($2a$, $2b$, or $2y$)
            if (rawPassword.startsWith('$2a$') || rawPassword.startsWith('$2b$') || rawPassword.startsWith('$2y$')) {
                skippedCount++;
                continue;
            }

            if (!rawPassword) {
                console.warn(`⚠️ User ${user.email} (${user.id}) has empty password, skipping.`);
                skippedCount++;
                continue;
            }

            try {
                const hashedPassword = await bcrypt.hash(rawPassword, 10);
                await sql`UPDATE profiles SET password = ${hashedPassword} WHERE id = ${user.id}`;
                hashedCount++;
                console.log(`✓ Hashed password for ${user.email}`);
            } catch (userErr) {
                console.error(`❌ Failed to hash password for ${user.email}:`, userErr);
                errorCount++;
            }
        }

        console.log("\n==========================================");
        console.log("🎉 Password Hashing Migration Completed!");
        console.log(`✓ Total profiles checked: ${profiles.length}`);
        console.log(`✓ Newly hashed passwords: ${hashedCount}`);
        console.log(`✓ Already hashed (skipped): ${skippedCount}`);
        if (errorCount > 0) {
            console.log(`❌ Errors encountered: ${errorCount}`);
        }
        console.log("==========================================\n");

    } catch (err) {
        console.error("❌ Database query failed during migration:", err);
        process.exit(1);
    }
}

main().catch((err) => {
    console.error("Fatal migration error:", err);
    process.exit(1);
});
