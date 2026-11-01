import { verifySession, isAuthorized, writeServerAuditLog } from './_helpers';
import crypto from 'crypto';

const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }

    const auth = verifySession(req, res);
    if (!auth) return;
    const { session, sql } = auth;

    if (!isAuthorized(session, ['Owner', 'Admin', 'Accountant'])) {
        return res.status(403).json({ error: 'Access denied: You do not have permission to generate or manage challans.' });
    }

    try {
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
        const { action } = body;

        if (action === 'generate') {
            const { month, year, selectedFeeHeads, studentIds, dueDate, schoolId } = body;
            const targetYear = Number(year);

            if (!month || !targetYear || !Array.isArray(studentIds) || studentIds.length === 0) {
                return res.status(400).json({ error: 'Month, year, and studentIds array are required.' });
            }

            const effectiveSchoolId = session.role === 'Owner' && schoolId ? schoolId : session.schoolId;

            // Fetch students belonging to this school
            const students = await sql`
                SELECT id, name, roll_number, class_id, school_id, opening_balance, fee_structure
                FROM students
                WHERE id = ANY(${studentIds})
                AND (${effectiveSchoolId ? sql`school_id = ${effectiveSchoolId}` : sql`TRUE`})
                AND status = 'Active'
            `;

            if (students.length === 0) {
                return res.status(400).json({ error: 'No active students found for challan generation.' });
            }

            // Fetch all fee heads for reference
            const feeHeads = await sql`SELECT id, name, default_amount FROM fee_heads`;
            const feeHeadMap = new Map(feeHeads.map((fh: any) => [fh.id, fh.name]));

            const monthIndex = MONTH_NAMES.indexOf(month) + 1;
            const monthStr = String(monthIndex).padStart(2, '0');

            // Find existing non-cancelled challans for these students for month & year
            const existingChallans = await sql`
                SELECT student_id 
                FROM fee_challans 
                WHERE student_id = ANY(${students.map((s: any) => s.id)})
                AND month = ${month} 
                AND year = ${targetYear} 
                AND status != 'Cancelled'
            `;
            const existingStudentSet = new Set(existingChallans.map((c: any) => c.student_id));

            let generatedCount = 0;
            let skippedDuplicates = 0;

            for (const student of students) {
                // GUARD: Check against duplicate challan
                if (existingStudentSet.has(student.id)) {
                    skippedDuplicates++;
                    continue;
                }

                // Compute historical arrears from all past non-cancelled challans
                const pastChallans = await sql`
                    SELECT fee_items, fine_amount, paid_amount, discount
                    FROM fee_challans
                    WHERE student_id = ${student.id}
                    AND status != 'Cancelled'
                `;

                let totalCharged = Number(student.opening_balance) || 0;
                let totalCollected = 0;

                for (const pc of pastChallans) {
                    let items = pc.fee_items || [];
                    if (typeof items === 'string') {
                        try { items = JSON.parse(items); } catch { items = []; }
                    }
                    if (Array.isArray(items)) {
                        for (const item of items) {
                            totalCharged += Number(item.amount) || 0;
                        }
                    }
                    totalCharged += Number(pc.fine_amount) || 0;
                    totalCollected += (Number(pc.paid_amount) || 0) + (Number(pc.discount) || 0);
                }

                const arrears = Math.max(0, totalCharged - totalCollected);

                // Student fee structure overrides
                let studentStructure = student.fee_structure || [];
                if (typeof studentStructure === 'string') {
                    try { studentStructure = JSON.parse(studentStructure); } catch { studentStructure = []; }
                }
                const feeStructureMap = new Map((studentStructure || []).map((item: any) => [item.feeHeadId, Number(item.amount) || 0]));

                const items = (selectedFeeHeads || []).map((h: any) => ({
                    description: feeHeadMap.get(h.feeHeadId) || 'Fee',
                    amount: feeStructureMap.get(h.feeHeadId) ?? (Number(h.amount) || 0)
                }));

                const subtotal = items.reduce((sum: number, i: any) => sum + (Number(i.amount) || 0), 0);
                const totalAmount = subtotal + arrears;
                const challanId = crypto.randomUUID();
                const cNum = `${targetYear}${monthStr}-${student.roll_number}`;

                await sql`
                    INSERT INTO fee_challans (
                        id, challan_number, student_id, class_id, month, year, 
                        due_date, status, fee_items, previous_balance, total_amount, 
                        discount, paid_amount, fine_amount
                    ) VALUES (
                        ${challanId}, ${cNum}, ${student.id}, ${student.class_id}, ${month}, ${targetYear}, 
                        ${dueDate || null}, 'Unpaid', ${JSON.stringify(items)}, ${arrears}, ${totalAmount}, 
                        0, 0, 0
                    )
                `;

                generatedCount++;
            }

            await writeServerAuditLog(
                sql,
                session,
                'Generate Challans',
                `Generated ${generatedCount} fee challans for ${month} ${targetYear} (Skipped ${skippedDuplicates} duplicates)`,
                effectiveSchoolId
            );

            return res.status(200).json({
                success: true,
                count: generatedCount,
                skippedDuplicates
            });

        } else if (action === 'delete-unpaid') {
            const { month, year, schoolId } = body;
            const targetYear = Number(year);

            if (!month || !targetYear) {
                return res.status(400).json({ error: 'Month and year are required.' });
            }

            const effectiveSchoolId = session.role === 'Owner' && schoolId ? schoolId : session.schoolId;

            const deletedRows = await sql`
                DELETE FROM fee_challans 
                WHERE month = ${month} 
                AND year = ${targetYear} 
                AND paid_amount = 0 
                AND student_id IN (
                    SELECT id FROM students 
                    WHERE (${effectiveSchoolId ? sql`school_id = ${effectiveSchoolId}` : sql`TRUE`})
                )
                RETURNING id
            `;

            await writeServerAuditLog(
                sql,
                session,
                'Delete Challans',
                `Deleted ${deletedRows.length} unpaid challans for ${month} ${targetYear}`,
                effectiveSchoolId
            );

            return res.status(200).json({
                success: true,
                count: deletedRows.length
            });

        } else {
            return res.status(400).json({ error: `Unknown action: ${action}` });
        }

    } catch (err: any) {
        console.error("Challan API error:", err);
        return res.status(500).json({ error: err.message || 'Server error processing challans.' });
    }
}
