/**
 * EduSync Benchmark Load Test Script
 * 
 * Usage:
 *   LOAD_TEST_OK=yes npm run load-test
 * 
 * WARNING: This script seeds high-volume dummy data to benchmark response sizes
 * and latency. It MUST ONLY be run against a throwaway Neon database branch.
 * It will refuse to run if the database contains any real profile records.
 */

import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import zlib from 'zlib';

async function main() {
    console.log('=== EduSync Benchmark Load Test ===\n');

    if (process.env.LOAD_TEST_OK !== 'yes') {
        console.error('SAFETY REFUSAL: LOAD_TEST_OK=yes environment variable is not set.');
        console.error('This script must ONLY be run on a throwaway Neon branch, never against production.');
        console.error('Set LOAD_TEST_OK=yes to confirm you are using an empty throwaway branch.');
        process.exit(1);
    }

    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
        console.error('Error: DATABASE_URL environment variable is required.');
        process.exit(1);
    }

    const sql = neon(databaseUrl);

    // Verify database has no profiles (empty)
    try {
        const countRes = await sql`SELECT count(*)::int as count FROM profiles`;
        const profileCount = Number(countRes[0]?.count || 0);
        if (profileCount > 0) {
            console.error(`SAFETY REFUSAL: Database already contains ${profileCount} profile(s).`);
            console.error('Load testing is only permitted on a fresh, completely empty throwaway Neon database branch.');
            process.exit(1);
        }
    } catch (err: any) {
        console.error('Database connection error during safety check:', err?.message || err);
        process.exit(1);
    }

    console.log('✓ Safety check passed: Database is empty. Seeding synthetic data...');

    const schoolId = crypto.randomUUID();
    const ownerId = crypto.randomUUID();
    const ownerEmail = 'loadtest.owner@example.com';
    const ownerPassword = 'LoadTestPassword123!';
    const hashedPassword = await bcrypt.hash(ownerPassword, 10);

    // 1. Seed School and Owner
    console.log('Creating school and Owner account...');
    await sql`
        INSERT INTO schools (id, name, address, logo_url)
        VALUES (${schoolId}, 'LOADTEST', '123 Benchmark Avenue, Tech City', NULL)
    `;

    await sql`
        INSERT INTO profiles (id, name, email, password, role, school_id, status)
        VALUES (${ownerId}, 'Load Test Owner', ${ownerEmail}, ${hashedPassword}, 'Owner', ${schoolId}, 'Active')
    `;

    // 2. Seed 3 Branches
    console.log('Creating 3 branches...');
    const branchIds: string[] = [];
    for (let i = 1; i <= 3; i++) {
        const bId = crypto.randomUUID();
        branchIds.push(bId);
        await sql`
            INSERT INTO branches (id, name, address, school_id)
            VALUES (${bId}, ${'Branch ' + i}, ${'Campus ' + i + ' Address'}, ${schoolId})
        `;
    }

    // 3. Seed 30 Classes
    console.log('Creating 30 classes...');
    const classIds: string[] = [];
    const classQueries: any[] = [];
    for (let i = 1; i <= 30; i++) {
        const cId = crypto.randomUUID();
        classIds.push(cId);
        const branchId = branchIds[(i - 1) % branchIds.length];
        const grade = Math.ceil(i / 3);
        const section = String.fromCharCode(65 + ((i - 1) % 3));
        classQueries.push(sql`
            INSERT INTO classes (id, name, section, school_id, branch_id, sort_order)
            VALUES (${cId}, ${'Class ' + grade}, ${section}, ${schoolId}, ${branchId}, ${i})
        `);
    }
    await sql.transaction(classQueries);

    // 4. Seed Fee Heads
    console.log('Creating fee heads...');
    const feeHeadQueries = [
        sql`INSERT INTO fee_heads (id, name, default_amount, school_id) VALUES (${crypto.randomUUID()}, 'Tuition Fee', 3500, ${schoolId})`,
        sql`INSERT INTO fee_heads (id, name, default_amount, school_id) VALUES (${crypto.randomUUID()}, 'Exam Fee', 800, ${schoolId})`,
        sql`INSERT INTO fee_heads (id, name, default_amount, school_id) VALUES (${crypto.randomUUID()}, 'Computer Lab', 500, ${schoolId})`
    ];
    await sql.transaction(feeHeadQueries);

    // 5. Seed 8 Subjects & 3 Exams
    console.log('Creating 8 subjects and 3 exams...');
    const subjectNames = ['English', 'Mathematics', 'Urdu', 'Science', 'Social Studies', 'Islamiat', 'Computer Science', 'Art'];
    const examNames = ['First Term 2026', 'Mid Term 2026', 'Final Term 2026'];
    const academicQueries: any[] = [];
    for (const sub of subjectNames) {
        academicQueries.push(sql`INSERT INTO subjects (id, name, school_id) VALUES (${crypto.randomUUID()}, ${sub}, ${schoolId})`);
    }
    for (const ex of examNames) {
        academicQueries.push(sql`INSERT INTO exams (id, name, school_id) VALUES (${crypto.randomUUID()}, ${ex}, ${schoolId})`);
    }
    await sql.transaction(academicQueries);

    // 6. Generate ~35 KB fake base64 JPEG avatar
    const fakeRawBuffer = Buffer.alloc(26000, 0x41); // 26KB binary ~35KB base64
    const fakeAvatarDataUri = `data:image/jpeg;base64,${fakeRawBuffer.toString('base64')}`;

    // 7. Seed 1,500 Students
    console.log('Creating 1,500 students with ~35 KB avatars (batched)...');
    const studentIds: string[] = [];
    const BATCH_SIZE = 250;

    for (let batchStart = 0; batchStart < 1500; batchStart += BATCH_SIZE) {
        const batchQueries: any[] = [];
        for (let i = batchStart; i < batchStart + BATCH_SIZE; i++) {
            const sId = crypto.randomUUID();
            studentIds.push(sId);
            const classId = classIds[i % classIds.length];
            const rollNumber = `R-${1000 + i}`;
            batchQueries.push(sql`
                INSERT INTO students (
                    id, name, roll_number, class_id, school_id, father_name, contact_number,
                    address, status, gender, opening_balance, avatar_url, admitted_class
                ) VALUES (
                    ${sId}, ${'Student ' + (i + 1)}, ${rollNumber}, ${classId}, ${schoolId}, 
                    ${'Parent of ' + (i + 1)}, '03001234567', 'Karachi, Pakistan', 'Active', 
                    ${i % 2 === 0 ? 'Male' : 'Female'}, 0, ${fakeAvatarDataUri}, 'Class 1'
                )
            `);
        }
        await sql.transaction(batchQueries);
        process.stdout.write(`  Inserted ${studentIds.length}/1500 students...\r`);
    }
    console.log('\n✓ 1,500 students inserted.');

    // 8. Seed 12 months fee challans for all 1,500 students (18,000 challans)
    console.log('Generating 12 months fee challans for 1,500 students (18,000 challans)...');
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const currentYear = 2026;

    let challanCount = 0;
    for (let sIdx = 0; sIdx < studentIds.length; sIdx += 100) {
        const chunkStudents = studentIds.slice(sIdx, sIdx + 100);
        const challanQueries: any[] = [];

        for (const sId of chunkStudents) {
            for (let m = 0; m < 12; m++) {
                const cId = crypto.randomUUID();
                const month = months[m];
                const totalAmount = 3500;
                let paidAmount = 0;
                let status = 'Unpaid';
                let history: any[] = [];
                let paidDate: string | null = null;

                // Simulate realistic payment states
                if (m < 8) {
                    paidAmount = 3500;
                    status = 'Paid';
                    paidDate = `2026-0${m + 1}-10`;
                    history = [{ amount: 3500, date: paidDate, paymentMethod: 'Cash' }];
                } else if (m === 8) {
                    paidAmount = 1500;
                    status = 'Partial';
                    paidDate = '2026-09-12';
                    history = [{ amount: 1500, date: paidDate, paymentMethod: 'Bank Transfer' }];
                }

                challanQueries.push(sql`
                    INSERT INTO fee_challans (
                        id, challan_number, student_id, class_id, month, year, due_date,
                        fee_items, previous_balance, total_amount, discount, paid_amount,
                        status, paid_date, fine_amount, payment_history
                    ) VALUES (
                        ${cId}, ${'CH-' + (challanCount++)}, ${sId}, ${classIds[0]}, ${month}, ${currentYear},
                        ${`2026-${String(m + 1).padStart(2, '0')}-15`},
                        ${JSON.stringify([{ head: 'Tuition Fee', amount: totalAmount }])},
                        0, ${totalAmount}, 0, ${paidAmount}, ${status}, ${paidDate}, 0,
                        ${JSON.stringify(history)}
                    )
                `);
            }
        }
        await sql.transaction(challanQueries);
        process.stdout.write(`  Inserted ${challanCount}/18000 challans...\r`);
    }
    console.log(`\n✓ 18,000 fee challans inserted.`);

    // 9. Seed 60 days of attendance for each student (90,000 records)
    console.log('Generating 60 days of attendance for 1,500 students (90,000 records)...');
    let attendanceCount = 0;
    // Generate dates for past 60 days
    const dates: string[] = [];
    const baseDate = new Date(Date.UTC(2026, 10, 1));
    for (let d = 0; d < 60; d++) {
        const dateObj = new Date(baseDate.getTime() - d * 86400000);
        dates.push(dateObj.toISOString().slice(0, 10));
    }

    // Insert in batches of 500
    for (let dIdx = 0; dIdx < dates.length; dIdx += 5) {
        const sliceDates = dates.slice(dIdx, dIdx + 5);
        const attBatch: any[] = [];

        for (const dateStr of sliceDates) {
            for (const sId of studentIds) {
                attBatch.push(sql`
                    INSERT INTO attendance (id, student_id, date, status, school_id)
                    VALUES (${crypto.randomUUID()}, ${sId}, ${dateStr}, 'Present', ${schoolId})
                    ON CONFLICT (student_id, date) DO NOTHING
                `);

                if (attBatch.length >= 500) {
                    await sql.transaction(attBatch);
                    attendanceCount += attBatch.length;
                    attBatch.length = 0;
                    process.stdout.write(`  Inserted ${attendanceCount} attendance records...\r`);
                }
            }
        }
        if (attBatch.length > 0) {
            await sql.transaction(attBatch);
            attendanceCount += attBatch.length;
            attBatch.length = 0;
        }
    }
    console.log(`\n✓ ${attendanceCount} attendance records inserted.`);

    // 10. Seed Exam Results (3 exams x 8 subjects for a sample of students)
    console.log('Generating examination results...');
    const resultBatch: any[] = [];
    const sampleStudents = studentIds.slice(0, 100); // 100 students x 24 results = 2,400 results
    for (const sId of sampleStudents) {
        for (const ex of examNames) {
            for (const sub of subjectNames) {
                resultBatch.push(sql`
                    INSERT INTO results (id, student_id, exam, subject, marks, total_marks, school_id)
                    VALUES (${crypto.randomUUID()}, ${sId}, ${ex}, ${sub}, 85, 100, ${schoolId})
                `);
                if (resultBatch.length >= 500) {
                    await sql.transaction(resultBatch);
                    resultBatch.length = 0;
                }
            }
        }
    }
    if (resultBatch.length > 0) {
        await sql.transaction(resultBatch);
    }
    console.log('✓ Exam results inserted.');

    // 11. Run Benchmark against running server
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    console.log(`\nStarting HTTP benchmark against ${baseUrl}...`);

    try {
        const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: ownerEmail, password: ownerPassword })
        });

        if (!loginRes.ok) {
            const errText = await loginRes.text();
            throw new Error(`Login failed (${loginRes.status}): ${errText}`);
        }

        const cookieHeader = loginRes.headers.get('set-cookie') || '';
        const token = (await loginRes.json()).token;

        const headers: Record<string, string> = {
            'Accept-Encoding': 'gzip'
        };
        if (cookieHeader) headers['Cookie'] = cookieHeader;
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const startTime = Date.now();
        const dataRes = await fetch(`${baseUrl}/api/data`, {
            method: 'GET',
            headers
        });

        const elapsedMs = Date.now() - startTime;
        if (!dataRes.ok) {
            const errText = await dataRes.text();
            throw new Error(`GET /api/data failed (${dataRes.status}): ${errText}`);
        }

        const rawJsonText = await dataRes.text();
        const rawBytes = Buffer.byteLength(rawJsonText, 'utf8');
        const gzipBytes = zlib.gzipSync(Buffer.from(rawJsonText, 'utf8')).length;
        const parsedData = JSON.parse(rawJsonText);

        console.log('\n================ BENCHMARK RESULTS ================');
        console.log(`Response Time:          ${elapsedMs} ms`);
        console.log(`Raw Uncompressed JSON:  ${(rawBytes / 1024 / 1024).toFixed(3)} MB (${rawBytes.toLocaleString()} bytes)`);
        console.log(`Gzip Compressed JSON:   ${(gzipBytes / 1024 / 1024).toFixed(3)} MB (${gzipBytes.toLocaleString()} bytes)`);
        console.log(`Compression Ratio:      ${((1 - gzipBytes / rawBytes) * 100).toFixed(1)}% savings`);
        console.log('---------------------------------------------------');
        console.log('Top-Level Payload Breakdown:');

        const keySizes: { key: string; bytes: number }[] = [];
        for (const [key, val] of Object.entries(parsedData)) {
            const size = Buffer.byteLength(JSON.stringify(val), 'utf8');
            keySizes.push({ key, bytes: size });
        }

        keySizes.sort((a, b) => b.bytes - a.bytes);

        for (const item of keySizes) {
            const kb = (item.bytes / 1024).toFixed(1);
            const pct = ((item.bytes / rawBytes) * 100).toFixed(1);
            console.log(`  - ${item.key.padEnd(16)}: ${kb.padStart(8)} KB (${pct}%)`);
        }
        console.log('===================================================\n');

        if (rawBytes > 4000000) {
            console.error(`FAILURE: Raw response size ${(rawBytes / 1024 / 1024).toFixed(2)} MB exceeded 4,000,000 byte limit!`);
            console.error(`Largest keys: ${keySizes.slice(0, 3).map(k => `${k.key} (${(k.bytes / 1024).toFixed(1)} KB)`).join(', ')}`);
            process.exit(1);
        } else {
            console.log(`SUCCESS: Raw response size ${(rawBytes / 1024 / 1024).toFixed(2)} MB is within the 4.0 MB budget.`);
        }

    } catch (benchErr: any) {
        console.error('Benchmark execution error:', benchErr.message || benchErr);
        console.error('Ensure the server is running on port 3000 (npm run dev) before running the load test.');
        process.exit(1);
    }
}

main().catch((err) => {
    console.error('Fatal load-test error:', err);
    process.exit(1);
});
