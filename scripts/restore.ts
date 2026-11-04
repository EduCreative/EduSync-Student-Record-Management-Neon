import { neonConfig, Pool } from '@neondatabase/serverless';
import ws from 'ws';
import fs from 'fs';
import path from 'path';

neonConfig.webSocketConstructor = ws;

async function runRestore() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
        console.error('DATABASE_URL environment variable is required.');
        process.exit(1);
    }

    const backupFilePath = process.argv[2] || path.join(process.cwd(), 'backup.json');
    if (!fs.existsSync(backupFilePath)) {
        console.error(`Backup file not found at ${backupFilePath}`);
        process.exit(1);
    }

    console.log(`Loading backup data from ${backupFilePath}...`);
    const backupData = JSON.parse(fs.readFileSync(backupFilePath, 'utf-8'));

    const pool = new Pool({ connectionString });
    const client = await pool.connect();

    try {
        console.log('Beginning atomic database transaction...');
        await client.query('BEGIN');

        // Delete records in strict dependency order
        await client.query('DELETE FROM results');
        await client.query('DELETE FROM attendance');
        await client.query('DELETE FROM fee_challans');
        await client.query('DELETE FROM students');
        await client.query('DELETE FROM classes');
        await client.query('DELETE FROM fee_heads');
        await client.query('DELETE FROM school_events');
        await client.query('DELETE FROM subjects');
        await client.query('DELETE FROM exams');

        if (backupData.schools && Array.isArray(backupData.schools)) {
            for (const s of backupData.schools) {
                await client.query(
                    `INSERT INTO schools (id, name, address, logo_url) VALUES ($1, $2, $3, $4)
                     ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, address = EXCLUDED.address, logo_url = EXCLUDED.logo_url`,
                    [s.id, s.name, s.address || '', s.logoUrl || s.logo_url || null]
                );
            }
        }

        if (backupData.classes && Array.isArray(backupData.classes)) {
            for (const c of backupData.classes) {
                await client.query(
                    `INSERT INTO classes (id, name, section, teacher_id, school_id, sort_order) VALUES ($1, $2, $3, $4, $5, $6)`,
                    [c.id, c.name, c.section || null, c.teacherId || c.teacher_id || null, c.schoolId || c.school_id, c.sortOrder || c.sort_order || 0]
                );
            }
        }

        if (backupData.feeHeads && Array.isArray(backupData.feeHeads)) {
            for (const fh of backupData.feeHeads) {
                await client.query(
                    `INSERT INTO fee_heads (id, name, default_amount, school_id) VALUES ($1, $2, $3, $4)`,
                    [fh.id, fh.name, Number(fh.defaultAmount || fh.default_amount) || 0, fh.schoolId || fh.school_id]
                );
            }
        }

        if (backupData.students && Array.isArray(backupData.students)) {
            for (const st of backupData.students) {
                await client.query(
                    `INSERT INTO students (id, school_id, class_id, roll_number, name, father_name, father_cnic, date_of_birth, date_of_admission, admitted_class, caste, gr_number, religion, last_school_attended, contact_number, address, gender, avatar_url, user_id, secondary_contact_number, opening_balance, status, fee_structure)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23::jsonb)`,
                    [
                        st.id, st.schoolId || st.school_id, st.classId || st.class_id, st.rollNumber || st.roll_number,
                        st.name, st.fatherName || st.father_name, st.fatherCnic || st.father_cnic,
                        st.dateOfBirth || st.date_of_birth || null, st.dateOfAdmission || st.date_of_admission || null,
                        st.admittedClass || st.admitted_class || '', st.caste || '', st.grNumber || st.gr_number || '',
                        st.religion || '', st.lastSchoolAttended || st.last_school_attended || '',
                        st.contactNumber || st.contact_number || '', st.address || '', st.gender || 'Male',
                        st.avatarUrl || st.avatar_url || null, st.userId || st.user_id || null,
                        st.secondaryContactNumber || st.secondary_contact_number || '',
                        Number(st.openingBalance || st.opening_balance || 0), st.status || 'Active',
                        JSON.stringify(st.feeStructure || st.fee_structure || [])
                    ]
                );
            }
        }

        await client.query('COMMIT');
        console.log('Database restore completed successfully!');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Database restore failed, transaction rolled back:', err);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

runRestore();
