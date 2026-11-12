import { getDb, getSessionUser, toCamelCase } from '../../_db';
import { getCurrentKarachiYear, getKarachiDateOffset } from '../../../utils/dates';

export default async function handler(req: any, res: any) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', ['GET']);
        return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }

    try {
        const session = await getSessionUser(req, res);
        if (!session) {
            return res.status(401).json({ error: 'Unauthorized: Session invalid or expired' });
        }

        const sql = getDb();
        const { role, userId, schoolId: userSchoolId } = session;
        const requestedSchoolId = req.query?.schoolId || req.query?.activeSchoolId;

        // Role-based scoping determination
        const isOwner = role === 'Owner';
        const isAdmin = role === 'Admin';
        const isAccountant = role === 'Accountant';
        const isTeacher = role === 'Teacher';
        const isParent = role === 'Parent';
        const isStudent = role === 'Student';

        const effectiveSchoolId = isOwner 
            ? (requestedSchoolId || null) 
            : userSchoolId;

        // 1. Fetch Schools
        let schoolsData: any[] = [];
        if (isOwner) {
            schoolsData = await sql`SELECT id, name, address, logo_url FROM schools ORDER BY name ASC`;
        } else if (effectiveSchoolId) {
            schoolsData = await sql`SELECT id, name, address, logo_url FROM schools WHERE id = ${effectiveSchoolId}`;
        }

        // Branch lock status
        const isLocked = Boolean(role !== 'Owner' && session.branchId);
        const lockBranchId = session.branchId;

        // 2. Fetch Classes, Branches, Subjects, Exams, Fee Heads, Events
        let classesData: any[] = [];
        let branchesData: any[] = [];
        let subjectsData: any[] = [];
        let examsData: any[] = [];
        let feeHeadsData: any[] = [];
        let eventsData: any[] = [];

        if (isOwner && !effectiveSchoolId) {
            [classesData, branchesData, subjectsData, examsData, feeHeadsData, eventsData] = await Promise.all([
                sql`SELECT id, name, section, teacher_id, school_id, branch_id, sort_order FROM classes ORDER BY sort_order ASC, name ASC`,
                sql`SELECT id, name, address, school_id FROM branches ORDER BY name ASC`,
                sql`SELECT id, name, school_id FROM subjects ORDER BY name ASC`,
                sql`SELECT id, name, school_id FROM exams ORDER BY name ASC`,
                sql`SELECT id, name, default_amount, school_id FROM fee_heads ORDER BY name ASC`,
                sql`SELECT id, title, description, date, category, school_id FROM school_events ORDER BY date ASC`,
            ]);
        } else if (effectiveSchoolId) {
            const classesQuery = isLocked
                ? sql`SELECT id, name, section, teacher_id, school_id, branch_id, sort_order FROM classes WHERE school_id = ${effectiveSchoolId} AND branch_id = ${lockBranchId} ORDER BY sort_order ASC, name ASC`
                : sql`SELECT id, name, section, teacher_id, school_id, branch_id, sort_order FROM classes WHERE school_id = ${effectiveSchoolId} ORDER BY sort_order ASC, name ASC`;

            const branchesQuery = isLocked
                ? sql`SELECT id, name, address, school_id FROM branches WHERE school_id = ${effectiveSchoolId} AND id = ${lockBranchId} ORDER BY name ASC`
                : sql`SELECT id, name, address, school_id FROM branches WHERE school_id = ${effectiveSchoolId} ORDER BY name ASC`;

            [classesData, branchesData, subjectsData, examsData, feeHeadsData, eventsData] = await Promise.all([
                classesQuery,
                branchesQuery,
                sql`SELECT id, name, school_id FROM subjects WHERE school_id = ${effectiveSchoolId} ORDER BY name ASC`,
                sql`SELECT id, name, school_id FROM exams WHERE school_id = ${effectiveSchoolId} ORDER BY name ASC`,
                sql`SELECT id, name, default_amount, school_id FROM fee_heads WHERE school_id = ${effectiveSchoolId} ORDER BY name ASC`,
                sql`SELECT id, title, description, date, category, school_id FROM school_events WHERE school_id = ${effectiveSchoolId} ORDER BY date ASC`,
            ]);
        }

        // 3. Fetch Users (Profiles) - NEVER return password, omit non-staff profiles for Parents/Students
        let usersData: any[] = [];
        if (isOwner) {
            usersData = effectiveSchoolId
                ? await sql`
                    SELECT id, school_id, branch_id, name, email, role, status, 
                           (avatar_url IS NOT NULL AND avatar_url <> '') AS has_avatar, 
                           length(avatar_url) AS avatar_len, 
                           child_student_ids, disabled_nav_links, permissions_overrides, last_login 
                    FROM profiles 
                    WHERE school_id = ${effectiveSchoolId} OR school_id IS NULL
                    ORDER BY name ASC
                  `
                : await sql`
                    SELECT id, school_id, branch_id, name, email, role, status, 
                           (avatar_url IS NOT NULL AND avatar_url <> '') AS has_avatar, 
                           length(avatar_url) AS avatar_len, 
                           child_student_ids, disabled_nav_links, permissions_overrides, last_login 
                    FROM profiles 
                    ORDER BY name ASC
                  `;
        } else if (isAdmin || isAccountant) {
            usersData = isLocked
                ? await sql`
                    SELECT id, school_id, branch_id, name, email, role, status, 
                           (avatar_url IS NOT NULL AND avatar_url <> '') AS has_avatar, 
                           length(avatar_url) AS avatar_len, 
                           child_student_ids, disabled_nav_links, permissions_overrides, last_login 
                    FROM profiles 
                    WHERE (school_id = ${effectiveSchoolId} OR school_id IS NULL) 
                      AND branch_id = ${lockBranchId} 
                      AND role != 'Owner'
                    ORDER BY name ASC
                  `
                : await sql`
                    SELECT id, school_id, branch_id, name, email, role, status, 
                           (avatar_url IS NOT NULL AND avatar_url <> '') AS has_avatar, 
                           length(avatar_url) AS avatar_len, 
                           child_student_ids, disabled_nav_links, permissions_overrides, last_login 
                    FROM profiles 
                    WHERE (school_id = ${effectiveSchoolId} OR school_id IS NULL) AND role != 'Owner'
                    ORDER BY name ASC
                  `;
        } else if (isTeacher) {
            usersData = isLocked
                ? await sql`
                    SELECT id, school_id, branch_id, name, email, role, status, 
                           (avatar_url IS NOT NULL AND avatar_url <> '') AS has_avatar, 
                           length(avatar_url) AS avatar_len, 
                           last_login 
                    FROM profiles 
                    WHERE school_id = ${effectiveSchoolId} 
                      AND branch_id = ${lockBranchId}
                      AND role IN ('Admin', 'Accountant', 'Teacher')
                    ORDER BY name ASC
                  `
                : await sql`
                    SELECT id, school_id, branch_id, name, email, role, status, 
                           (avatar_url IS NOT NULL AND avatar_url <> '') AS has_avatar, 
                           length(avatar_url) AS avatar_len, 
                           last_login 
                    FROM profiles 
                    WHERE school_id = ${effectiveSchoolId} AND role IN ('Admin', 'Accountant', 'Teacher')
                    ORDER BY name ASC
                  `;
        } else {
            // Parents and Students do not see other user records
            usersData = [];
        }

        // 4. Determine Student ID Scope
        let studentsData: any[] = [];
        let targetStudentIds: string[] = [];

        if (isOwner || isAdmin || isAccountant || isTeacher) {
            studentsData = effectiveSchoolId
                ? (isLocked
                    ? await sql`
                        SELECT id, user_id, name, class_id, school_id, roll_number, gr_number, religion,
                               father_name, father_cnic, date_of_birth, date_of_admission, contact_number,
                               secondary_contact_number, address, status, gender, date_of_leaving,
                               reason_for_leaving, conduct, progress, place_of_birth, opening_balance,
                               fee_structure, admitted_class, caste, last_school_attended,
                               (avatar_url IS NOT NULL AND avatar_url <> '') AS has_avatar,
                               length(avatar_url) AS avatar_len
                        FROM students 
                        WHERE school_id = ${effectiveSchoolId}
                          AND class_id IN (SELECT id FROM classes WHERE branch_id = ${lockBranchId})
                        ORDER BY roll_number ASC, name ASC
                      `
                    : await sql`
                        SELECT id, user_id, name, class_id, school_id, roll_number, gr_number, religion,
                               father_name, father_cnic, date_of_birth, date_of_admission, contact_number,
                               secondary_contact_number, address, status, gender, date_of_leaving,
                               reason_for_leaving, conduct, progress, place_of_birth, opening_balance,
                               fee_structure, admitted_class, caste, last_school_attended,
                               (avatar_url IS NOT NULL AND avatar_url <> '') AS has_avatar,
                               length(avatar_url) AS avatar_len
                        FROM students 
                        WHERE school_id = ${effectiveSchoolId} 
                        ORDER BY roll_number ASC, name ASC
                      `)
                : await sql`
                    SELECT id, user_id, name, class_id, school_id, roll_number, gr_number, religion,
                           father_name, father_cnic, date_of_birth, date_of_admission, contact_number,
                           secondary_contact_number, address, status, gender, date_of_leaving,
                           reason_for_leaving, conduct, progress, place_of_birth, opening_balance,
                           fee_structure, admitted_class, caste, last_school_attended,
                           (avatar_url IS NOT NULL AND avatar_url <> '') AS has_avatar,
                           length(avatar_url) AS avatar_len
                    FROM students 
                    ORDER BY roll_number ASC, name ASC
                  `;
            
            // For teachers, omit sensitive father_cnic
            if (isTeacher) {
                studentsData = studentsData.map((s: any) => {
                    const { father_cnic: _fc, ...safeStudent } = s;
                    return safeStudent;
                });
            }
            targetStudentIds = studentsData.map((s: any) => s.id);

        } else if (isParent) {
            // Find parent profile to get linked child IDs
            const parentProfile = await sql`SELECT child_student_ids, phone_number, email FROM profiles WHERE id = ${userId} LIMIT 1`;
            let childIds: string[] = [];
            if (parentProfile.length > 0) {
                const p = parentProfile[0];
                if (Array.isArray(p.child_student_ids)) {
                    childIds = p.child_student_ids;
                } else if (typeof p.child_student_ids === 'string') {
                    try { childIds = JSON.parse(p.child_student_ids); } catch { childIds = []; }
                }
            }

            if (childIds.length > 0) {
                studentsData = await sql`
                    SELECT id, user_id, name, class_id, school_id, roll_number, gr_number, religion,
                           father_name, father_cnic, date_of_birth, date_of_admission, contact_number,
                           secondary_contact_number, address, status, gender, date_of_leaving,
                           reason_for_leaving, conduct, progress, place_of_birth, opening_balance,
                           fee_structure, admitted_class, caste, last_school_attended,
                           (avatar_url IS NOT NULL AND avatar_url <> '') AS has_avatar,
                           length(avatar_url) AS avatar_len
                    FROM students 
                    WHERE id = ANY(${childIds}) 
                    ORDER BY name ASC
                `;
            } else {
                studentsData = [];
            }
            targetStudentIds = studentsData.map((s: any) => s.id);

        } else if (isStudent) {
            // Find student profile matching logged in userId
            studentsData = await sql`
                SELECT id, user_id, name, class_id, school_id, roll_number, gr_number, religion,
                       father_name, father_cnic, date_of_birth, date_of_admission, contact_number,
                       secondary_contact_number, address, status, gender, date_of_leaving,
                       reason_for_leaving, conduct, progress, place_of_birth, opening_balance,
                       fee_structure, admitted_class, caste, last_school_attended,
                       (avatar_url IS NOT NULL AND avatar_url <> '') AS has_avatar,
                       length(avatar_url) AS avatar_len
                FROM students 
                WHERE user_id = ${userId} 
                LIMIT 1
            `;
            targetStudentIds = studentsData.map((s: any) => s.id);
        }

        // 5. Fetch Dependent Ledgers (Fees, Attendance, Results)
        let feesData: any[] = [];
        let attData: any[] = [];
        let resData: any[] = [];
        let ledgerRows: any[] = [];

        if (targetStudentIds.length > 0) {
            // Fees: Only Owner, Admin, Accountant, Parent, Student (Teachers do not manage fees)
            // A14: Scoped query by academic year (defaults to current Karachi year, ?year=all to disable)
            const requestedYear = req.query?.year;
            let effectiveYear: number | null = null;
            if (requestedYear) {
                if (requestedYear !== 'all') {
                    const parsed = parseInt(String(requestedYear), 10);
                    if (!isNaN(parsed)) effectiveYear = parsed;
                }
            } else {
                effectiveYear = getCurrentKarachiYear();
            }

            if (!isTeacher) {
                let currentFeesData: any[] = [];
                let earlierOutstandingFees: any[] = [];

                if (effectiveYear !== null) {
                    currentFeesData = await sql`
                        SELECT id, challan_number, student_id, class_id, month, year, due_date, fee_items, 
                               previous_balance, total_amount, discount, paid_amount, status, 
                               paid_date, fine_amount, payment_history, created_at
                        FROM fee_challans 
                        WHERE student_id = ANY(${targetStudentIds}) AND year = ${effectiveYear}
                        ORDER BY year DESC, month DESC
                    `;

                    earlierOutstandingFees = await sql`
                        SELECT id, challan_number, student_id, class_id, month, year, due_date, fee_items,
                               previous_balance, total_amount, discount, paid_amount, status,
                               paid_date, fine_amount, payment_history, created_at
                        FROM fee_challans
                        WHERE student_id = ANY(${targetStudentIds})
                          AND year < ${effectiveYear}
                          AND status <> 'Cancelled'
                          AND (paid_amount + discount) < total_amount
                        ORDER BY year DESC, month DESC
                    `;
                } else {
                    currentFeesData = await sql`
                        SELECT id, challan_number, student_id, class_id, month, year, due_date, fee_items, 
                               previous_balance, total_amount, discount, paid_amount, status, 
                               paid_date, fine_amount, payment_history, created_at
                        FROM fee_challans 
                        WHERE student_id = ANY(${targetStudentIds})
                        ORDER BY year DESC, month DESC
                    `;
                }

                const feeMap = new Map();
                for (const f of [...currentFeesData, ...earlierOutstandingFees]) {
                    feeMap.set(f.id, f);
                }
                feesData = Array.from(feeMap.values());
            }

            if (!isTeacher && targetStudentIds.length > 0) {
                ledgerRows = await sql`
                    WITH charged AS (
                      SELECT student_id,
                        COALESCE(SUM(
                          COALESCE((SELECT SUM((item->>'amount')::numeric)
                                    FROM jsonb_array_elements(
                                      CASE WHEN jsonb_typeof(fee_items) = 'array' THEN fee_items ELSE '[]'::jsonb END
                                    ) AS item), 0)
                          + COALESCE(fine_amount, 0)
                        ), 0) AS total_charged,
                        COALESCE(SUM(paid_amount), 0) AS total_paid,
                        COALESCE(SUM(discount), 0) AS total_discount
                      FROM fee_challans
                      WHERE student_id = ANY(${targetStudentIds})
                        AND status <> 'Cancelled'
                      GROUP BY student_id
                    )
                    SELECT
                      s.id AS student_id,
                      COALESCE(c.total_charged, 0) AS total_charged,
                      COALESCE(c.total_paid, 0) AS total_paid,
                      COALESCE(c.total_discount, 0) AS total_discount,
                      COALESCE(s.opening_balance, 0) AS opening_balance,
                      COALESCE(s.opening_balance, 0) + COALESCE(c.total_charged, 0) - COALESCE(c.total_paid, 0) - COALESCE(c.total_discount, 0) AS balance
                    FROM students s
                    LEFT JOIN charged c ON c.student_id = s.id
                    WHERE s.id = ANY(${targetStudentIds})
                `;
            }

            // Attendance (A14: Default attendance to last 45 days, support ?attendanceFrom=&attendanceTo=)
            // P17: Omit school_id as client never uses attendance.schoolId
            const attendanceFrom = req.query?.attendanceFrom;
            const attendanceTo = req.query?.attendanceTo;

            let attQuery;
            if (attendanceFrom === 'all') {
                attQuery = sql`SELECT id, student_id, date, status FROM attendance WHERE student_id = ANY(${targetStudentIds})`;
            } else if (attendanceFrom && attendanceTo) {
                attQuery = sql`SELECT id, student_id, date, status FROM attendance WHERE student_id = ANY(${targetStudentIds}) AND date >= ${attendanceFrom} AND date <= ${attendanceTo}`;
            } else if (attendanceFrom) {
                attQuery = sql`SELECT id, student_id, date, status FROM attendance WHERE student_id = ANY(${targetStudentIds}) AND date >= ${attendanceFrom}`;
            } else {
                // Default: Last 45 days
                const defaultAttendanceFrom = getKarachiDateOffset(-45);
                attQuery = sql`SELECT id, student_id, date, status FROM attendance WHERE student_id = ANY(${targetStudentIds}) AND date >= ${defaultAttendanceFrom}`;
            }

            const resQuery = sql`SELECT id, student_id, exam, subject, marks, total_marks, school_id FROM results WHERE student_id = ANY(${targetStudentIds})`;

            [attData, resData] = await Promise.all([attQuery, resQuery]);
        }

        // 6. Fetch Activity Logs (Owner, Admin, Accountant only)
        let logsData: any[] = [];
        if (isOwner) {
            logsData = effectiveSchoolId
                ? await sql`SELECT * FROM activity_logs WHERE school_id = ${effectiveSchoolId} ORDER BY timestamp DESC LIMIT 250`
                : await sql`SELECT * FROM activity_logs ORDER BY timestamp DESC LIMIT 250`;
        } else if (isAdmin || isAccountant) {
            logsData = isLocked
                ? await sql`
                    SELECT * FROM activity_logs 
                    WHERE school_id = ${effectiveSchoolId} 
                      AND user_id IN (SELECT id FROM profiles WHERE branch_id = ${lockBranchId})
                    ORDER BY timestamp DESC LIMIT 250
                  `
                : await sql`SELECT * FROM activity_logs WHERE school_id = ${effectiveSchoolId} ORDER BY timestamp DESC LIMIT 250`;
        }

        // Transform results into camelCase and enforce proper numbers
        const transformedSchools = toCamelCase(schoolsData);
        const transformedClasses = toCamelCase(classesData);
        const transformedBranches = toCamelCase(branchesData);
        const transformedSubjects = toCamelCase(subjectsData);
        const transformedExams = toCamelCase(examsData);
        const transformedEvents = toCamelCase(eventsData);

        const transformedFeeHeads = toCamelCase(feeHeadsData).map((fh: any) => ({
            ...fh,
            defaultAmount: Number(fh.defaultAmount || 0)
        }));

        const transformedUsers = toCamelCase(usersData).map((u: any) => ({
            ...u,
            avatarUrl: u.hasAvatar ? `/api/photo?kind=user&id=${u.id}&v=${u.avatarLen || 0}` : null
        }));

        const transformedStudents = toCamelCase(studentsData).map((s: any) => ({
            ...s,
            avatarUrl: s.hasAvatar ? `/api/photo?kind=student&id=${s.id}&v=${s.avatarLen || 0}` : null,
            openingBalance: Number(s.openingBalance || 0),
            feeStructure: (s.feeStructure || []).map((item: any) => ({
                ...item,
                amount: Number(item.amount || 0)
            }))
        }));

        const transformedFees = toCamelCase(feesData).map((f: any) => {
            let history = f.paymentHistory;
            if (typeof history === 'string') {
                try { history = JSON.parse(history); } catch { history = []; }
            }
            if (!Array.isArray(history)) history = [];

            return {
                ...f,
                previousBalance: Number(f.previousBalance || 0),
                totalAmount: Number(f.totalAmount || 0),
                discount: Number(f.discount || 0),
                paidAmount: Number(f.paidAmount || 0),
                fineAmount: Number(f.fineAmount || 0),
                paymentHistory: history.map((p: any) => ({
                    ...p,
                    amount: Number(p.amount || 0)
                }))
            };
        });

        const transformedAttendance = toCamelCase(attData);

        const transformedResults = toCamelCase(resData).map((r: any) => ({
            ...r,
            marks: Number(r.marks || 0),
            totalMarks: Number(r.totalMarks || 100)
        }));

        const transformedLogs = toCamelCase(logsData);

        const transformedLedger = isTeacher ? [] : toCamelCase(ledgerRows).map((l: any) => ({
            studentId: l.studentId,
            totalCharged: Number(l.totalCharged || 0),
            totalPaid: Number(l.totalPaid || 0),
            totalDiscount: Number(l.totalDiscount || 0),
            openingBalance: Number(l.openingBalance || 0),
            balance: Number(l.balance || 0),
        }));

        const payload = {
            schools: transformedSchools,
            classes: transformedClasses,
            branches: transformedBranches,
            subjects: transformedSubjects,
            exams: transformedExams,
            feeHeads: transformedFeeHeads,
            events: transformedEvents,
            users: transformedUsers,
            students: transformedStudents,
            fees: transformedFees,
            attendance: transformedAttendance,
            results: transformedResults,
            logs: transformedLogs,
            ledger: transformedLedger
        };

        const jsonString = JSON.stringify(payload);
        const payloadBytes = Buffer.byteLength(jsonString, 'utf8');
        res.setHeader('X-Payload-Bytes', payloadBytes.toString());
        if (payloadBytes > 3 * 1024 * 1024) {
            console.warn(`[WARN] /api/data uncompressed payload exceeded 3 MB: ${(payloadBytes / (1024 * 1024)).toFixed(2)} MB (${payloadBytes} bytes)`);
        }

        res.setHeader('Content-Type', 'application/json');
        return res.status(200).send(jsonString);

    } catch (err: any) {
        console.error("Data read API error:", err);
        return res.status(500).json({ error: 'Failed to read school records from database.' });
    }
}
