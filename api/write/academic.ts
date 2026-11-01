import { verifySession, isAuthorized, writeServerAuditLog } from './_helpers';
import crypto from 'crypto';

export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }

    const auth = verifySession(req, res);
    if (!auth) return;
    const { session, sql } = auth;

    if (!isAuthorized(session, ['Owner', 'Admin', 'Teacher'])) {
        return res.status(403).json({ error: 'Access denied: You do not have permission to manage academic records.' });
    }

    try {
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
        const { action } = body;

        if (action === 'set-attendance') {
            const { date, records, schoolId } = body;

            if (!date || !Array.isArray(records) || records.length === 0) {
                return res.status(400).json({ error: 'Date and records array are required.' });
            }

            const effectiveSchoolId = session.role === 'Owner' && schoolId ? schoolId : session.schoolId;

            // Batch upsert attendance
            const BATCH_SIZE = 50;
            for (let i = 0; i < records.length; i += BATCH_SIZE) {
                const batch = records.slice(i, i + BATCH_SIZE);
                await Promise.all(batch.map((r: any) => {
                    const recId = crypto.randomUUID();
                    return sql`
                        INSERT INTO attendance (id, student_id, date, status, school_id)
                        VALUES (${recId}, ${r.studentId}, ${date}, ${r.status}, ${effectiveSchoolId || null})
                        ON CONFLICT (student_id, date) DO UPDATE 
                        SET status = EXCLUDED.status
                    `;
                }));
            }

            await writeServerAuditLog(
                sql,
                session,
                'Attendance Recorded',
                `Recorded daily attendance for ${records.length} student(s) on ${date}`,
                effectiveSchoolId
            );

            return res.status(200).json({ success: true, count: records.length });

        } else if (action === 'save-results') {
            const { results, schoolId } = body;

            if (!Array.isArray(results) || results.length === 0) {
                return res.status(400).json({ error: 'Results array is required.' });
            }

            const effectiveSchoolId = session.role === 'Owner' && schoolId ? schoolId : session.schoolId;

            const BATCH_SIZE = 50;
            for (let i = 0; i < results.length; i += BATCH_SIZE) {
                const batch = results.slice(i, i + BATCH_SIZE);
                await Promise.all(batch.map((r: any) => {
                    const recId = crypto.randomUUID();
                    const marksVal = Number(r.marks) || 0;
                    const totalMarksVal = Number(r.totalMarks ?? r.total_marks ?? 100) || 100;

                    return sql`
                        INSERT INTO results (id, student_id, class_id, exam, subject, marks, total_marks, school_id)
                        VALUES (${recId}, ${r.studentId}, ${r.classId}, ${r.exam}, ${r.subject}, ${marksVal}, ${totalMarksVal}, ${effectiveSchoolId || null})
                        ON CONFLICT (student_id, class_id, exam, subject) DO UPDATE 
                        SET marks = EXCLUDED.marks, total_marks = EXCLUDED.total_marks
                    `;
                }));
            }

            await writeServerAuditLog(
                sql,
                session,
                'Save Results',
                `Saved exam results for ${results.length} record(s)`,
                effectiveSchoolId
            );

            return res.status(200).json({ success: true, count: results.length });

        } else {
            return res.status(400).json({ error: `Unknown action: ${action}` });
        }

    } catch (err: any) {
        console.error("Academic API error:", err);
        return res.status(500).json({ error: err.message || 'Server error saving academic data.' });
    }
}
