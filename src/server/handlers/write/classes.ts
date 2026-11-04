import { verifySession, isAuthorized, writeServerAuditLog, requireSameSchool } from './_helpers';
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
        return res.status(403).json({ error: 'Access denied: Only Admins and Owners can manage school configuration.' });
    }

    try {
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
        const { action } = body;

        // Class operations
        if (action === 'add-class') {
            const { name, section, teacherId, sortOrder, schoolId } = body;
            const effectiveSchoolId = session.role === 'Owner' && schoolId ? schoolId : session.schoolId;
            const id = crypto.randomUUID();

            await sql`
                INSERT INTO classes (id, name, section, teacher_id, school_id, sort_order)
                VALUES (${id}, ${name}, ${section || null}, ${teacherId || null}, ${effectiveSchoolId}, ${sortOrder || 0})
            `;
            await writeServerAuditLog(sql, session, 'Add Class', `Added class: ${name} ${section || ''}`, effectiveSchoolId);
            return res.status(200).json({ success: true, id });

        } else if (action === 'update-class') {
            const { id, name, section, teacherId, sortOrder } = body;
            const records = await sql`SELECT school_id FROM classes WHERE id = ${id} LIMIT 1`;
            if (!records || records.length === 0) return res.status(404).json({ error: 'Class not found.' });
            if (!requireSameSchool(session, records[0].school_id)) return res.status(403).json({ error: 'Access denied.' });
            await sql`
                UPDATE classes 
                SET name = ${name}, section = ${section || null}, teacher_id = ${teacherId || null}, sort_order = ${sortOrder || 0}
                WHERE id = ${id}
            `;
            return res.status(200).json({ success: true });

        } else if (action === 'delete-class') {
            const { id } = body;
            const records = await sql`SELECT school_id FROM classes WHERE id = ${id} LIMIT 1`;
            if (!records || records.length === 0) return res.status(404).json({ error: 'Class not found.' });
            if (!requireSameSchool(session, records[0].school_id)) return res.status(403).json({ error: 'Access denied.' });
            await sql`DELETE FROM classes WHERE id = ${id}`;
            return res.status(200).json({ success: true });

        } else if (action === 'bulk-add-classes') {
            const { classes, schoolId } = body;
            const effectiveSchoolId = session.role === 'Owner' && schoolId ? schoolId : session.schoolId;
            for (const c of classes) {
                const id = crypto.randomUUID();
                await sql`INSERT INTO classes (id, name, school_id) VALUES (${id}, ${c.name}, ${effectiveSchoolId})`;
            }
            return res.status(200).json({ success: true, count: classes.length });

        } else if (action === 'bulk-update-order') {
            const { updates } = body;
            if (!Array.isArray(updates) || updates.length === 0) {
                return res.status(200).json({ success: true, count: 0 });
            }
            const ids = updates.map((u: any) => u.id);
            const isOwnerGlobal = session.role === 'Owner';
            const effectiveSchoolId = session.schoolId;

            const valid = await sql`
                SELECT id FROM classes
                WHERE id = ANY(${ids})
                AND (${isOwnerGlobal}::boolean OR school_id = ${effectiveSchoolId}::uuid)
            `;
            const validIds = new Set(valid.map((c: any) => c.id));
            let updatedCount = 0;
            for (const u of updates) {
                if (validIds.has(u.id)) {
                    await sql`UPDATE classes SET sort_order = ${u.sortOrder} WHERE id = ${u.id}`;
                    updatedCount++;
                }
            }
            return res.status(200).json({ success: true, count: updatedCount });

        // Subject operations
        } else if (action === 'add-subject') {
            const { name, schoolId } = body;
            const effectiveSchoolId = session.role === 'Owner' && schoolId ? schoolId : session.schoolId;
            const id = crypto.randomUUID();
            await sql`INSERT INTO subjects (id, name, school_id) VALUES (${id}, ${name}, ${effectiveSchoolId})`;
            return res.status(200).json({ success: true, id });

        } else if (action === 'update-subject') {
            const { id, name } = body;
            const records = await sql`SELECT school_id FROM subjects WHERE id = ${id} LIMIT 1`;
            if (!records || records.length === 0) return res.status(404).json({ error: 'Subject not found.' });
            if (!requireSameSchool(session, records[0].school_id)) return res.status(403).json({ error: 'Access denied.' });
            await sql`UPDATE subjects SET name = ${name} WHERE id = ${id}`;
            return res.status(200).json({ success: true });

        } else if (action === 'delete-subject') {
            const { id } = body;
            const records = await sql`SELECT school_id FROM subjects WHERE id = ${id} LIMIT 1`;
            if (!records || records.length === 0) return res.status(404).json({ error: 'Subject not found.' });
            if (!requireSameSchool(session, records[0].school_id)) return res.status(403).json({ error: 'Access denied.' });
            await sql`DELETE FROM subjects WHERE id = ${id}`;
            return res.status(200).json({ success: true });

        // Exam operations
        } else if (action === 'add-exam') {
            const { name, schoolId } = body;
            const effectiveSchoolId = session.role === 'Owner' && schoolId ? schoolId : session.schoolId;
            const id = crypto.randomUUID();
            await sql`INSERT INTO exams (id, name, school_id) VALUES (${id}, ${name}, ${effectiveSchoolId})`;
            return res.status(200).json({ success: true, id });

        } else if (action === 'update-exam') {
            const { id, name } = body;
            const records = await sql`SELECT school_id FROM exams WHERE id = ${id} LIMIT 1`;
            if (!records || records.length === 0) return res.status(404).json({ error: 'Exam not found.' });
            if (!requireSameSchool(session, records[0].school_id)) return res.status(403).json({ error: 'Access denied.' });
            await sql`UPDATE exams SET name = ${name} WHERE id = ${id}`;
            return res.status(200).json({ success: true });

        } else if (action === 'delete-exam') {
            const { id } = body;
            const records = await sql`SELECT school_id FROM exams WHERE id = ${id} LIMIT 1`;
            if (!records || records.length === 0) return res.status(404).json({ error: 'Exam not found.' });
            if (!requireSameSchool(session, records[0].school_id)) return res.status(403).json({ error: 'Access denied.' });
            await sql`DELETE FROM exams WHERE id = ${id}`;
            return res.status(200).json({ success: true });

        // Fee Head operations
        } else if (action === 'add-fee-head') {
            const { name, defaultAmount, schoolId } = body;
            const effectiveSchoolId = session.role === 'Owner' && schoolId ? schoolId : session.schoolId;
            const id = crypto.randomUUID();
            await sql`
                INSERT INTO fee_heads (id, name, default_amount, school_id)
                VALUES (${id}, ${name}, ${Number(defaultAmount) || 0}, ${effectiveSchoolId})
            `;
            await writeServerAuditLog(sql, session, 'Add Fee Head', `Added fee head: ${name} (Rs. ${defaultAmount})`, effectiveSchoolId);
            return res.status(200).json({ success: true, id });

        } else if (action === 'update-fee-head') {
            const { id, name, defaultAmount } = body;
            const records = await sql`SELECT school_id FROM fee_heads WHERE id = ${id} LIMIT 1`;
            if (!records || records.length === 0) return res.status(404).json({ error: 'Fee head not found.' });
            if (!requireSameSchool(session, records[0].school_id)) return res.status(403).json({ error: 'Access denied.' });
            await sql`
                UPDATE fee_heads 
                SET name = ${name}, default_amount = ${Number(defaultAmount) || 0}
                WHERE id = ${id}
            `;
            return res.status(200).json({ success: true });

        } else if (action === 'delete-fee-head') {
            const { id } = body;
            const records = await sql`SELECT school_id FROM fee_heads WHERE id = ${id} LIMIT 1`;
            if (!records || records.length === 0) return res.status(404).json({ error: 'Fee head not found.' });
            if (!requireSameSchool(session, records[0].school_id)) return res.status(403).json({ error: 'Access denied.' });
            await sql`DELETE FROM fee_heads WHERE id = ${id}`;
            return res.status(200).json({ success: true });

        // School Events / Calendar
        } else if (action === 'add-event') {
            const { title, date, category, description, schoolId } = body;
            const effectiveSchoolId = session.role === 'Owner' && schoolId ? schoolId : session.schoolId;
            const id = crypto.randomUUID();
            await sql`
                INSERT INTO school_events (id, title, date, category, description, school_id)
                VALUES (${id}, ${title}, ${date}, ${category || 'general'}, ${description || ''}, ${effectiveSchoolId})
            `;
            return res.status(200).json({ success: true, id });

        } else if (action === 'update-event') {
            const { id, title, date, category, description } = body;
            const records = await sql`SELECT school_id FROM school_events WHERE id = ${id} LIMIT 1`;
            if (!records || records.length === 0) return res.status(404).json({ error: 'Event not found.' });
            if (!requireSameSchool(session, records[0].school_id)) return res.status(403).json({ error: 'Access denied.' });
            await sql`
                UPDATE school_events 
                SET title = ${title}, date = ${date}, category = ${category || 'general'}, description = ${description || ''}
                WHERE id = ${id}
            `;
            return res.status(200).json({ success: true });

        } else if (action === 'delete-event') {
            const { id } = body;
            const records = await sql`SELECT school_id FROM school_events WHERE id = ${id} LIMIT 1`;
            if (!records || records.length === 0) return res.status(404).json({ error: 'Event not found.' });
            if (!requireSameSchool(session, records[0].school_id)) return res.status(403).json({ error: 'Access denied.' });
            await sql`DELETE FROM school_events WHERE id = ${id}`;
            return res.status(200).json({ success: true });

        } else {
            return res.status(400).json({ error: `Unknown action: ${action}` });
        }

    } catch (err: any) {
        console.error("Classes/Config API error:", err);
        return res.status(500).json({ error: err.message || 'Server error updating school configuration.' });
    }
}
