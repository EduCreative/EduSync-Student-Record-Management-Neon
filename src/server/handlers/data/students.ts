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

        const effectiveSchoolId = role === 'Owner' 
            ? (requestedSchoolId || null) 
            : schoolId;

        let students: any[] = [];

        if (role === 'Owner' || role === 'Admin' || role === 'Accountant' || role === 'Teacher') {
            students = effectiveSchoolId
                ? await sql`SELECT * FROM students WHERE school_id = ${effectiveSchoolId} ORDER BY roll_number ASC, name ASC`
                : await sql`SELECT * FROM students ORDER BY roll_number ASC, name ASC`;

            // Mask/omit sensitive father_cnic for teachers
            if (role === 'Teacher') {
                students = students.map((s: any) => {
                    const { father_cnic: _fc, ...safeStudent } = s;
                    return safeStudent;
                });
            }
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
            students = childIds.length > 0 
                ? await sql`SELECT * FROM students WHERE id = ANY(${childIds}) ORDER BY name ASC`
                : [];
        } else if (role === 'Student') {
            students = await sql`SELECT * FROM students WHERE user_id = ${userId} LIMIT 1`;
        }

        const transformed = toCamelCase(students).map((s: any) => ({
            ...s,
            openingBalance: Number(s.openingBalance || 0),
            feeStructure: (s.feeStructure || []).map((item: any) => ({
                ...item,
                amount: Number(item.amount || 0)
            }))
        }));

        return res.status(200).json({ students: transformed });
    } catch (err: any) {
        console.error("Students read API error:", err);
        return res.status(500).json({ error: 'Failed to read students from database.' });
    }
}
