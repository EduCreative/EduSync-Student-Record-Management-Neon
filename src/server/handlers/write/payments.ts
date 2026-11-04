import { verifySession, isAuthorized, writeServerAuditLog } from './_helpers';

export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }

    const auth = await verifySession(req, res);
    if (!auth) return;
    const { session, sql } = auth;

    // Payments can only be managed by Owner, Admin, Accountant
    if (!isAuthorized(session, ['Owner', 'Admin', 'Accountant'])) {
        return res.status(403).json({ error: 'Access denied: You do not have permission to manage fee payments.' });
    }

    try {
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
        const { action } = body;

        if (action === 'record-payment') {
            const { challanId, amount, discount = 0, paidDate, allowOverpayment, idempotencyKey } = body;
            const numAmount = Number(amount) || 0;
            const numDiscount = Number(discount) || 0;

            if (!challanId || numAmount <= 0) {
                return res.status(400).json({ error: 'Challan ID and valid positive amount are required.' });
            }

            if (numDiscount < 0) {
                return res.status(400).json({ error: 'Discount cannot be negative.' });
            }

            // Fetch challan and verify school access via student
            const challanRows = await sql`
                SELECT fc.*, s.school_id, s.name as student_name, s.roll_number
                FROM fee_challans fc
                JOIN students s ON s.id = fc.student_id
                WHERE fc.id = ${challanId}
                LIMIT 1
            `;

            if (challanRows.length === 0) {
                return res.status(404).json({ error: 'Challan not found.' });
            }

            const challan = challanRows[0];

            // Verify school isolation
            if (session.role !== 'Owner' && session.schoolId && challan.school_id !== session.schoolId) {
                return res.status(403).json({ error: 'Unauthorized: This challan belongs to another school.' });
            }

            // Reject payments on Cancelled challans (A8)
            if (challan.status === 'Cancelled') {
                return res.status(400).json({ error: 'Cannot record payment on a cancelled challan.' });
            }

            // Check existing payment history for idempotency retry (B1)
            let existingHistory = challan.payment_history || [];
            if (typeof existingHistory === 'string') {
                try { existingHistory = JSON.parse(existingHistory); } catch { existingHistory = []; }
            }
            if (!Array.isArray(existingHistory)) existingHistory = [];

            if (idempotencyKey && existingHistory.some((entry: any) => entry.idempotencyKey === idempotencyKey)) {
                return res.status(200).json({ success: true, challan, duplicatePrevented: true });
            }

            // Reject amount exceeding remaining balance unless overpayment is explicitly allowed (A8)
            const currentDiscount = numDiscount > 0 ? numDiscount : Number(challan.discount || 0);
            const remainingBalance = Math.max(0, Number(challan.total_amount) - currentDiscount - Number(challan.paid_amount || 0));
            if (numAmount > remainingBalance && allowOverpayment !== true) {
                return res.status(400).json({
                    error: `Payment amount (Rs. ${numAmount.toLocaleString()}) exceeds the remaining balance (Rs. ${remainingBalance.toLocaleString()}). Overpayment confirmation required.`,
                    requiresOverpaymentConfirmation: true,
                    remainingBalance
                });
            }

            const todayStr = new Date().toISOString().split('T')[0];
            const validatedPaidDate = (paidDate && paidDate > todayStr) ? todayStr : (paidDate || todayStr);

            const newRecord = {
                amount: numAmount,
                date: validatedPaidDate,
                recordedBy: session.name || session.email,
                recordedAt: new Date().toISOString(),
                idempotencyKey: idempotencyKey || null
            };

            // Atomic database update with SQL jsonb concatenation (A8 & B1)
            const updateResult = await sql`
                UPDATE fee_challans
                SET 
                    paid_amount = paid_amount + ${numAmount},
                    discount = ${currentDiscount},
                    paid_date = ${validatedPaidDate},
                    status = CASE 
                        WHEN (paid_amount + ${numAmount}) >= (total_amount - ${currentDiscount}) THEN 'Paid' 
                        ELSE 'Partial' 
                    END,
                    payment_history = COALESCE(payment_history, '[]'::jsonb) || ${JSON.stringify([newRecord])}::jsonb
                WHERE id = ${challanId}
                RETURNING *
            `;

            // Server-side audit log
            await writeServerAuditLog(
                sql,
                session,
                'Record Payment',
                `Recorded payment of Rs. ${numAmount.toLocaleString()} (Discount: Rs. ${currentDiscount.toLocaleString()}) on Challan #${challan.challan_number} for ${challan.student_name} (Roll #${challan.roll_number})`,
                challan.school_id
            );

            return res.status(200).json({ success: true, challan: updateResult[0] });

        } else if (action === 'update-payment') {
            const { challanId, discount = 0, paidDate, paymentHistory } = body;
            const numDiscount = Number(discount) || 0;

            if (!challanId) {
                return res.status(400).json({ error: 'Challan ID is required.' });
            }

            if (numDiscount < 0) {
                return res.status(400).json({ error: 'Discount cannot be negative.' });
            }

            const challanRows = await sql`
                SELECT fc.*, s.school_id, s.name as student_name, s.roll_number
                FROM fee_challans fc
                JOIN students s ON s.id = fc.student_id
                WHERE fc.id = ${challanId}
                LIMIT 1
            `;

            if (challanRows.length === 0) {
                return res.status(404).json({ error: 'Challan not found.' });
            }

            const challan = challanRows[0];

            if (session.role !== 'Owner' && session.schoolId && challan.school_id !== session.schoolId) {
                return res.status(403).json({ error: 'Unauthorized: This challan belongs to another school.' });
            }

            // Reject payment edit on Cancelled challans (A9)
            if (challan.status === 'Cancelled') {
                return res.status(400).json({ error: 'Cannot update payments on a cancelled challan.' });
            }

            // Recompute paid_amount strictly from the paymentHistory array, rejecting negative amounts (A9)
            const historyToSave = Array.isArray(paymentHistory) ? paymentHistory : [];
            let recomputedPaidAmount = 0;
            for (const item of historyToSave) {
                const itemAmt = Number(item?.amount) || 0;
                if (itemAmt < 0) {
                    return res.status(400).json({ error: 'Payment history contains an invalid negative amount.' });
                }
                recomputedPaidAmount += itemAmt;
            }

            const todayStr = new Date().toISOString().split('T')[0];
            const validatedPaidDate = (paidDate && paidDate > todayStr) ? todayStr : (paidDate || todayStr);

            // Compute status strictly on the server (A9)
            const netPayable = Math.max(0, Number(challan.total_amount) - numDiscount);
            const status = recomputedPaidAmount >= netPayable 
                ? 'Paid' 
                : (recomputedPaidAmount > 0 ? 'Partial' : 'Unpaid');

            const oldPaidAmount = Number(challan.paid_amount) || 0;
            let oldHistory = challan.payment_history || [];
            if (typeof oldHistory === 'string') {
                try { oldHistory = JSON.parse(oldHistory); } catch { oldHistory = []; }
            }
            const oldHistoryCount = Array.isArray(oldHistory) ? oldHistory.length : 0;
            const newHistoryCount = historyToSave.length;

            const updateResult = await sql`
                UPDATE fee_challans
                SET 
                    paid_amount = ${recomputedPaidAmount},
                    discount = ${numDiscount},
                    paid_date = ${validatedPaidDate},
                    status = ${status},
                    payment_history = ${JSON.stringify(historyToSave)}::jsonb
                WHERE id = ${challanId}
                RETURNING *
            `;

            // Comprehensive audit log with old/new amounts and history counts (A9)
            await writeServerAuditLog(
                sql,
                session,
                'Edit Payment',
                `Updated payment on Challan #${challan.challan_number} for ${challan.student_name}: Old paid Rs. ${oldPaidAmount.toLocaleString()} (${oldHistoryCount} entries) -> New paid Rs. ${recomputedPaidAmount.toLocaleString()} (${newHistoryCount} entries)`,
                challan.school_id
            );

            return res.status(200).json({ success: true, challan: updateResult[0] });

        } else if (action === 'cancel-challan') {
            const { challanId } = body;
            if (!challanId) {
                return res.status(400).json({ error: 'Challan ID is required.' });
            }

            const challanRows = await sql`
                SELECT fc.*, s.school_id, s.name as student_name
                FROM fee_challans fc
                JOIN students s ON s.id = fc.student_id
                WHERE fc.id = ${challanId}
                LIMIT 1
            `;

            if (challanRows.length === 0) {
                return res.status(404).json({ error: 'Challan not found.' });
            }

            const challan = challanRows[0];
            if (session.role !== 'Owner' && session.schoolId && challan.school_id !== session.schoolId) {
                return res.status(403).json({ error: 'Unauthorized: This challan belongs to another school.' });
            }

            await sql`UPDATE fee_challans SET status = 'Cancelled' WHERE id = ${challanId}`;

            await writeServerAuditLog(
                sql,
                session,
                'Cancel Challan',
                `Cancelled fee challan #${challan.challan_number} for ${challan.student_name}`,
                challan.school_id
            );

            return res.status(200).json({ success: true });

        } else if (action === 'increase-tuition') {
            const { studentIds, amount } = body;
            const incAmount = Number(amount) || 0;

            if (!Array.isArray(studentIds) || studentIds.length === 0 || incAmount === 0) {
                return res.status(400).json({ error: 'studentIds array and non-zero amount are required.' });
            }

            // Get tuition fee head
            const effectiveSchoolId = session.role === 'Owner' && body.schoolId ? body.schoolId : session.schoolId;
            const headRows = await sql`
                SELECT id, default_amount FROM fee_heads 
                WHERE LOWER(name) = 'tuition fee' 
                AND (${effectiveSchoolId}::uuid IS NULL OR school_id = ${effectiveSchoolId}::uuid)
                LIMIT 1
            `;

            if (headRows.length === 0) {
                return res.status(400).json({ error: 'Tuition Fee head not configured.' });
            }

            const tuitionHead = headRows[0];

            for (const sId of studentIds) {
                const sRows = await sql`SELECT id, school_id, fee_structure FROM students WHERE id = ${sId}`;
                if (sRows.length > 0) {
                    const student = sRows[0];
                    if (session.role !== 'Owner' && session.schoolId && student.school_id !== session.schoolId) {
                        continue;
                    }

                    let structure = student.fee_structure || [];
                    if (typeof structure === 'string') {
                        try { structure = JSON.parse(structure); } catch { structure = []; }
                    }
                    if (!Array.isArray(structure)) structure = [];

                    const idx = structure.findIndex((item: any) => item.feeHeadId === tuitionHead.id);
                    if (idx !== -1) {
                        structure[idx].amount = (Number(structure[idx].amount) || 0) + incAmount;
                    } else {
                        structure.push({ feeHeadId: tuitionHead.id, amount: Number(tuitionHead.default_amount) + incAmount });
                    }

                    await sql`UPDATE students SET fee_structure = ${JSON.stringify(structure)} WHERE id = ${sId}`;
                }
            }

            await writeServerAuditLog(
                sql,
                session,
                'Fee Adjustment',
                `Adjusted tuition fee by Rs. ${incAmount.toLocaleString()} for ${studentIds.length} student(s)`,
                effectiveSchoolId
            );

            return res.status(200).json({ success: true, count: studentIds.length });

        } else {
            return res.status(400).json({ error: `Unknown action: ${action}` });
        }

    } catch (err: any) {
        console.error("Payment API error:", err);
        return res.status(500).json({ error: err.message || 'Server error processing payment.' });
    }
}
