import { getDb, getSessionUser, toCamelCase } from '../../_db';

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
        const { role, userId, schoolId } = session;
        const requestedSchoolId = req.query?.schoolId;

        // Teachers do not view or manage fee challans
        if (role === 'Teacher') {
            return res.status(200).json({ fees: [] });
        }

        let targetStudentIds: string[] = [];

        const isLocked = Boolean(role !== 'Owner' && session.branchId);

        if (role === 'Owner') {
            const effectiveSchoolId = requestedSchoolId || null;
            const students = effectiveSchoolId
                ? await sql`SELECT id FROM students WHERE school_id = ${effectiveSchoolId}`
                : await sql`SELECT id FROM students`;
            targetStudentIds = students.map((s: any) => s.id);
        } else if (role === 'Admin' || role === 'Accountant') {
            const students = isLocked
                ? await sql`SELECT id FROM students WHERE school_id = ${schoolId} AND class_id IN (SELECT id FROM classes WHERE branch_id = ${session.branchId})`
                : await sql`SELECT id FROM students WHERE school_id = ${schoolId}`;
            targetStudentIds = students.map((s: any) => s.id);
        } else if (role === 'Parent') {
            const parentProfile = await sql`SELECT child_student_ids FROM profiles WHERE id = ${userId} LIMIT 1`;
            let childIds: string[] = [];
            if (parentProfile.length > 0) {
                const p = parentProfile[0];
                if (Array.isArray(p.child_student_ids)) childIds = p.child_student_ids;
                else if (typeof p.child_student_ids === 'string') {
                    try { childIds = JSON.parse(p.child_student_ids); } catch { childIds = []; }
                }
            }
            targetStudentIds = childIds;
        } else if (role === 'Student') {
            const studentProfile = await sql`SELECT id FROM students WHERE user_id = ${userId} LIMIT 1`;
            if (studentProfile.length > 0) {
                targetStudentIds = [studentProfile[0].id];
            }
        }

        let fees: any[] = [];
        if (targetStudentIds.length > 0) {
            fees = await sql`
                SELECT id, challan_number, student_id, class_id, month, year, due_date, fee_items, 
                       previous_balance, total_amount, discount, paid_amount, status, 
                       paid_date, fine_amount, payment_history, created_at
                FROM fee_challans 
                WHERE student_id = ANY(${targetStudentIds})
                ORDER BY year DESC, month DESC
            `;
        }

        const transformed = toCamelCase(fees).map((f: any) => {
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

        return res.status(200).json({ fees: transformed });
    } catch (err: any) {
        console.error("Fees read API error:", err);
        return res.status(500).json({ error: 'Failed to read fee records from database.' });
    }
}
