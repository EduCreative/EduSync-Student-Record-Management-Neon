import { verifySession, isAuthorized, writeServerAuditLog, requireSameSchool, validateAvatarDataUrl, isBranchLocked, canAccessStudent } from './_helpers';
import { isStudentsUserFkError, repairStudentsUserFkIfLegacy } from './_studentSchema';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(value: unknown): value is string {
    return typeof value === 'string' && UUID_REGEX.test(value.trim());
}

function normalizeUuidArray(values: unknown): { valid: boolean; ids: string[] } {
    if (!Array.isArray(values)) return { valid: true, ids: [] };
    const seen = new Set<string>();
    for (const raw of values) {
        if (typeof raw !== 'string' || !UUID_REGEX.test(raw.trim())) {
            return { valid: false, ids: [] };
        }
        seen.add(raw.trim());
    }
    return { valid: true, ids: Array.from(seen) };
}

async function validateChildStudents(
    sql: any,
    session: any,
    studentIds: string[],
    targetSchoolId: string | null | undefined
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
    if (studentIds.length === 0) return { ok: true };

    const rows = await sql`
        SELECT id, name, school_id, status 
        FROM students 
        WHERE id = ANY(${studentIds}::uuid[]) AND status <> 'Deleted'
    `;
    if (!rows || rows.length !== studentIds.length) {
        return { ok: false, status: 400, error: 'One or more selected student records were not found.' };
    }

    for (const s of rows) {
        if (targetSchoolId && s.school_id && s.school_id !== targetSchoolId) {
            return { ok: false, status: 403, error: `Student "${s.name}" belongs to another school.` };
        }
        const allowed = await canAccessStudent(sql, session, s.id);
        if (!allowed) {
            return { ok: false, status: 403, error: 'Outside your branch' };
        }
    }

    return { ok: true };
}

async function validateSingleStudentForUser(
    sql: any,
    session: any,
    studentId: string,
    targetSchoolId: string | null | undefined,
    currentUserId?: string
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
    if (!isValidUuid(studentId)) {
        return { ok: false, status: 400, error: 'Invalid student record ID format.' };
    }

    const rows = await sql`
        SELECT s.id, s.name, s.roll_number, s.school_id, s.user_id, p.role AS linked_role, p.email AS linked_email
        FROM students s
        LEFT JOIN profiles p ON p.id = s.user_id
        WHERE s.id = ${studentId} AND s.status <> 'Deleted'
        LIMIT 1
    `;
    if (!rows || rows.length === 0) {
        return { ok: false, status: 400, error: 'Selected student record was not found.' };
    }

    const s = rows[0];
    if (targetSchoolId && s.school_id && s.school_id !== targetSchoolId) {
        return { ok: false, status: 403, error: 'Cannot link a student record from another school.' };
    }

    const allowed = await canAccessStudent(sql, session, s.id);
    if (!allowed) {
        return { ok: false, status: 403, error: 'Outside your branch' };
    }

    if (s.user_id && s.user_id !== currentUserId && s.linked_role === 'Student') {
        return {
            ok: false,
            status: 409,
            error: `Student "${s.name}" (Roll #${s.roll_number}) is already linked to another Student account (${s.linked_email}).`
        };
    }

    return { ok: true };
}

export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }

    const auth = await verifySession(req, res);
    if (!auth) return;
    const { session, sql } = auth;

    try {
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
        const { action } = body;
        const locked = isBranchLocked(session);

        // User Management (Owner, Admin)
        if (action === 'add-user') {
            if (!isAuthorized(session, ['Owner', 'Admin'])) {
                return res.status(403).json({ error: 'Access denied: Cannot create user accounts.' });
            }

            const { name, email, password, role, schoolId, avatarUrl, branchId } = body;
            if (!name || !email || !password || !role) {
                return res.status(400).json({ error: 'Name, email, password, and role are required.' });
            }

            if (password.length < 8) {
                return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
            }

            if (avatarUrl) {
                const avatarCheck = validateAvatarDataUrl(avatarUrl);
                if (!avatarCheck.valid) {
                    return res.status(400).json({ error: avatarCheck.error });
                }
            }

            if (session.role === 'Admin') {
                if (!['Accountant', 'Teacher', 'Parent', 'Student'].includes(role)) {
                    return res.status(403).json({ error: 'Admin may create only Accountant, Teacher, Parent, or Student accounts.' });
                }
            } else if (session.role === 'Owner') {
                if (!['Owner', 'Admin', 'Accountant', 'Teacher', 'Parent', 'Student'].includes(role)) {
                    return res.status(400).json({ error: 'Invalid role specified.' });
                }
            }

            const effectiveSchoolId = session.role === 'Admin' ? session.schoolId : (session.role === 'Owner' && schoolId ? schoolId : session.schoolId);

            let finalBranchId: string | null = null;
            if (role === 'Owner') {
                finalBranchId = null;
            } else if (locked) {
                finalBranchId = session.branchId;
            } else if (branchId) {
                const bCheck = await sql`SELECT id FROM branches WHERE id = ${branchId} AND school_id = ${effectiveSchoolId} LIMIT 1`;
                if (!bCheck || bCheck.length === 0) {
                    return res.status(400).json({ error: 'Invalid branch specified.' });
                }
                finalBranchId = branchId;
            }

            // Validate linking payloads
            let childStudentIdsToInsert: string[] = [];
            if (role === 'Parent' && Array.isArray(body.childStudentIds)) {
                const parsed = normalizeUuidArray(body.childStudentIds);
                if (!parsed.valid) {
                    return res.status(400).json({ error: 'Invalid student ID in childStudentIds.' });
                }
                const check = await validateChildStudents(sql, session, parsed.ids, effectiveSchoolId);
                if (!check.ok) {
                    return res.status(check.status).json({ error: check.error });
                }
                childStudentIdsToInsert = parsed.ids;
            }

            const linkedStudentId = role === 'Student' && body.linkedStudentId
                ? String(body.linkedStudentId).trim()
                : null;
            if (linkedStudentId) {
                const check = await validateSingleStudentForUser(sql, session, linkedStudentId, effectiveSchoolId);
                if (!check.ok) {
                    return res.status(check.status).json({ error: check.error });
                }
            }

            // Security fix: Hash password with bcrypt before inserting
            const saltRounds = 10;
            const hashedPassword = await bcrypt.hash(password, saltRounds);
            const id = crypto.randomUUID();
            const avatarUrlToInsert = (avatarUrl && typeof avatarUrl === 'string' && avatarUrl.startsWith('data:'))
                ? avatarUrl
                : null;

            const userStatus = body.status || 'Active';
            const userDisabledLinks = Array.isArray(body.disabledNavLinks) ? body.disabledNavLinks : [];
            const userPermissions = body.permissionsOverrides && typeof body.permissionsOverrides === 'object' 
                ? JSON.stringify(body.permissionsOverrides) 
                : '{}';

            const executeAddUser = async () => {
                const insertProfileQuery = sql`
                    INSERT INTO profiles (id, name, email, password, role, school_id, status, avatar_url, branch_id, child_student_ids, disabled_nav_links, permissions_overrides)
                    VALUES (${id}, ${name}, ${email.toLowerCase().trim()}, ${hashedPassword}, ${role}, ${effectiveSchoolId}, ${userStatus}, ${avatarUrlToInsert}, ${finalBranchId}, ${childStudentIdsToInsert}::uuid[], ${userDisabledLinks}, ${userPermissions}::jsonb)
                `;

                if (linkedStudentId) {
                    const linkStudentQuery = sql`
                        UPDATE students
                        SET user_id = ${id}
                        WHERE id = ${linkedStudentId}
                    `;
                    await sql.transaction([insertProfileQuery, linkStudentQuery]);
                } else {
                    await insertProfileQuery;
                }
            };

            try {
                await executeAddUser();
            } catch (err: any) {
                if (linkedStudentId && isStudentsUserFkError(err) && (await repairStudentsUserFkIfLegacy(sql))) {
                    try {
                        await executeAddUser();
                    } catch (retryErr: any) {
                        if (retryErr?.code === '23505' || retryErr?.message?.includes('23505') || retryErr?.message?.includes('profiles_email_key')) {
                            return res.status(409).json({ error: 'Email already exists', message: `A user with email "${email}" already exists.` });
                        }
                        throw retryErr;
                    }
                } else if (err?.code === '23505' || err?.message?.includes('23505') || err?.message?.includes('profiles_email_key')) {
                    return res.status(409).json({ error: 'Email already exists', message: `A user with email "${email}" already exists.` });
                } else {
                    throw err;
                }
            }

            await writeServerAuditLog(
                sql,
                session,
                'Add User',
                `Created ${role} account for ${name} (${email})`,
                effectiveSchoolId
            );

            return res.status(200).json({ success: true, id });

        } else if (action === 'update-user') {
            if (!isAuthorized(session, ['Owner', 'Admin'])) {
                return res.status(403).json({ error: 'Access denied: Cannot update user accounts.' });
            }

            const { id, name, avatarUrl, status, branchId, role, schoolId, disabledNavLinks, permissionsOverrides } = body;
            if (!id) {
                return res.status(400).json({ error: 'User ID is required.' });
            }

            const targetUsers = await sql`SELECT id, name, role, school_id, branch_id, status, child_student_ids, disabled_nav_links, permissions_overrides FROM profiles WHERE id = ${id} LIMIT 1`;
            if (!targetUsers || targetUsers.length === 0) {
                return res.status(404).json({ error: 'User not found.' });
            }
            const targetUser = targetUsers[0];

            if (targetUser.role === 'Owner' && session.role !== 'Owner') {
                return res.status(403).json({ error: 'Access denied: Admin cannot touch an Owner account.' });
            }

            // If targetUser already has a school_id, enforce tenant boundary
            if (targetUser.school_id && !requireSameSchool(session, targetUser.school_id)) {
                return res.status(403).json({ error: 'Access denied: Cannot update user from another school.' });
            }

            if (locked) {
                if (targetUser.branch_id !== session.branchId) {
                    return res.status(403).json({ error: 'Outside your branch' });
                }
            }

            if (avatarUrl) {
                const avatarCheck = validateAvatarDataUrl(avatarUrl);
                if (!avatarCheck.valid) {
                    return res.status(400).json({ error: avatarCheck.error });
                }
            }

            const targetSchoolId = targetUser.school_id || schoolId || session.schoolId;

            // Determine updated role
            let newRole = targetUser.role;
            if (role && role !== targetUser.role) {
                if (session.role === 'Owner') {
                    if (['Owner', 'Admin', 'Accountant', 'Teacher', 'Parent', 'Student'].includes(role)) {
                        newRole = role;
                    }
                } else if (session.role === 'Admin') {
                    if (targetUser.role !== 'Owner' && ['Accountant', 'Teacher', 'Parent', 'Student'].includes(role)) {
                        newRole = role;
                    }
                }
            }

            // Determine updated branchId
            let newBranchId = targetUser.branch_id;
            if (newRole === 'Owner') {
                newBranchId = null;
            } else if (!locked) {
                if (branchId !== undefined) {
                    if (branchId === null || branchId === '' || branchId === 'all') {
                        newBranchId = null;
                    } else {
                        const bCheck = targetSchoolId
                            ? await sql`SELECT id FROM branches WHERE id = ${branchId} AND (school_id = ${targetSchoolId} OR school_id IS NULL) LIMIT 1`
                            : await sql`SELECT id FROM branches WHERE id = ${branchId} LIMIT 1`;
                        if (!bCheck || bCheck.length === 0) {
                            return res.status(400).json({ error: 'Invalid branch specified.' });
                        }
                        newBranchId = branchId;
                    }
                }
            }

            // Validate & prepare Parent -> child_student_ids link
            let safeChildStudentIds: string[] = Array.isArray(targetUser.child_student_ids) ? targetUser.child_student_ids : [];
            if (newRole !== 'Parent') {
                safeChildStudentIds = [];
            } else if (Array.isArray(body.childStudentIds)) {
                const parsed = normalizeUuidArray(body.childStudentIds);
                if (!parsed.valid) {
                    return res.status(400).json({ error: 'Invalid student ID in childStudentIds.' });
                }
                const check = await validateChildStudents(sql, session, parsed.ids, targetSchoolId);
                if (!check.ok) {
                    return res.status(check.status).json({ error: check.error });
                }
                safeChildStudentIds = parsed.ids;
            }

            // Validate & prepare Student -> students.user_id link
            const shouldUpdateStudentLink = (targetUser.role === 'Student' && newRole !== 'Student') ||
                (newRole === 'Student' && body.linkedStudentId !== undefined);
            const nextLinkedStudentId = newRole === 'Student' && body.linkedStudentId
                ? String(body.linkedStudentId).trim()
                : null;

            if (newRole === 'Student' && nextLinkedStudentId) {
                const check = await validateSingleStudentForUser(sql, session, nextLinkedStudentId, targetSchoolId, id);
                if (!check.ok) {
                    return res.status(check.status).json({ error: check.error });
                }
            }

            const safeDisabledNavLinks = disabledNavLinks !== undefined
                ? (Array.isArray(disabledNavLinks) ? disabledNavLinks : [])
                : (targetUser.disabled_nav_links || []);

            const safePermissionsOverrides = permissionsOverrides !== undefined
                ? JSON.stringify(permissionsOverrides || {})
                : JSON.stringify(targetUser.permissions_overrides || {});

            const newStatus = status || targetUser.status || 'Active';

            const executeUpdateUser = async () => {
                const updateProfileQuery = sql`
                    UPDATE profiles 
                    SET name = COALESCE(${name}, name), 
                        avatar_url = CASE 
                            WHEN ${Boolean(avatarUrl && typeof avatarUrl === 'string' && avatarUrl.startsWith('/api/photo'))} THEN avatar_url
                            WHEN ${Boolean(avatarUrl && typeof avatarUrl === 'string' && avatarUrl.startsWith('data:'))} THEN ${avatarUrl}
                            WHEN ${avatarUrl === null || avatarUrl === ''} THEN NULL
                            ELSE avatar_url
                        END,
                        status = ${newStatus},
                        role = ${newRole},
                        school_id = COALESCE(school_id, ${targetSchoolId}),
                        branch_id = ${newBranchId},
                        child_student_ids = ${safeChildStudentIds}::uuid[],
                        disabled_nav_links = ${safeDisabledNavLinks},
                        permissions_overrides = ${safePermissionsOverrides}::jsonb
                    WHERE id = ${id}
                `;

                if (shouldUpdateStudentLink) {
                    const queries: any[] = [updateProfileQuery];
                    if (nextLinkedStudentId) {
                        queries.push(sql`
                            UPDATE students 
                            SET user_id = NULL 
                            WHERE user_id = ${id} AND id <> ${nextLinkedStudentId}
                        `);
                        queries.push(sql`
                            UPDATE students 
                            SET user_id = ${id} 
                            WHERE id = ${nextLinkedStudentId}
                        `);
                    } else {
                        queries.push(sql`
                            UPDATE students 
                            SET user_id = NULL 
                            WHERE user_id = ${id}
                        `);
                    }
                    await sql.transaction(queries);
                } else {
                    await updateProfileQuery;
                }
            };

            try {
                await executeUpdateUser();
            } catch (err: any) {
                if (nextLinkedStudentId && isStudentsUserFkError(err) && (await repairStudentsUserFkIfLegacy(sql))) {
                    await executeUpdateUser();
                } else {
                    throw err;
                }
            }

            // If user status transitioned to Active from Pending Approval, notify the user
            if (targetUser.status === 'Pending Approval' && newStatus === 'Active') {
                try {
                    await sql`
                        INSERT INTO notifications (id, user_id, title, message, link, is_read, timestamp)
                        VALUES (${crypto.randomUUID()}, ${id}, 'Account Approved', 'Your account has been approved by the administration. You now have full access.', '/', false, NOW())
                    `;
                } catch (notifErr) {
                    console.warn('Could not create approval notification for user:', id, notifErr);
                }
            }

            await writeServerAuditLog(
                sql,
                session,
                targetUser.status === 'Pending Approval' && newStatus === 'Active' ? 'Approve User' : 'Update User',
                `Updated profile for ${name || targetUser.name} (Role: ${newRole}, Status: ${newStatus}, Branch: ${newBranchId ? newBranchId : 'All Branches'})`,
                targetSchoolId
            );

            return res.status(200).json({ success: true });

        } else if (action === 'delete-user') {
            if (!isAuthorized(session, ['Owner', 'Admin'])) {
                return res.status(403).json({ error: 'Access denied: Cannot deactivate user accounts.' });
            }

            const { userId } = body;
            if (!userId) {
                return res.status(400).json({ error: 'User ID is required.' });
            }

            const targetUserResult = await sql`SELECT id, role, school_id, branch_id FROM profiles WHERE id = ${userId} LIMIT 1`;
            if (!targetUserResult || targetUserResult.length === 0) {
                return res.status(404).json({ error: 'User not found.' });
            }
            const targetUser = targetUserResult[0];

            // Cannot deactivate Owner
            if (targetUser.role === 'Owner') {
                return res.status(400).json({ error: 'Cannot deactivate an Owner account.' });
            }

            if (!requireSameSchool(session, targetUser.school_id)) {
                return res.status(403).json({ error: 'Access denied: Cannot deactivate user from another school.' });
            }

            if (locked) {
                if (targetUser.branch_id !== session.branchId) {
                    return res.status(403).json({ error: 'Outside your branch' });
                }
            }

            await sql`UPDATE profiles SET status = 'Inactive' WHERE id = ${userId}`;

            await writeServerAuditLog(
                sql,
                session,
                'Deactivate User',
                `Deactivated account for user ID ${userId}`
            );

            return res.status(200).json({ success: true });

        } else if (action === 'bulk-add-users') {
            if (!isAuthorized(session, ['Owner', 'Admin'])) {
                return res.status(403).json({ error: 'Access denied: Cannot bulk import user accounts.' });
            }

            const { users, schoolId } = body;
            if (!Array.isArray(users) || users.length === 0) {
                return res.status(400).json({ error: 'Users array is required.' });
            }

            const effectiveSchoolId = session.role === 'Admin' ? session.schoolId : (session.role === 'Owner' && schoolId ? schoolId : session.schoolId);

            // P10: Validate all rows and detect duplicates in payload first
            const seenEmails = new Set<string>();
            const duplicateEmailsInFile: string[] = [];
            for (const u of users) {
                const cleanEmail = (u.email || '').toLowerCase().trim();
                if (cleanEmail) {
                    if (seenEmails.has(cleanEmail)) {
                        duplicateEmailsInFile.push(cleanEmail);
                    }
                    seenEmails.add(cleanEmail);
                }
            }

            if (duplicateEmailsInFile.length > 0) {
                const uniqueDupes = Array.from(new Set(duplicateEmailsInFile));
                return res.status(400).json({ error: `Duplicate email(s) found in payload: ${uniqueDupes.join(', ')}` });
            }

            // Validate fields, roles, and hash all passwords BEFORE writing to DB (P10)
            const preparedUsers: any[] = [];
            for (let i = 0; i < users.length; i++) {
                const u = users[i];
                if (!u.name || !u.email || !u.password || !u.role) {
                    return res.status(400).json({ error: `Name, email, password, and role are required for all users (row ${i + 1} is missing required fields).` });
                }
                if (typeof u.password !== 'string' || u.password.length < 8) {
                    return res.status(400).json({ error: `Password for user '${u.email}' (row ${i + 1}) must be at least 8 characters long.` });
                }
                const avUrl = u.avatarUrl || u.avatar_url;
                if (avUrl) {
                    const avatarCheck = validateAvatarDataUrl(avUrl);
                    if (!avatarCheck.valid) {
                        return res.status(400).json({ error: `User '${u.email}' (row ${i + 1}): ${avatarCheck.error}` });
                    }
                }
                if (session.role === 'Admin') {
                    if (!['Accountant', 'Teacher', 'Parent', 'Student'].includes(u.role)) {
                        return res.status(403).json({ error: `Admin may create only Accountant, Teacher, Parent, or Student accounts (found '${u.role}' at row ${i + 1}).` });
                    }
                } else if (session.role === 'Owner') {
                    if (!['Owner', 'Admin', 'Accountant', 'Teacher', 'Parent', 'Student'].includes(u.role)) {
                        return res.status(400).json({ error: `Invalid role specified for user '${u.email}' at row ${i + 1}.` });
                    }
                }

                let rowBranchId: string | null = null;
                if (u.role === 'Owner') {
                    rowBranchId = null;
                } else if (locked) {
                    rowBranchId = session.branchId;
                } else if (u.branchId || u.branch_id) {
                    rowBranchId = u.branchId || u.branch_id;
                }

                const hashedPassword = await bcrypt.hash(u.password, 10);
                preparedUsers.push({
                    id: crypto.randomUUID(),
                    name: u.name.trim(),
                    email: u.email.toLowerCase().trim(),
                    password: hashedPassword,
                    role: u.role,
                    avatarUrl: u.avatarUrl || u.avatar_url || null,
                    branchId: rowBranchId
                });
            }

            // Insert in one atomic sql.transaction (P10)
            const queries = preparedUsers.map(u => sql`
                INSERT INTO profiles (id, name, email, password, role, school_id, status, avatar_url, branch_id)
                VALUES (${u.id}, ${u.name}, ${u.email}, ${u.password}, ${u.role}, ${effectiveSchoolId}, 'Active', ${u.avatarUrl}, ${u.branchId})
            `);

            try {
                await sql.transaction(queries);
            } catch (err: any) {
                if (err?.code === '23505' || err?.message?.includes('23505') || err?.message?.includes('profiles_email_key')) {
                    const match = err?.detail?.match(/Key \(email\)=\(([^)]+)\)/);
                    const conflictedEmail = match ? match[1] : 'duplicate email';
                    return res.status(409).json({ error: `Email "${conflictedEmail}" already exists. No users were created.`, email: conflictedEmail });
                }
                throw err;
            }

            await writeServerAuditLog(
                sql,
                session,
                'Bulk Import Users',
                `Bulk created ${preparedUsers.length} user accounts`,
                effectiveSchoolId
            );

            return res.status(200).json({ success: true, count: preparedUsers.length });

        // School operations
        } else if (action === 'add-school') {
            return res.status(403).json({ error: 'Single-school installation: Adding additional schools is disabled.' });

        } else if (action === 'update-school') {
            if (locked) return res.status(403).json({ error: 'Outside your branch' });
            if (!isAuthorized(session, ['Owner', 'Admin'])) {
                return res.status(403).json({ error: 'Access denied: Only Owner or Admin can update institution profile.' });
            }

            const { id, name, address, logoUrl } = body;
            if (!id) {
                return res.status(400).json({ error: 'School ID is required.' });
            }

            if (logoUrl) {
                const logoCheck = validateAvatarDataUrl(logoUrl);
                if (!logoCheck.valid) {
                    return res.status(400).json({ error: logoCheck.error });
                }
            }

            const schools = await sql`SELECT id FROM schools WHERE id = ${id} LIMIT 1`;
            if (!schools || schools.length === 0) {
                return res.status(404).json({ error: 'School not found.' });
            }

            if (!requireSameSchool(session, id)) {
                return res.status(403).json({ error: 'Access denied: Cannot update school outside jurisdiction.' });
            }

            await sql`UPDATE schools SET name = ${name}, address = ${address || ''}, logo_url = ${logoUrl || null} WHERE id = ${id}`;
            await writeServerAuditLog(sql, session, 'Update School', `Updated institution profile: ${name}`, id);
            return res.status(200).json({ success: true });

        } else if (action === 'delete-school') {
            return res.status(403).json({ error: 'Single-school installation: Deleting the school institution is disabled.' });

        } else if (action === 'add-log') {
            if (!isAuthorized(session, ['Owner', 'Admin', 'Accountant'])) {
                return res.status(403).json({ error: 'Access denied: Cannot add system logs.' });
            }
            const { actionName, details, schoolId } = body;
            const effectiveSchoolId = session.role === 'Owner' && schoolId ? schoolId : session.schoolId;
            await writeServerAuditLog(sql, session, actionName || 'Action', details || '', effectiveSchoolId);
            return res.status(200).json({ success: true });

        } else {
            return res.status(400).json({ error: `Unknown action: ${action}` });
        }

    } catch (err: any) {
        console.error("Users/Schools API error:", err);
        return res.status(500).json({ error: err.message || 'Server error updating users/schools.' });
    }
}
