import { verifySession, isAuthorized, writeServerAuditLog, validateAvatarDataUrl, canAccessClass, canAccessStudent } from './_helpers';
import { getTodayKarachi } from '../../../utils/dates';
import crypto from 'crypto';

export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }

    const auth = await verifySession(req, res);
    if (!auth) return;
    const { session, sql } = auth;

    if (!isAuthorized(session, ['Owner', 'Admin', 'Accountant'])) {
        return res.status(403).json({ error: 'Access denied: Insufficient permissions to modify student records.' });
    }

    try {
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
        const { action } = body;

        if (action !== 'update-fee-structure' && !isAuthorized(session, ['Owner', 'Admin'])) {
            return res.status(403).json({ error: 'Access denied: Only Admins and Owners can modify student profile records.' });
        }

        if (action === 'add-student') {
            const { student } = body;
            if (!student || !student.name || !student.rollNumber) {
                return res.status(400).json({ error: 'Student name and roll number are required.' });
            }

            if (student.classId) {
                const canAccess = await canAccessClass(sql, session, student.classId);
                if (!canAccess) return res.status(403).json({ error: 'Outside your branch' });
            } else if (session.role !== 'Owner' && session.branchId) {
                return res.status(403).json({ error: 'Outside your branch' });
            }

            if (student.avatarUrl) {
                const avatarCheck = validateAvatarDataUrl(student.avatarUrl);
                if (!avatarCheck.valid) {
                    return res.status(400).json({ error: avatarCheck.error });
                }
            }

            const effectiveSchoolId = session.role === 'Owner' && student.schoolId ? student.schoolId : session.schoolId;
            const id = crypto.randomUUID();
            const avatarUrlToInsert = (student.avatarUrl && typeof student.avatarUrl === 'string' && student.avatarUrl.startsWith('data:'))
                ? student.avatarUrl
                : null;

            try {
                await sql`
                    INSERT INTO students (
                        id, name, roll_number, class_id, school_id, father_name, father_cnic, 
                        date_of_birth, date_of_admission, contact_number, secondary_contact_number, 
                        address, status, gender, admitted_class, gr_number, religion, caste, 
                        last_school_attended, opening_balance, user_id, fee_structure, avatar_url
                    ) VALUES (
                        ${id}, ${student.name}, ${student.rollNumber}, ${student.classId || null}, 
                        ${effectiveSchoolId}, ${student.fatherName || null}, ${student.fatherCnic || null}, 
                        ${student.dateOfBirth || null}, ${student.dateOfAdmission || null}, 
                        ${student.contactNumber || null}, ${student.secondaryContactNumber || null}, 
                        ${student.address || null}, 'Active', ${student.gender || 'Male'}, 
                        ${student.admittedClass || null}, ${student.grNumber || null}, 
                        ${student.religion || null}, ${student.caste || null}, 
                        ${student.lastSchoolAttended || null}, ${Number(student.openingBalance) || 0}, 
                        ${student.userId || null}, ${JSON.stringify(student.feeStructure || [])},
                        ${avatarUrlToInsert}
                    )
                `;
            } catch (err: any) {
                if (err?.code === '23505' || err?.message?.includes('23505') || err?.message?.includes('students_school_roll_unique')) {
                    return res.status(409).json({ error: 'DUPLICATE_ROLL', rollNumber: student.rollNumber, message: `Roll number "${student.rollNumber}" already exists in this school.` });
                }
                throw err;
            }

            await writeServerAuditLog(
                sql,
                session,
                'Add Student',
                `Added student: ${student.name} (Roll #${student.rollNumber})`,
                effectiveSchoolId
            );

            return res.status(200).json({ success: true, id });

        } else if (action === 'update-student') {
            const { student } = body;
            if (!student || !student.id) {
                return res.status(400).json({ error: 'Student ID is required.' });
            }

            const canAccEst = await canAccessStudent(sql, session, student.id);
            if (!canAccEst) return res.status(403).json({ error: 'Outside your branch' });

            if (student.classId) {
                const canAccCls = await canAccessClass(sql, session, student.classId);
                if (!canAccCls) return res.status(403).json({ error: 'Outside your branch' });
            } else if (session.role !== 'Owner' && session.branchId) {
                return res.status(403).json({ error: 'Outside your branch' });
            }

            const existingRows = await sql`SELECT id, school_id, name, roll_number FROM students WHERE id = ${student.id}`;
            if (existingRows.length === 0) {
                return res.status(404).json({ error: 'Student not found.' });
            }

            const existing = existingRows[0];
            if (session.role !== 'Owner' && session.schoolId && existing.school_id !== session.schoolId) {
                return res.status(403).json({ error: 'Unauthorized: Student belongs to another school.' });
            }

            if (student.avatarUrl) {
                const avatarCheck = validateAvatarDataUrl(student.avatarUrl);
                if (!avatarCheck.valid) {
                    return res.status(400).json({ error: avatarCheck.error });
                }
            }

            try {
                await sql`
                    UPDATE students SET
                        name = ${student.name},
                        roll_number = ${student.rollNumber},
                        class_id = ${student.classId || null},
                        father_name = ${student.fatherName || null},
                        father_cnic = ${student.fatherCnic || null},
                        date_of_birth = ${student.dateOfBirth || null},
                        date_of_admission = ${student.dateOfAdmission || null},
                        contact_number = ${student.contactNumber || null},
                        secondary_contact_number = ${student.secondaryContactNumber || null},
                        address = ${student.address || null},
                        status = ${student.status || 'Active'},
                        gender = ${student.gender || 'Male'},
                        avatar_url = CASE 
                            WHEN ${Boolean(student.avatarUrl && typeof student.avatarUrl === 'string' && student.avatarUrl.startsWith('/api/photo'))} THEN avatar_url
                            WHEN ${Boolean(student.avatarUrl && typeof student.avatarUrl === 'string' && student.avatarUrl.startsWith('data:'))} THEN ${student.avatarUrl}
                            WHEN ${student.avatarUrl === null || student.avatarUrl === ''} THEN NULL
                            ELSE avatar_url
                        END,
                        admitted_class = ${student.admittedClass || null},
                        gr_number = ${student.grNumber || null},
                        religion = ${student.religion || null},
                        caste = ${student.caste || null},
                        last_school_attended = ${student.lastSchoolAttended || null},
                        opening_balance = ${Number(student.openingBalance) || 0},
                        user_id = ${student.userId || null}
                    WHERE id = ${student.id}
                `;
            } catch (err: any) {
                if (err?.code === '23505' || err?.message?.includes('23505') || err?.message?.includes('students_school_roll_unique')) {
                    return res.status(409).json({ error: 'DUPLICATE_ROLL', rollNumber: student.rollNumber, message: `Roll number "${student.rollNumber}" already exists in this school.` });
                }
                throw err;
            }

            await writeServerAuditLog(
                sql,
                session,
                'Edit Student',
                `Updated student profile: ${student.name} (Roll #${student.rollNumber})`,
                existing.school_id
            );

            return res.status(200).json({ success: true });

        } else if (action === 'delete-student') {
            const { studentId } = body;
            if (!studentId) {
                return res.status(400).json({ error: 'Student ID is required.' });
            }

            const canAccEst = await canAccessStudent(sql, session, studentId);
            if (!canAccEst) return res.status(403).json({ error: 'Outside your branch' });

            const existingRows = await sql`SELECT id, school_id, name, roll_number FROM students WHERE id = ${studentId}`;
            if (existingRows.length === 0) {
                return res.status(404).json({ error: 'Student not found.' });
            }

            const existing = existingRows[0];
            if (session.role !== 'Owner' && session.schoolId && existing.school_id !== session.schoolId) {
                return res.status(403).json({ error: 'Unauthorized: Student belongs to another school.' });
            }

            await sql`UPDATE students SET status = 'Deleted' WHERE id = ${studentId}`;

            await writeServerAuditLog(
                sql,
                session,
                'Delete Student',
                `Soft deleted student: ${existing.name} (Roll #${existing.roll_number})`,
                existing.school_id
            );

            return res.status(200).json({ success: true });

        } else if (action === 'bulk-add-students') {
            const { students, schoolId } = body;
            if (!Array.isArray(students) || students.length === 0) {
                return res.status(400).json({ error: 'Students array is required.' });
            }

            const effectiveSchoolId = session.role === 'Owner' && schoolId ? schoolId : session.schoolId;

            // Validate all rows first (P10) & Check branch access
            const seenRollNumbers = new Set<string>();
            const fileDuplicates: string[] = [];

            for (let i = 0; i < students.length; i++) {
                const s = students[i];
                const name = (s.name || '').toString().trim();
                const roll = (s.rollNumber || s.roll_number || '').toString().trim();

                if (!name || !roll) {
                    return res.status(400).json({ error: `Student name and roll number are required for all rows (row ${i + 1} is missing required fields).` });
                }

                const targetClassId = s.classId || s.class_id;
                const canAccess = await canAccessClass(sql, session, targetClassId);
                if (!canAccess) {
                    return res.status(403).json({ error: 'Outside your branch' });
                }

                if (seenRollNumbers.has(roll)) {
                    fileDuplicates.push(roll);
                }
                seenRollNumbers.add(roll);
            }

            if (fileDuplicates.length > 0) {
                const uniqueDupes = Array.from(new Set(fileDuplicates));
                return res.status(400).json({ error: `Duplicate roll number(s) found in file: ${uniqueDupes.join(', ')}` });
            }

            try {
                // Build all INSERTs and run in one atomic sql.transaction (P10)
                const queries = students.map((s: any) => {
                    const id = crypto.randomUUID();
                    const roll = (s.rollNumber || s.roll_number).toString().trim();
                    return sql`
                        INSERT INTO students (
                            id, name, roll_number, class_id, school_id, father_name, father_cnic, 
                            date_of_birth, date_of_admission, contact_number, secondary_contact_number, 
                            address, status, gender, admitted_class, gr_number, religion, caste, 
                            last_school_attended, opening_balance, user_id, fee_structure
                        ) VALUES (
                            ${id}, ${s.name.trim()}, ${roll}, ${s.classId || s.class_id || null}, 
                            ${effectiveSchoolId}, ${s.fatherName || s.father_name || null}, ${s.fatherCnic || s.father_cnic || null}, 
                            ${s.dateOfBirth || s.date_of_birth || null}, ${s.dateOfAdmission || s.date_of_admission || null}, 
                            ${s.contactNumber || s.contact_number || null}, ${s.secondaryContactNumber || s.secondary_contact_number || null}, 
                            ${s.address || null}, 'Active', ${s.gender || 'Male'}, ${s.admittedClass || s.admitted_class || null}, 
                            ${s.grNumber || s.gr_number || null}, ${s.religion || null}, ${s.caste || null}, 
                            ${s.lastSchoolAttended || s.last_school_attended || null}, ${Number(s.openingBalance || s.opening_balance) || 0}, 
                            ${s.userId || s.user_id || null}, ${JSON.stringify(s.feeStructure || s.fee_structure || [])}::jsonb
                        )
                    `;
                });

                await sql.transaction(queries);

                await writeServerAuditLog(
                    sql,
                    session,
                    'Bulk Import Students',
                    `Bulk imported ${students.length} students`,
                    effectiveSchoolId
                );

                return res.status(200).json({ success: true, count: students.length });

            } catch (err: any) {
                if (err?.code === '23505' || err?.message?.includes('23505') || err?.message?.includes('students_school_roll_unique')) {
                    const match = err?.detail?.match(/Key \(school_id, roll_number\)=\([^,]+, ([^)]+)\)/);
                    const conflictedRoll = match ? match[1] : (err.rollNumber || 'duplicate');
                    return res.status(409).json({ error: 'DUPLICATE_ROLL', rollNumber: conflictedRoll, message: `Roll number "${conflictedRoll}" already exists in this school.` });
                }
                throw err;
            }

        } else if (action === 'issue-certificate') {
            const { studentId, details } = body;
            if (!studentId || !details) {
                return res.status(400).json({ error: 'Student ID and details are required.' });
            }

            const canAccEst = await canAccessStudent(sql, session, studentId);
            if (!canAccEst) return res.status(403).json({ error: 'Outside your branch' });

            const existingRows = await sql`SELECT id, school_id, name, roll_number FROM students WHERE id = ${studentId}`;
            if (existingRows.length === 0) {
                return res.status(404).json({ error: 'Student not found.' });
            }

            const existing = existingRows[0];
            if (session.role !== 'Owner' && session.schoolId && existing.school_id !== session.schoolId) {
                return res.status(403).json({ error: 'Unauthorized: Student belongs to another school.' });
            }

            await sql`
                UPDATE students 
                SET 
                    status = 'Left',
                    date_of_leaving = ${details.dateOfLeaving || details.date_of_leaving || getTodayKarachi()},
                    reason_for_leaving = ${details.reasonForLeaving || details.reason_for_leaving || null},
                    conduct = ${details.conduct || null},
                    progress = ${details.progress || null},
                    place_of_birth = ${details.placeOfBirth || details.place_of_birth || null}
                WHERE id = ${studentId}
            `;

            await writeServerAuditLog(
                sql,
                session,
                'Issue Certificate',
                `Issued school leaving certificate for ${existing.name} (Roll #${existing.roll_number})`,
                existing.school_id
            );

            return res.status(200).json({ success: true });

        } else if (action === 'promote-students') {
            const { graduations, promotions, schoolId } = body;
            const effectiveSchoolId = session.role === 'Owner' && schoolId ? schoolId : session.schoolId;

            if (Array.isArray(graduations) && graduations.length > 0) {
                for (const gId of graduations) {
                    const canAcc = await canAccessStudent(sql, session, gId);
                    if (!canAcc) return res.status(403).json({ error: 'Outside your branch' });
                }
            }

            if (promotions && typeof promotions === 'object') {
                for (const [targetClassId, stdIds] of Object.entries(promotions)) {
                    const canAccCls = await canAccessClass(sql, session, targetClassId);
                    if (!canAccCls) return res.status(403).json({ error: 'Outside your branch' });
                    if (Array.isArray(stdIds)) {
                        for (const sId of stdIds) {
                            const canAccStd = await canAccessStudent(sql, session, sId as string);
                            if (!canAccStd) return res.status(403).json({ error: 'Outside your branch' });
                        }
                    }
                }
            }

            let updatedCount = 0;
            const queries: any[] = [];

            if (Array.isArray(graduations) && graduations.length > 0) {
                const CHUNK = 50;
                for (let i = 0; i < graduations.length; i += CHUNK) {
                    const chunk = graduations.slice(i, i + CHUNK);
                    queries.push(sql`
                        UPDATE students 
                        SET status = 'Graduated' 
                        WHERE id = ANY(${chunk})
                        AND (${effectiveSchoolId}::uuid IS NULL OR school_id = ${effectiveSchoolId}::uuid)
                    `);
                }
                updatedCount += graduations.length;
            }

            if (promotions && typeof promotions === 'object') {
                for (const [targetClassId, stdIds] of Object.entries(promotions)) {
                    if (Array.isArray(stdIds) && stdIds.length > 0) {
                        const CHUNK = 50;
                        for (let i = 0; i < stdIds.length; i += CHUNK) {
                            const chunk = stdIds.slice(i, i + CHUNK);
                            queries.push(sql`
                                UPDATE students 
                                SET class_id = ${targetClassId}, status = 'Active' 
                                WHERE id = ANY(${chunk})
                                AND (${effectiveSchoolId}::uuid IS NULL OR school_id = ${effectiveSchoolId}::uuid)
                            `);
                        }
                        updatedCount += stdIds.length;
                    }
                }
            }

            if (queries.length > 0) {
                await sql.transaction(queries);
            }

            await writeServerAuditLog(
                sql,
                session,
                'Promote Students',
                `Promoted/graduated ${updatedCount} students`,
                effectiveSchoolId
            );

            return res.status(200).json({ success: true, count: updatedCount });

        } else if (action === 'reactivate-graduated') {
            const { studentIds, targetClassId, schoolId } = body;
            const effectiveSchoolId = session.role === 'Owner' && schoolId ? schoolId : session.schoolId;

            if (!Array.isArray(studentIds) || studentIds.length === 0) {
                return res.status(400).json({ error: 'studentIds array is required.' });
            }

            for (const sId of studentIds) {
                const canAcc = await canAccessStudent(sql, session, sId);
                if (!canAcc) return res.status(403).json({ error: 'Outside your branch' });
            }

            if (targetClassId) {
                const canAccCls = await canAccessClass(sql, session, targetClassId);
                if (!canAccCls) return res.status(403).json({ error: 'Outside your branch' });
            }

            const queries: any[] = [];
            const CHUNK = 50;
            for (let i = 0; i < studentIds.length; i += CHUNK) {
                const chunk = studentIds.slice(i, i + CHUNK);
                if (targetClassId) {
                    queries.push(sql`
                        UPDATE students 
                        SET status = 'Active', class_id = ${targetClassId} 
                        WHERE id = ANY(${chunk})
                        AND (${effectiveSchoolId}::uuid IS NULL OR school_id = ${effectiveSchoolId}::uuid)
                    `);
                } else {
                    queries.push(sql`
                        UPDATE students 
                        SET status = 'Active' 
                        WHERE id = ANY(${chunk})
                        AND (${effectiveSchoolId}::uuid IS NULL OR school_id = ${effectiveSchoolId}::uuid)
                    `);
                }
            }

            if (queries.length > 0) {
                await sql.transaction(queries);
            }

            await writeServerAuditLog(
                sql,
                session,
                'Reactivate Students',
                `Reactivated ${studentIds.length} graduated student(s) to Active status`,
                effectiveSchoolId
            );

            return res.status(200).json({ success: true, count: studentIds.length });

        } else if (action === 'revert-promotion') {
            const { groups, schoolId } = body;
            const effectiveSchoolId = session.role === 'Owner' && schoolId ? schoolId : session.schoolId;

            if (!groups || typeof groups !== 'object') {
                return res.status(400).json({ error: 'Groups object is required.' });
            }

            for (const [key, ids] of Object.entries(groups)) {
                const [classId] = key.split('__');
                const canAccCls = await canAccessClass(sql, session, classId);
                if (!canAccCls) return res.status(403).json({ error: 'Outside your branch' });
                if (Array.isArray(ids)) {
                    for (const sId of ids) {
                        const canAccStd = await canAccessStudent(sql, session, sId as string);
                        if (!canAccStd) return res.status(403).json({ error: 'Outside your branch' });
                    }
                }
            }

            let revertedCount = 0;
            const queries: any[] = [];
            for (const [key, ids] of Object.entries(groups)) {
                const [classId, status] = key.split('__');
                const idList = ids as string[];
                if (Array.isArray(idList) && idList.length > 0) {
                    const CHUNK = 50;
                    for (let i = 0; i < idList.length; i += CHUNK) {
                        const chunk = idList.slice(i, i + CHUNK);
                        queries.push(sql`
                            UPDATE students 
                            SET class_id = ${classId}, status = ${status} 
                            WHERE id = ANY(${chunk})
                            AND (${effectiveSchoolId}::uuid IS NULL OR school_id = ${effectiveSchoolId}::uuid)
                        `);
                    }
                    revertedCount += idList.length;
                }
            }

            if (queries.length > 0) {
                await sql.transaction(queries);
            }

            await writeServerAuditLog(
                sql,
                session,
                'Revert Promotion',
                `Reverted promotion for ${revertedCount} students`,
                effectiveSchoolId
            );

            return res.status(200).json({ success: true, count: revertedCount });

        } else if (action === 'update-fee-structure') {
            const { studentId, feeStructure } = body;
            if (!studentId || !Array.isArray(feeStructure)) {
                return res.status(400).json({ error: 'studentId and feeStructure array are required.' });
            }

            const canAccEst = await canAccessStudent(sql, session, studentId);
            if (!canAccEst) return res.status(403).json({ error: 'Outside your branch' });

            for (const item of feeStructure) {
                if (!item.feeHeadId || typeof item.amount !== 'number' || item.amount < 0) {
                    return res.status(400).json({ error: 'Invalid fee structure item: feeHeadId and valid amount are required.' });
                }
            }

            const existingRows = await sql`SELECT id, school_id, name, roll_number FROM students WHERE id = ${studentId}`;
            if (existingRows.length === 0) {
                return res.status(404).json({ error: 'Student not found.' });
            }

            const existing = existingRows[0];
            if (session.role !== 'Owner' && session.schoolId && existing.school_id !== session.schoolId) {
                return res.status(403).json({ error: 'Unauthorized: Student belongs to another school.' });
            }

            await sql`
                UPDATE students 
                SET fee_structure = ${JSON.stringify(feeStructure)}::jsonb 
                WHERE id = ${studentId}
            `;

            await writeServerAuditLog(
                sql,
                session,
                'Update Fee Structure',
                `Updated fee structure for ${existing.name} (Roll #${existing.roll_number})`,
                existing.school_id
            );

            return res.status(200).json({ success: true });

        } else {
            return res.status(400).json({ error: `Unknown action: ${action}` });
        }

    } catch (err: any) {
        console.error("Student API error:", err);
        return res.status(500).json({ error: err.message || 'Server error processing student mutation.' });
    }
}
