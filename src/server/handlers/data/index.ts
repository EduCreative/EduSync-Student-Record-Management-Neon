import { getDb, authenticateRequest, serializeCookie, COOKIE_NAME, toCamelCase } from '../../_db';

export default async function handler(req: any, res: any) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', ['GET']);
        return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }

    try {
        const session = authenticateRequest(req);
        if (!session) {
            return res.status(401).json({ error: 'Unauthorized: Session invalid or expired' });
        }

        const sql = getDb();
        console.log("data API userId:", session.userId);
        const userCheck = await sql`SELECT status FROM profiles WHERE id = ${session.userId} LIMIT 1`;
        console.log("data API user status check result:", userCheck);
        if (!userCheck || userCheck.length === 0 || (userCheck[0].status && (userCheck[0].status === 'Inactive' || userCheck[0].status === 'Suspended'))) {
            console.log("data API status check failed, clearing cookie");
            res.setHeader('Set-Cookie', serializeCookie(COOKIE_NAME, '', { maxAge: 0, path: '/' }));
            return res.status(401).json({ error: 'Unauthorized: Account is inactive or suspended' });
        }

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

        // 2. Fetch Classes, Subjects, Exams, Fee Heads, Events
        let classesData: any[] = [];
        let subjectsData: any[] = [];
        let examsData: any[] = [];
        let feeHeadsData: any[] = [];
        let eventsData: any[] = [];

        if (isOwner && !effectiveSchoolId) {
            [classesData, subjectsData, examsData, feeHeadsData, eventsData] = await Promise.all([
                sql`SELECT id, name, section, teacher_id, school_id, sort_order FROM classes ORDER BY sort_order ASC, name ASC`,
                sql`SELECT id, name, school_id FROM subjects ORDER BY name ASC`,
                sql`SELECT id, name, school_id FROM exams ORDER BY name ASC`,
                sql`SELECT id, name, default_amount, school_id FROM fee_heads ORDER BY name ASC`,
                sql`SELECT id, title, description, date, category, school_id FROM school_events ORDER BY date ASC`,
            ]);
        } else if (effectiveSchoolId) {
            [classesData, subjectsData, examsData, feeHeadsData, eventsData] = await Promise.all([
                sql`SELECT id, name, section, teacher_id, school_id, sort_order FROM classes WHERE school_id = ${effectiveSchoolId} ORDER BY sort_order ASC, name ASC`,
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
                    SELECT id, school_id, name, email, role, status, avatar_url, child_student_ids, disabled_nav_links, permissions_overrides, last_login 
                    FROM profiles 
                    WHERE school_id = ${effectiveSchoolId} OR school_id IS NULL
                    ORDER BY name ASC
                  `
                : await sql`
                    SELECT id, school_id, name, email, role, status, avatar_url, child_student_ids, disabled_nav_links, permissions_overrides, last_login 
                    FROM profiles 
                    ORDER BY name ASC
                  `;
        } else if (isAdmin || isAccountant) {
            // Admins & Accountants see users in their school except Owner
            usersData = await sql`
                SELECT id, school_id, name, email, role, status, avatar_url, child_student_ids, disabled_nav_links, permissions_overrides, last_login 
                FROM profiles 
                WHERE (school_id = ${effectiveSchoolId} OR school_id IS NULL) AND role != 'Owner'
                ORDER BY name ASC
            `;
        } else if (isTeacher) {
            // Teachers only see colleagues in their school
            usersData = await sql`
                SELECT id, school_id, name, email, role, status, avatar_url, last_login 
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
                ? await sql`SELECT * FROM students WHERE school_id = ${effectiveSchoolId} ORDER BY roll_number ASC, name ASC`
                : await sql`SELECT * FROM students ORDER BY roll_number ASC, name ASC`;
            
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
                studentsData = await sql`SELECT * FROM students WHERE id = ANY(${childIds}) ORDER BY name ASC`;
            } else {
                studentsData = [];
            }
            targetStudentIds = studentsData.map((s: any) => s.id);

        } else if (isStudent) {
            // Find student profile matching logged in userId
            studentsData = await sql`SELECT * FROM students WHERE user_id = ${userId} LIMIT 1`;
            targetStudentIds = studentsData.map((s: any) => s.id);
        }

        // 5. Fetch Dependent Ledgers (Fees, Attendance, Results)
        let feesData: any[] = [];
        let attData: any[] = [];
        let resData: any[] = [];

        if (targetStudentIds.length > 0) {
            // Fees: Only Owner, Admin, Accountant, Parent, Student (Teachers do not manage fees)
            if (!isTeacher) {
                feesData = await sql`
                    SELECT id, challan_number, student_id, class_id, month, year, due_date, fee_items, 
                           previous_balance, total_amount, discount, paid_amount, status, 
                           paid_date, fine_amount, payment_history, created_at
                    FROM fee_challans 
                    WHERE student_id = ANY(${targetStudentIds})
                    ORDER BY year DESC, month DESC
                `;
            }

            // Attendance and Results
            [attData, resData] = await Promise.all([
                sql`SELECT id, student_id, date, status, school_id FROM attendance WHERE student_id = ANY(${targetStudentIds})`,
                sql`SELECT id, student_id, exam, subject, marks, total_marks, school_id FROM results WHERE student_id = ANY(${targetStudentIds})`,
            ]);
        }

        // 6. Fetch Activity Logs (Owner, Admin, Accountant only)
        let logsData: any[] = [];
        if (isOwner) {
            logsData = effectiveSchoolId
                ? await sql`SELECT * FROM activity_logs WHERE school_id = ${effectiveSchoolId} ORDER BY timestamp DESC LIMIT 250`
                : await sql`SELECT * FROM activity_logs ORDER BY timestamp DESC LIMIT 250`;
        } else if (isAdmin || isAccountant) {
            logsData = await sql`SELECT * FROM activity_logs WHERE school_id = ${effectiveSchoolId} ORDER BY timestamp DESC LIMIT 250`;
        }

        // Transform results into camelCase and enforce proper numbers
        const transformedSchools = toCamelCase(schoolsData);
        const transformedClasses = toCamelCase(classesData);
        const transformedSubjects = toCamelCase(subjectsData);
        const transformedExams = toCamelCase(examsData);
        const transformedEvents = toCamelCase(eventsData);

        const transformedFeeHeads = toCamelCase(feeHeadsData).map((fh: any) => ({
            ...fh,
            defaultAmount: Number(fh.defaultAmount || 0)
        }));

        const transformedUsers = toCamelCase(usersData);

        const transformedStudents = toCamelCase(studentsData).map((s: any) => ({
            ...s,
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

        return res.status(200).json({
            schools: transformedSchools,
            classes: transformedClasses,
            subjects: transformedSubjects,
            exams: transformedExams,
            feeHeads: transformedFeeHeads,
            events: transformedEvents,
            users: transformedUsers,
            students: transformedStudents,
            fees: transformedFees,
            attendance: transformedAttendance,
            results: transformedResults,
            logs: transformedLogs
        });

    } catch (err: any) {
        console.error("Data read API error:", err);
        return res.status(500).json({ error: 'Failed to read school records from database.' });
    }
}
