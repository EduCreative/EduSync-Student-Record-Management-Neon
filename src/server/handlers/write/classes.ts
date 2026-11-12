import { verifySession, isAuthorized, writeServerAuditLog, requireSameSchool, isBranchLocked, canAccessClass } from './_helpers';
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
        const locked = isBranchLocked(session);

        // Class operations
        if (action === 'add-class') {
            const { name, section, teacherId, branchId, sortOrder, schoolId } = body;
            const effectiveSchoolId = session.role === 'Owner' && schoolId ? schoolId : session.schoolId;
            const id = crypto.randomUUID();
            const finalBranchId = locked ? session.branchId : (branchId || null);

            await sql`
                INSERT INTO classes (id, name, section, teacher_id, school_id, branch_id, sort_order)
                VALUES (${id}, ${name}, ${section || null}, ${teacherId || null}, ${effectiveSchoolId}, ${finalBranchId}, ${sortOrder || 0})
            `;
            await writeServerAuditLog(sql, session, 'Add Class', `Added class: ${name} ${section || ''}`, effectiveSchoolId);
            return res.status(200).json({ success: true, id });

        } else if (action === 'update-class') {
            const { id, name, section, teacherId, branchId, sortOrder } = body;
            const records = await sql`SELECT school_id, branch_id FROM classes WHERE id = ${id} LIMIT 1`;
            if (!records || records.length === 0) return res.status(404).json({ error: 'Class not found.' });
            if (!requireSameSchool(session, records[0].school_id)) return res.status(403).json({ error: 'Access denied.' });
            if (locked) {
                if (!(await canAccessClass(sql, session, id))) {
                    return res.status(403).json({ error: 'Outside your branch' });
                }
            }
            const finalBranchId = locked ? records[0].branch_id : (branchId || null);
            await sql`
                UPDATE classes 
                SET name = ${name}, section = ${section || null}, teacher_id = ${teacherId || null}, branch_id = ${finalBranchId}, sort_order = ${sortOrder || 0}
                WHERE id = ${id}
            `;
            return res.status(200).json({ success: true });

        } else if (action === 'delete-class') {
            const { id } = body;
            const records = await sql`SELECT school_id FROM classes WHERE id = ${id} LIMIT 1`;
            if (!records || records.length === 0) return res.status(404).json({ error: 'Class not found.' });
            if (!requireSameSchool(session, records[0].school_id)) return res.status(403).json({ error: 'Access denied.' });
            if (locked) {
                if (!(await canAccessClass(sql, session, id))) {
                    return res.status(403).json({ error: 'Outside your branch' });
                }
            }
            await sql`DELETE FROM classes WHERE id = ${id}`;
            return res.status(200).json({ success: true });

        // Branch operations
        } else if (action === 'add-branch') {
            if (locked) return res.status(403).json({ error: 'Outside your branch' });
            const { name, address, schoolId } = body;
            if (!name || !name.trim()) {
                return res.status(400).json({ error: 'Branch name is required.' });
            }
            const effectiveSchoolId = session.role === 'Owner' && schoolId ? schoolId : session.schoolId;
            const id = crypto.randomUUID();
            try {
                await sql`
                    INSERT INTO branches (id, name, address, school_id)
                    VALUES (${id}, ${name.trim()}, ${address || null}, ${effectiveSchoolId})
                `;
            } catch (err: any) {
                if (err?.code === '23505' || err?.message?.includes('23505')) {
                    return res.status(409).json({ error: `A branch named "${name}" already exists.` });
                }
                throw err;
            }
            await writeServerAuditLog(sql, session, 'Add Branch', `Added branch: ${name}`, effectiveSchoolId);
            return res.status(200).json({ success: true, id });

        } else if (action === 'update-branch') {
            if (locked) return res.status(403).json({ error: 'Outside your branch' });
            const { id, name, address } = body;
            if (!id || !name || !name.trim()) {
                return res.status(400).json({ error: 'Branch ID and name are required.' });
            }
            const records = await sql`SELECT school_id FROM branches WHERE id = ${id} LIMIT 1`;
            if (!records || records.length === 0) return res.status(404).json({ error: 'Branch not found.' });
            if (!requireSameSchool(session, records[0].school_id)) return res.status(403).json({ error: 'Access denied.' });
            try {
                await sql`
                    UPDATE branches
                    SET name = ${name.trim()}, address = ${address || null}
                    WHERE id = ${id}
                `;
            } catch (err: any) {
                if (err?.code === '23505' || err?.message?.includes('23505')) {
                    return res.status(409).json({ error: `A branch named "${name}" already exists.` });
                }
                throw err;
            }
            return res.status(200).json({ success: true });

        } else if (action === 'delete-branch') {
            if (locked) return res.status(403).json({ error: 'Outside your branch' });
            const { id } = body;
            if (!id) return res.status(400).json({ error: 'Branch ID is required.' });
            const records = await sql`SELECT school_id FROM branches WHERE id = ${id} LIMIT 1`;
            if (!records || records.length === 0) return res.status(404).json({ error: 'Branch not found.' });
            if (!requireSameSchool(session, records[0].school_id)) return res.status(403).json({ error: 'Access denied.' });

            const classCount = await sql`SELECT COUNT(*)::int as count FROM classes WHERE branch_id = ${id}`;
            if (classCount[0]?.count > 0) {
                return res.status(409).json({ error: `Cannot delete branch: ${classCount[0].count} class(es) are currently assigned to this branch.` });
            }

            await sql`DELETE FROM branches WHERE id = ${id}`;
            await writeServerAuditLog(sql, session, 'Delete Branch', `Deleted branch ID ${id}`, records[0].school_id);
            return res.status(200).json({ success: true });

        } else if (action === 'bulk-add-classes') {
            const { classes, schoolId } = body;
            const effectiveSchoolId = session.role === 'Owner' && schoolId ? schoolId : session.schoolId;
            const finalBranchId = locked ? session.branchId : null;
            for (const c of classes) {
                const id = crypto.randomUUID();
                await sql`INSERT INTO classes (id, name, school_id, branch_id) VALUES (${id}, ${c.name}, ${effectiveSchoolId}, ${finalBranchId})`;
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
            const lockedBranch = locked ? session.branchId : null;

            const valid = await sql`
                SELECT id FROM classes
                WHERE id = ANY(${ids})
                AND (${isOwnerGlobal}::boolean OR school_id = ${effectiveSchoolId}::uuid)
                AND (${lockedBranch}::uuid IS NULL OR branch_id = ${lockedBranch}::uuid)
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
            if (locked) return res.status(403).json({ error: 'Outside your branch' });
            const { name, schoolId } = body;
            const effectiveSchoolId = session.role === 'Owner' && schoolId ? schoolId : session.schoolId;
            const id = crypto.randomUUID();
            await sql`INSERT INTO subjects (id, name, school_id) VALUES (${id}, ${name}, ${effectiveSchoolId})`;
            return res.status(200).json({ success: true, id });

        } else if (action === 'update-subject') {
            if (locked) return res.status(403).json({ error: 'Outside your branch' });
            const { id, name } = body;
            const records = await sql`SELECT school_id FROM subjects WHERE id = ${id} LIMIT 1`;
            if (!records || records.length === 0) return res.status(404).json({ error: 'Subject not found.' });
            if (!requireSameSchool(session, records[0].school_id)) return res.status(403).json({ error: 'Access denied.' });
            await sql`UPDATE subjects SET name = ${name} WHERE id = ${id}`;
            return res.status(200).json({ success: true });

        } else if (action === 'delete-subject') {
            if (locked) return res.status(403).json({ error: 'Outside your branch' });
            const { id } = body;
            const records = await sql`SELECT school_id FROM subjects WHERE id = ${id} LIMIT 1`;
            if (!records || records.length === 0) return res.status(404).json({ error: 'Subject not found.' });
            if (!requireSameSchool(session, records[0].school_id)) return res.status(403).json({ error: 'Access denied.' });
            await sql`DELETE FROM subjects WHERE id = ${id}`;
            return res.status(200).json({ success: true });

        // Exam operations
        } else if (action === 'add-exam') {
            if (locked) return res.status(403).json({ error: 'Outside your branch' });
            const { name, schoolId } = body;
            const effectiveSchoolId = session.role === 'Owner' && schoolId ? schoolId : session.schoolId;
            const id = crypto.randomUUID();
            await sql`INSERT INTO exams (id, name, school_id) VALUES (${id}, ${name}, ${effectiveSchoolId})`;
            return res.status(200).json({ success: true, id });

        } else if (action === 'update-exam') {
            if (locked) return res.status(403).json({ error: 'Outside your branch' });
            const { id, name } = body;
            const records = await sql`SELECT school_id FROM exams WHERE id = ${id} LIMIT 1`;
            if (!records || records.length === 0) return res.status(404).json({ error: 'Exam not found.' });
            if (!requireSameSchool(session, records[0].school_id)) return res.status(403).json({ error: 'Access denied.' });
            await sql`UPDATE exams SET name = ${name} WHERE id = ${id}`;
            return res.status(200).json({ success: true });

        } else if (action === 'delete-exam') {
            if (locked) return res.status(403).json({ error: 'Outside your branch' });
            const { id } = body;
            const records = await sql`SELECT school_id FROM exams WHERE id = ${id} LIMIT 1`;
            if (!records || records.length === 0) return res.status(404).json({ error: 'Exam not found.' });
            if (!requireSameSchool(session, records[0].school_id)) return res.status(403).json({ error: 'Access denied.' });
            await sql`DELETE FROM exams WHERE id = ${id}`;
            return res.status(200).json({ success: true });

        // Fee Head operations
        } else if (action === 'add-fee-head') {
            if (locked) return res.status(403).json({ error: 'Outside your branch' });
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
            if (locked) return res.status(403).json({ error: 'Outside your branch' });
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
            if (locked) return res.status(403).json({ error: 'Outside your branch' });
            const { id } = body;
            const records = await sql`SELECT school_id FROM fee_heads WHERE id = ${id} LIMIT 1`;
            if (!records || records.length === 0) return res.status(404).json({ error: 'Fee head not found.' });
            if (!requireSameSchool(session, records[0].school_id)) return res.status(403).json({ error: 'Access denied.' });
            await sql`DELETE FROM fee_heads WHERE id = ${id}`;
            return res.status(200).json({ success: true });

        // School Events / Calendar
        } else if (action === 'add-event') {
            if (locked) return res.status(403).json({ error: 'Outside your branch' });
            const { title, date, category, description, schoolId } = body;
            const effectiveSchoolId = session.role === 'Owner' && schoolId ? schoolId : session.schoolId;
            const id = crypto.randomUUID();
            await sql`
                INSERT INTO school_events (id, title, date, category, description, school_id)
                VALUES (${id}, ${title}, ${date}, ${category || 'general'}, ${description || ''}, ${effectiveSchoolId})
            `;
            return res.status(200).json({ success: true, id });

        } else if (action === 'update-event') {
            if (locked) return res.status(403).json({ error: 'Outside your branch' });
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
            if (locked) return res.status(403).json({ error: 'Outside your branch' });
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
