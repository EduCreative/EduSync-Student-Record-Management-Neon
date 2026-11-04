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

    const auth = await verifySession(req, res);
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
                AND (${effectiveSchoolId}::uuid IS NULL OR school_id = ${effectiveSchoolId}::uuid)
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

            // Compute historical arrears for all students in ONE aggregated SQL query (A11)
            const studentIdsToQuery = students.map((s: any) => s.id);
            const arrearsAggregation = await sql`
                SELECT 
                    student_id,
                    COALESCE(SUM(
                        COALESCE((
                            SELECT SUM((item->>'amount')::numeric)
                            FROM jsonb_array_elements(
                                CASE WHEN jsonb_typeof(fee_items) = 'array' THEN fee_items ELSE '[]'::jsonb END
                            ) AS item
                        ), 0) + COALESCE(fine_amount, 0)
                    ), 0) AS total_charged,
                    COALESCE(SUM(COALESCE(paid_amount, 0) + COALESCE(discount, 0)), 0) AS total_collected
                FROM fee_challans
                WHERE student_id = ANY(${studentIdsToQuery})
                AND status <> 'Cancelled'
                GROUP BY student_id
            `;

            const arrearsMap = new Map<string, number>();
            for (const row of arrearsAggregation) {
                const charged = Number(row.total_charged) || 0;
                const collected = Number(row.total_collected) || 0;
                arrearsMap.set(row.student_id, Math.max(0, charged - collected));
            }

            const challanRowsToInsert: any[] = [];
            for (const student of students) {
                const historicalDues = arrearsMap.get(student.id) ?? 0;
                const totalArrears = Math.max(0, (Number(student.opening_balance) || 0) + historicalDues);

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
                const totalAmount = subtotal + totalArrears;
                const challanId = crypto.randomUUID();
                const cNum = `${targetYear}${monthStr}-${student.roll_number}`;

                challanRowsToInsert.push({
                    id: challanId,
                    challan_number: cNum,
                    student_id: student.id,
                    class_id: student.class_id,
                    month,
                    year: targetYear,
                    due_date: dueDate || null,
                    status: 'Unpaid',
                    fee_items: items,
                    previous_balance: totalArrears,
                    total_amount: totalAmount,
                    discount: 0,
                    paid_amount: 0,
                    fine_amount: 0
                });
            }

            // Insert in chunks of 100 students with single multi-row INSERT ... ON CONFLICT DO NOTHING (A11)
            let generatedCount = 0;
            let skippedDuplicates = 0;
            const CHUNK_SIZE = 100;

            for (let i = 0; i < challanRowsToInsert.length; i += CHUNK_SIZE) {
                const chunk = challanRowsToInsert.slice(i, i + CHUNK_SIZE);
                const valuePlaceholders: string[] = [];
                const params: any[] = [];
                let p = 1;

                for (const row of chunk) {
                    valuePlaceholders.push(`($${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}::jsonb, $${p++}, $${p++}, $${p++}, $${p++}, $${p++})`);
                    params.push(
                        row.id,
                        row.challan_number,
                        row.student_id,
                        row.class_id,
                        row.month,
                        row.year,
                        row.due_date,
                        row.status,
                        JSON.stringify(row.fee_items),
                        row.previous_balance,
                        row.total_amount,
                        row.discount,
                        row.paid_amount,
                        row.fine_amount
                    );
                }

                const insertQuery = `
                    INSERT INTO fee_challans (
                        id, challan_number, student_id, class_id, month, year, 
                        due_date, status, fee_items, previous_balance, total_amount, 
                        discount, paid_amount, fine_amount
                    ) VALUES ${valuePlaceholders.join(', ')}
                    ON CONFLICT (student_id, month, year) WHERE status <> 'Cancelled' DO NOTHING
                    RETURNING id
                `;

                const insertedRows: any[] = await sql(insertQuery, params);
                const count = insertedRows ? insertedRows.length : 0;
                generatedCount += count;
                skippedDuplicates += (chunk.length - count);
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

            const monthIndex = MONTH_NAMES.indexOf(month) + 1;
            if (monthIndex < 1 || monthIndex > 12) {
                return res.status(400).json({ error: `Invalid month name: ${month}` });
            }

            const effectiveSchoolId = session.role === 'Owner' && schoolId ? schoolId : session.schoolId;

            // Fetch candidate unpaid challans: paid_amount = 0, discount = 0, empty payment_history, not cancelled (A12)
            const candidates = await sql`
                SELECT fc.id, fc.student_id, fc.challan_number, s.name as student_name, s.roll_number
                FROM fee_challans fc
                JOIN students s ON s.id = fc.student_id
                WHERE fc.month = ${month} 
                AND fc.year = ${targetYear} 
                AND fc.paid_amount = 0 
                AND fc.discount = 0
                AND (fc.payment_history IS NULL OR fc.payment_history = '[]'::jsonb)
                AND fc.status != 'Cancelled'
                AND (${effectiveSchoolId}::uuid IS NULL OR s.school_id = ${effectiveSchoolId}::uuid)
            `;

            if (candidates.length === 0) {
                return res.status(200).json({
                    success: true,
                    count: 0,
                    message: `No eligible unpaid challans found for ${month} ${targetYear} (challans with partial payments, discounts, or payment history were preserved).`
                });
            }

            const candidateStudentIds = Array.from(new Set(candidates.map((c: any) => c.student_id)));

            // Refuse (HTTP 409) if any affected student has a non-cancelled challan for a later month/year (A12)
            const laterChallans = await sql`
                SELECT fc.id, fc.student_id, fc.month, fc.year, s.name as student_name, s.roll_number
                FROM fee_challans fc
                JOIN students s ON s.id = fc.student_id
                WHERE fc.student_id = ANY(${candidateStudentIds})
                AND fc.status != 'Cancelled'
                AND (
                    fc.year > ${targetYear}
                    OR (
                        fc.year = ${targetYear} 
                        AND array_position(ARRAY['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']::text[], fc.month) > ${monthIndex}
                    )
                )
                LIMIT 5
            `;

            if (laterChallans.length > 0) {
                const sample = laterChallans[0];
                return res.status(409).json({
                    error: `Cannot delete unpaid challans for ${month} ${targetYear}: ${laterChallans.length} student(s) (such as ${sample.student_name}, Roll #${sample.roll_number}) have active subsequent challans (${sample.month} ${sample.year}). Deleting will break ledger continuity.`
                });
            }

            const candidateIds = candidates.map((c: any) => c.id);
            const deletedRows = await sql`
                DELETE FROM fee_challans
                WHERE id = ANY(${candidateIds})
                RETURNING id
            `;

            await writeServerAuditLog(
                sql,
                session,
                'Delete Challans',
                `Deleted ${deletedRows.length} strictly unpaid challans for ${month} ${targetYear}`,
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
