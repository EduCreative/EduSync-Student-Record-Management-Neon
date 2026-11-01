import { verifySession, isAuthorized, writeServerAuditLog } from './_helpers';
import crypto from 'crypto';

export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }

    const auth = await verifySession(req, res);
    if (!auth) return;
    const { session, sql } = auth;

    if (!isAuthorized(session, ['Owner', 'Admin'])) {
        return res.status(403).json({ error: 'Access denied: Only Admins and Owners can perform data restore.' });
    }

    try {
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
        const { backupData, targetSchoolId } = body;

        if (!backupData || typeof backupData !== 'object') {
            return res.status(400).json({ error: 'Valid backupData payload is required.' });
        }

        const isOwnerGlobal = session.role === 'Owner' && !targetSchoolId;
        const effectiveSchoolId = session.role === 'Owner' && targetSchoolId ? targetSchoolId : session.schoolId;

        if (!isOwnerGlobal && !effectiveSchoolId) {
            return res.status(400).json({ error: 'A specific target school ID is required for school restore.' });
        }

        // Execute inside an explicit SQL transaction block:
        // BEGIN ... COMMIT / ROLLBACK
        await sql`BEGIN`;

        try {
            if (isOwnerGlobal) {
                // Owner Global Restore
                // Clean child tables in strict reverse-FK dependency order
                await sql`DELETE FROM results`;
                await sql`DELETE FROM attendance`;
                await sql`DELETE FROM fee_challans`;
                await sql`DELETE FROM students`;
                await sql`DELETE FROM classes`;
                await sql`DELETE FROM fee_heads`;
                await sql`DELETE FROM school_events`;
                await sql`DELETE FROM subjects`;
                await sql`DELETE FROM exams`;
                // DO NOT delete Owners or active staff accounts to prevent lockout
                // Only delete non-staff accounts or preserve all profiles with safe upsert
                if (backupData.schools?.length) {
                    for (const s of backupData.schools) {
                        await sql`
                            INSERT INTO schools (id, name, address, logo_url)
                            VALUES (${s.id}, ${s.name}, ${s.address || ''}, ${s.logoUrl || s.logo_url || null})
                            ON CONFLICT (id) DO UPDATE 
                            SET name = EXCLUDED.name, address = EXCLUDED.address, logo_url = EXCLUDED.logo_url
                        `;
                    }
                }
            } else {
                // Single School Restore:
                // Purge only academic and financial records for this specific school
                await sql`DELETE FROM results WHERE student_id IN (SELECT id FROM students WHERE school_id = ${effectiveSchoolId})`;
                await sql`DELETE FROM attendance WHERE student_id IN (SELECT id FROM students WHERE school_id = ${effectiveSchoolId})`;
                await sql`DELETE FROM fee_challans WHERE student_id IN (SELECT id FROM students WHERE school_id = ${effectiveSchoolId})`;
                await sql`DELETE FROM students WHERE school_id = ${effectiveSchoolId}`;
                await sql`DELETE FROM classes WHERE school_id = ${effectiveSchoolId}`;
                await sql`DELETE FROM fee_heads WHERE school_id = ${effectiveSchoolId}`;
                await sql`DELETE FROM school_events WHERE school_id = ${effectiveSchoolId}`;
                await sql`DELETE FROM subjects WHERE school_id = ${effectiveSchoolId}`;
                await sql`DELETE FROM exams WHERE school_id = ${effectiveSchoolId}`;
                // CRITICAL FIX: DO NOT delete staff profiles or activity logs!
                // Staff accounts and their bcrypt hashes are strictly preserved.
            }

            // Restore Classes
            if (Array.isArray(backupData.classes) && backupData.classes.length > 0) {
                for (const c of backupData.classes) {
                    const sid = isOwnerGlobal ? (c.schoolId || c.school_id) : effectiveSchoolId;
                    await sql`
                        INSERT INTO classes (id, name, section, teacher_id, school_id, sort_order)
                        VALUES (${c.id || crypto.randomUUID()}, ${c.name}, ${c.section || null}, ${c.teacherId || c.teacher_id || null}, ${sid}, ${c.sortOrder || c.sort_order || 0})
                    `;
                }
            }

            // Restore Fee Heads
            if (Array.isArray(backupData.feeHeads) && backupData.feeHeads.length > 0) {
                for (const fh of backupData.feeHeads) {
                    const sid = isOwnerGlobal ? (fh.schoolId || fh.school_id) : effectiveSchoolId;
                    await sql`
                        INSERT INTO fee_heads (id, name, default_amount, school_id)
                        VALUES (${fh.id || crypto.randomUUID()}, ${fh.name}, ${Number(fh.defaultAmount || fh.default_amount) || 0}, ${sid})
                    `;
                }
            }

            // Restore Subjects
            if (Array.isArray(backupData.subjects) && backupData.subjects.length > 0) {
                for (const s of backupData.subjects) {
                    const sid = isOwnerGlobal ? (s.schoolId || s.school_id) : effectiveSchoolId;
                    await sql`
                        INSERT INTO subjects (id, name, school_id)
                        VALUES (${s.id || crypto.randomUUID()}, ${s.name}, ${sid})
                    `;
                }
            }

            // Restore Exams
            if (Array.isArray(backupData.exams) && backupData.exams.length > 0) {
                for (const e of backupData.exams) {
                    const sid = isOwnerGlobal ? (e.schoolId || e.school_id) : effectiveSchoolId;
                    await sql`
                        INSERT INTO exams (id, name, school_id)
                        VALUES (${e.id || crypto.randomUUID()}, ${e.name}, ${sid})
                    `;
                }
            }

            // Restore Events
            if (Array.isArray(backupData.events) && backupData.events.length > 0) {
                for (const ev of backupData.events) {
                    const sid = isOwnerGlobal ? (ev.schoolId || ev.school_id) : effectiveSchoolId;
                    await sql`
                        INSERT INTO school_events (id, title, date, category, description, school_id)
                        VALUES (${ev.id || crypto.randomUUID()}, ${ev.title}, ${ev.date}, ${ev.category || 'general'}, ${ev.description || ''}, ${sid})
                    `;
                }
            }

            // Restore Students
            if (Array.isArray(backupData.students) && backupData.students.length > 0) {
                for (const st of backupData.students) {
                    const sid = isOwnerGlobal ? (st.schoolId || st.school_id) : effectiveSchoolId;
                    const feeStructure = st.feeStructure || st.fee_structure || [];
                    await sql`
                        INSERT INTO students (
                            id, name, roll_number, class_id, school_id, father_name, father_cnic, 
                            date_of_birth, date_of_admission, contact_number, secondary_contact_number, 
                            address, status, gender, admitted_class, gr_number, religion, caste, 
                            last_school_attended, opening_balance, user_id, fee_structure, avatar_url
                        ) VALUES (
                            ${st.id || crypto.randomUUID()}, ${st.name}, ${st.rollNumber || st.roll_number}, 
                            ${st.classId || st.class_id || null}, ${sid}, 
                            ${st.fatherName || st.father_name || null}, ${st.fatherCnic || st.father_cnic || null}, 
                            ${st.dateOfBirth || st.date_of_birth || null}, ${st.dateOfAdmission || st.date_of_admission || null}, 
                            ${st.contactNumber || st.contact_number || null}, ${st.secondaryContactNumber || st.secondary_contact_number || null}, 
                            ${st.address || null}, ${st.status || 'Active'}, ${st.gender || 'Male'}, 
                            ${st.admittedClass || st.admitted_class || null}, ${st.grNumber || st.gr_number || null}, 
                            ${st.religion || null}, ${st.caste || null}, ${st.lastSchoolAttended || st.last_school_attended || null}, 
                            ${Number(st.openingBalance || st.opening_balance) || 0}, ${st.userId || st.user_id || null}, 
                            ${JSON.stringify(feeStructure)}, ${st.avatarUrl || st.avatar_url || null}
                        )
                    `;
                }
            }

            // Restore Fees
            if (Array.isArray(backupData.fees) && backupData.fees.length > 0) {
                for (const f of backupData.fees) {
                    let history = f.paymentHistory || f.payment_history || [];
                    if (typeof history === 'string') {
                        try { history = JSON.parse(history); } catch { history = []; }
                    }
                    const feeItems = f.feeItems || f.fee_items || [];
                    await sql`
                        INSERT INTO fee_challans (
                            id, challan_number, student_id, class_id, month, year, 
                            due_date, status, fee_items, previous_balance, total_amount, 
                            discount, paid_amount, fine_amount, paid_date, payment_history
                        ) VALUES (
                            ${f.id || crypto.randomUUID()}, ${f.challanNumber || f.challan_number}, 
                            ${f.studentId || f.student_id}, ${f.classId || f.class_id || null}, 
                            ${f.month}, ${Number(f.year)}, ${f.dueDate || f.due_date || null}, 
                            ${f.status || 'Unpaid'}, ${JSON.stringify(feeItems)}, 
                            ${Number(f.previousBalance || f.previous_balance) || 0}, 
                            ${Number(f.totalAmount || f.total_amount) || 0}, 
                            ${Number(f.discount) || 0}, ${Number(f.paidAmount || f.paid_amount) || 0}, 
                            ${Number(f.fineAmount || f.fine_amount) || 0}, 
                            ${f.paidDate || f.paid_date || null}, ${JSON.stringify(history)}
                        )
                    `;
                }
            }

            // Restore Attendance
            if (Array.isArray(backupData.attendance) && backupData.attendance.length > 0) {
                for (const a of backupData.attendance) {
                    const sid = isOwnerGlobal ? (a.schoolId || a.school_id) : effectiveSchoolId;
                    await sql`
                        INSERT INTO attendance (id, student_id, date, status, school_id)
                        VALUES (${a.id || crypto.randomUUID()}, ${a.studentId || a.student_id}, ${a.date}, ${a.status}, ${sid || null})
                    `;
                }
            }

            // Restore Results
            if (Array.isArray(backupData.results) && backupData.results.length > 0) {
                for (const r of backupData.results) {
                    const sid = isOwnerGlobal ? (r.schoolId || r.school_id) : effectiveSchoolId;
                    await sql`
                        INSERT INTO results (id, student_id, class_id, exam, subject, marks, total_marks, school_id)
                        VALUES (
                            ${r.id || crypto.randomUUID()}, ${r.studentId || r.student_id}, 
                            ${r.classId || r.class_id}, ${r.exam}, ${r.subject}, 
                            ${Number(r.marks) || 0}, ${Number(r.totalMarks || r.total_marks) || 100}, 
                            ${sid || null}
                        )
                    `;
                }
            }

            // If everything succeeded without exception, COMMIT transaction
            await sql`COMMIT`;

            await writeServerAuditLog(
                sql,
                session,
                'Restore Database',
                `Successfully restored database backup (${isOwnerGlobal ? 'Full Global Restore' : `School ID: ${effectiveSchoolId}`})`,
                effectiveSchoolId
            );

            return res.status(200).json({ success: true, message: 'Restore completed successfully.' });

        } catch (txnError: any) {
            // ROLLBACK on any failure to preserve existing database state
            await sql`ROLLBACK`;
            console.error("Restore transaction failed, rolled back:", txnError);
            return res.status(500).json({ error: `Restore failed and was rolled back: ${txnError.message || txnError}` });
        }

    } catch (err: any) {
        console.error("Restore API fatal error:", err);
        return res.status(500).json({ error: err.message || 'Fatal error during restore operation.' });
    }
}
