

import { neon } from '@neondatabase/serverless';
import { db } from './db';
import { toSnakeCase } from '../utils/caseConverter';

const databaseUrl = import.meta.env.VITE_NEON_DATABASE_URL;

// Original neon client if URL is set
const originalSql = databaseUrl ? neon(databaseUrl) : null;

// Seeding logic for offline mode
let isSeeded = false;
async function ensureSeeded() {
    if (isSeeded) return;
    isSeeded = true;
    try {
        const count = await db.users.count();
        if (count === 0) {
            console.log("Seeding local Dexie database with default sandbox data...");
            await db.transaction('rw', db.tables, async () => {
                await db.schools.put({
                    id: 'school-1',
                    name: 'Oakridge International School',
                    address: '123 Education Lane, Sector 4',
                    logoUrl: 'https://images.unsplash.com/photo-1546410531-bb4caa6b424d?w=120&auto=format&fit=crop'
                });
                
                await db.users.bulkPut([
                    {
                        id: 'user-owner',
                        name: 'Khurram Masroor',
                        email: 'owner@edusync.com',
                        password: 'password123',
                        role: 'Owner' as any,
                        schoolId: null,
                        status: 'Active',
                        avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop',
                        disabledNavLinks: [],
                        permissionsOverrides: {}
                    },
                    {
                        id: 'user-admin',
                        name: 'Sarah Jenkins',
                        email: 'admin@edusync.com',
                        password: 'password123',
                        role: 'Admin' as any,
                        schoolId: 'school-1',
                        status: 'Active',
                        avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop',
                        disabledNavLinks: [],
                        permissionsOverrides: {}
                    },
                    {
                        id: 'user-accountant',
                        name: 'Michael Chang',
                        email: 'accountant@edusync.com',
                        password: 'password123',
                        role: 'Accountant' as any,
                        schoolId: 'school-1',
                        status: 'Active',
                        avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop',
                        disabledNavLinks: [],
                        permissionsOverrides: {}
                    },
                    {
                        id: 'user-teacher',
                        name: 'Emma Watson',
                        email: 'teacher@edusync.com',
                        password: 'password123',
                        role: 'Teacher' as any,
                        schoolId: 'school-1',
                        status: 'Active',
                        avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=100&auto=format&fit=crop',
                        disabledNavLinks: [],
                        permissionsOverrides: {}
                    },
                    {
                        id: 'user-parent',
                        name: 'David Miller',
                        email: 'parent@edusync.com',
                        password: 'password123',
                        role: 'Parent' as any,
                        schoolId: 'school-1',
                        status: 'Active',
                        avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&auto=format&fit=crop',
                        disabledNavLinks: [],
                        permissionsOverrides: {}
                    },
                    {
                        id: 'user-student',
                        name: 'Alex Miller',
                        email: 'student@edusync.com',
                        password: 'password123',
                        role: 'Student' as any,
                        schoolId: 'school-1',
                        status: 'Active',
                        avatarUrl: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=100&auto=format&fit=crop',
                        disabledNavLinks: [],
                        permissionsOverrides: {}
                    }
                ]);

                await db.classes.put({
                    id: 'class-1',
                    name: 'Grade 10',
                    section: 'A',
                    teacherId: 'user-teacher',
                    schoolId: 'school-1',
                    sortOrder: 1
                });

                await db.subjects.bulkPut([
                    { id: 'sub-math', name: 'Mathematics', schoolId: 'school-1' },
                    { id: 'sub-eng', name: 'English', schoolId: 'school-1' },
                    { id: 'sub-sci', name: 'Science', schoolId: 'school-1' }
                ]);

                await db.exams.bulkPut([
                    { id: 'exam-mid', name: 'Midterm', schoolId: 'school-1' },
                    { id: 'exam-final', name: 'Final Term', schoolId: 'school-1' }
                ]);

                await db.feeHeads.bulkPut([
                    { id: 'fh-tuition', name: 'Tuition Fee', defaultAmount: 3500, schoolId: 'school-1' },
                    { id: 'fh-exam', name: 'Exam Fee', defaultAmount: 500, schoolId: 'school-1' }
                ]);

                await db.students.put({
                    id: 'student-1',
                    userId: 'user-student',
                    name: 'Alex Miller',
                    classId: 'class-1',
                    schoolId: 'school-1',
                    rollNumber: '1001',
                    grNumber: 'GR-4829',
                    fatherName: 'David Miller',
                    fatherCnic: '12345-6789012-3',
                    dateOfBirth: '2011-05-15',
                    dateOfAdmission: '2023-04-01',
                    contactNumber: '+15550199',
                    address: '789 Maple Street, Apt 4B',
                    status: 'Active',
                    gender: 'Male',
                    openingBalance: 0,
                    feeStructure: [
                        { feeHeadId: 'fh-tuition', amount: 3500 },
                        { feeHeadId: 'fh-exam', amount: 500 }
                    ],
                    admittedClass: 'Grade 10'
                });

                await db.fees.bulkPut([
                    {
                        id: 'fee-1',
                        challanNumber: '202607-1001',
                        studentId: 'student-1',
                        classId: 'class-1',
                        month: 'July',
                        year: 2026,
                        dueDate: '2026-07-20',
                        status: 'Unpaid',
                        feeItems: [
                            { description: 'Tuition Fee', amount: 3500 },
                            { description: 'Exam Fee', amount: 500 }
                        ],
                        previousBalance: 0,
                        totalAmount: 4000,
                        discount: 0,
                        paidAmount: 0,
                        fineAmount: 0,
                        paymentHistory: []
                    },
                    {
                        id: 'fee-2',
                        challanNumber: '202606-1001',
                        studentId: 'student-1',
                        classId: 'class-1',
                        month: 'June',
                        year: 2026,
                        dueDate: '2026-06-20',
                        status: 'Paid',
                        feeItems: [
                            { description: 'Tuition Fee', amount: 3500 }
                        ],
                        previousBalance: 0,
                        totalAmount: 3500,
                        discount: 0,
                        paidAmount: 3500,
                        fineAmount: 0,
                        paymentHistory: [{ amount: 3500, date: '2026-06-15' }]
                    }
                ]);

                await db.events.bulkPut([
                    {
                        id: 'event-1',
                        title: 'Annual Sports Day',
                        date: '2026-07-25',
                        category: 'Event',
                        description: 'Oakridge School Annual Athletic Meet.',
                        schoolId: 'school-1'
                    },
                    {
                        id: 'event-2',
                        title: 'Parent-Teacher Meeting',
                        date: '2026-08-05',
                        category: 'Meeting',
                        description: 'Discussion of academic performance and term reports.',
                        schoolId: 'school-1'
                    }
                ]);
            });
            console.log("Seeding complete. Ready for offline sandbox demo.");
        }
    } catch (err) {
        console.error("Database seeding failed:", err);
    }
}

// Map PostgreSQL tables to Dexie tables
const getDexieTable = (tableName: string) => {
    const tableMap: Record<string, any> = {
        'profiles': db.users,
        'schools': db.schools,
        'classes': db.classes,
        'subjects': db.subjects,
        'exams': db.exams,
        'students': db.students,
        'attendance': db.attendance,
        'fee_challans': db.fees,
        'fee_heads': db.feeHeads,
        'school_events': db.events,
        'activity_logs': db.logs,
        'results': db.results
    };
    return tableMap[tableName];
};

// SQL query interpreter using Dexie
const executeSqlOffline = async (queryText: string, params: any[]): Promise<any[]> => {
    await ensureSeeded();
    const cleanQuery = queryText.replace(/\s+/g, ' ').trim().toLowerCase();
    
    // Find table name
    let tableName = '';
    const tables = [
        'profiles', 'schools', 'classes', 'subjects', 'exams', 
        'students', 'attendance', 'fee_challans', 'fee_heads', 
        'school_events', 'activity_logs', 'results'
    ];
    for (const t of tables) {
        const regex = new RegExp(`\\b${t}\\b`, 'i');
        if (regex.test(queryText)) {
            tableName = t;
            break;
        }
    }
    
    const dexieTable = getDexieTable(tableName);

    // 1. SELECT
    if (cleanQuery.startsWith('select')) {
        if (!dexieTable) return [];
        let items = await dexieTable.toArray();
        
        // Apply filter (WHERE clause)
        const whereMatch = queryText.match(/where\s+(.*?)(?:\s+order\s+by|\s+limit|$)/i);
        if (whereMatch) {
            const conditionStr = whereMatch[1].trim();
            
            items = items.filter((item: any) => {
                const getVal = (colName: string) => {
                    const camelKey = colName.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
                    return item[camelKey] !== undefined ? item[camelKey] : item[colName];
                };

                // email = $1 AND password = $2
                if (/email\s*=\s*\$1\s+and\s+password\s*=\s*\$2/i.test(conditionStr)) {
                    return getVal('email') === params[0] && getVal('password') === params[1];
                }
                // email = $1
                if (/email\s*=\s*\$1/i.test(conditionStr)) {
                    return getVal('email') === params[0];
                }
                // school_id = $1 OR school_id IS NULL
                if (/school_id\s*=\s*\$1\s+or\s+school_id\s+is\s+null/i.test(conditionStr)) {
                    const sId = getVal('school_id');
                    return sId === params[0] || sId === null || sId === undefined || sId === '';
                }
                // school_id = $1
                if (/school_id\s*=\s*\$1/i.test(conditionStr)) {
                    return getVal('school_id') === params[0];
                }
                // student_id = ANY($1)
                if (/student_id\s*=\s*any\s*\(\s*\$1\s*\)/i.test(conditionStr)) {
                    const arr = params[0] || [];
                    return arr.includes(getVal('student_id'));
                }
                // class_id = $1
                if (/class_id\s*=\s*\$1/i.test(conditionStr)) {
                    return getVal('class_id') === params[0];
                }
                // id = $1
                if (/id\s*=\s*\$1/i.test(conditionStr)) {
                    return getVal('id') === params[0];
                }
                return true;
            });
        }

        // Apply Order By
        const orderByMatch = queryText.match(/order\s+by\s+(\w+)(?:\s+(desc|asc))?/i);
        if (orderByMatch) {
            const field = orderByMatch[1];
            const direction = orderByMatch[2]?.toLowerCase() === 'desc' ? -1 : 1;
            const camelField = field.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
            items.sort((a: any, b: any) => {
                const valA = a[camelField] ?? a[field] ?? '';
                const valB = b[camelField] ?? b[field] ?? '';
                if (valA < valB) return -1 * direction;
                if (valA > valB) return 1 * direction;
                return 0;
            });
        }

        // Apply Limit
        const limitMatch = queryText.match(/limit\s+(\d+)/i);
        if (limitMatch) {
            const limit = parseInt(limitMatch[1], 10);
            items = items.slice(0, limit);
        }

        return items.map((item: any) => toSnakeCase(item));
    }

    // 2. INSERT
    if (cleanQuery.startsWith('insert')) {
        if (!dexieTable) return [];
        
        const colsMatch = queryText.match(/\(([^)]+)\)\s+values/i);
        if (colsMatch) {
            const cols = colsMatch[1].split(',').map(c => c.trim().toLowerCase());
            const record: any = {};
            for (let i = 0; i < cols.length; i++) {
                const col = cols[i];
                let val = params[i];
                const camelKey = col.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
                
                // Parse potential JSON values
                if (typeof val === 'string' && (val.startsWith('{') || val.startsWith('['))) {
                    try { val = JSON.parse(val); } catch {}
                }
                record[camelKey] = val;
            }
            
            // Generate primary key if missing
            if (!record.id) {
                record.id = crypto.randomUUID();
            }

            // Handle uniqueness and updates for conflict-prone tables
            if (tableName === 'attendance') {
                const existing = await dexieTable.where({ studentId: record.studentId, date: record.date }).first();
                if (existing) {
                    record.id = existing.id;
                }
            } else if (tableName === 'results') {
                const existing = await dexieTable.where({
                    studentId: record.studentId,
                    classId: record.classId,
                    exam: record.exam,
                    subject: record.subject
                }).first();
                if (existing) {
                    record.id = existing.id;
                }
            }

            await dexieTable.put(record);
            return [toSnakeCase(record)];
        }
        return [];
    }

    // 3. UPDATE
    if (cleanQuery.startsWith('update')) {
        if (!dexieTable) return [];

        const setMatch = queryText.match(/set\s+(.*?)\s+where/i);
        if (!setMatch) return [];

        const setParts = setMatch[1].split(',');
        const updatesToApply: Record<string, any> = {};
        for (const part of setParts) {
            const match = part.match(/(\w+)\s*=\s*(?:\$([0-9]+)|'([^']+)'|"(.*?)"|(.*?))/);
            if (match) {
                const col = match[1].trim();
                const paramIdx = match[2];
                let val: any;
                if (paramIdx) {
                    val = params[parseInt(paramIdx, 10) - 1];
                } else {
                    val = match[3] || match[4] || match[5]?.trim();
                }
                
                // Parse potential JSON values
                if (typeof val === 'string' && (val.startsWith('{') || val.startsWith('['))) {
                    try { val = JSON.parse(val); } catch {}
                }

                const camelKey = col.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
                updatesToApply[camelKey] = val;
            }
        }

        let targetRecords: any[] = [];
        const anyIdMatch = queryText.match(/where\s+id\s*=\s*any\s*\(\s*\$([0-9]+)\s*\)/i);
        const inIdMatch = queryText.match(/where\s+id\s+in\s*\(\s*\$([0-9]+)\s*\)/i);
        const classIdMatch = queryText.match(/where\s+class_id\s*=\s*(?:\$([0-9]+)|'([^']+)')/i);
        const idMatch = queryText.match(/where\s+id\s*=\s*(?:\$([0-9]+)|'([^']+)')/i);

        if (anyIdMatch || inIdMatch) {
            const paramIdx = parseInt((anyIdMatch || inIdMatch)![1], 10) - 1;
            const rawParam = params[paramIdx];
            const idsList = Array.isArray(rawParam) ? rawParam : [rawParam];
            const idSet = new Set(idsList);
            const allItems = await dexieTable.toArray();
            targetRecords = allItems.filter((item: any) => idSet.has(item.id));
        } else if (classIdMatch) {
            const targetClassId = classIdMatch[1] ? params[parseInt(classIdMatch[1], 10) - 1] : classIdMatch[2];
            const allItems = await dexieTable.toArray();
            targetRecords = allItems.filter((item: any) => item.classId === targetClassId);
        } else if (idMatch) {
            const targetId = idMatch[1] ? params[parseInt(idMatch[1], 10) - 1] : idMatch[2];
            const existing = await dexieTable.get(targetId);
            if (existing) targetRecords = [existing];
        }

        if (targetRecords.length > 0) {
            for (const item of targetRecords) {
                Object.assign(item, updatesToApply);
                await dexieTable.put(item);
            }
            return targetRecords.map(r => toSnakeCase(r));
        }
        return [];
    }

    // 4. TRUNCATE
    if (cleanQuery.startsWith('truncate')) {
        if (!dexieTable) return [];
        await dexieTable.clear();
        return [];
    }

    // 5. DELETE
    if (cleanQuery.startsWith('delete')) {
        if (!dexieTable) return [];
        
        // Specialized logic for bulk deleting fee challans of a month
        if (tableName === 'fee_challans' && cleanQuery.includes('month') && cleanQuery.includes('year')) {
            const m = params[0];
            const y = params[1];
            const allFees = await db.fees.toArray();
            const toDelete = allFees.filter(f => f.month === m && f.year === y && (f.paidAmount || 0) === 0);
            for (const f of toDelete) {
                await db.fees.delete(f.id);
            }
            return toDelete.map(f => toSnakeCase(f));
        }

        // Subquery or student_id bulk delete (e.g. DELETE FROM results WHERE student_id IN (SELECT id FROM students WHERE school_id = $1))
        if (cleanQuery.includes('student_id')) {
            const sidMatch = queryText.match(/where\s+school_id\s*=\s*(?:\$([0-9]+)|'([^']+)')/i);
            if (sidMatch) {
                const sid = sidMatch[1] ? params[parseInt(sidMatch[1], 10) - 1] : sidMatch[2];
                const allStudents = await db.students.toArray();
                const schoolStudentIds = new Set(allStudents.filter(s => s.schoolId === sid).map(s => s.id));
                const allItems = await dexieTable.toArray();
                const toDelete = allItems.filter((i: any) => schoolStudentIds.has(i.studentId || i.student_id));
                for (const item of toDelete) {
                    await dexieTable.delete(item.id);
                }
                return toDelete.map((i: any) => toSnakeCase(i));
            }
        }

        // School ID based delete (e.g. DELETE FROM classes WHERE school_id = $1)
        const schoolIdMatch = queryText.match(/where\s+school_id\s*=\s*(?:\$([0-9]+)|'([^']+)')/i);
        if (schoolIdMatch) {
            const sid = schoolIdMatch[1] ? params[parseInt(schoolIdMatch[1], 10) - 1] : schoolIdMatch[2];
            const notIdMatch = queryText.match(/and\s+id\s*!=\s*(?:\$([0-9]+)|'([^']+)')/i);
            const notId = notIdMatch ? (notIdMatch[1] ? params[parseInt(notIdMatch[1], 10) - 1] : notIdMatch[2]) : null;

            const allItems = await dexieTable.toArray();
            const toDelete = allItems.filter((item: any) => {
                const itemSid = item.schoolId || item.school_id;
                if (itemSid !== sid) return false;
                if (notId && item.id === notId) return false;
                return true;
            });
            for (const item of toDelete) {
                await dexieTable.delete(item.id);
            }
            return toDelete.map((i: any) => toSnakeCase(i));
        }

        // Role exclusion delete (e.g. DELETE FROM profiles WHERE role != 'Owner')
        const notRoleMatch = queryText.match(/where\s+role\s*!=\s*(?:\$([0-9]+)|'([^']+)')/i);
        if (notRoleMatch) {
            const roleVal = notRoleMatch[1] ? params[parseInt(notRoleMatch[1], 10) - 1] : notRoleMatch[2];
            const allProfiles = await db.users.toArray();
            const toDelete = allProfiles.filter((p: any) => p.role !== roleVal);
            for (const p of toDelete) {
                await db.users.delete(p.id);
            }
            return toDelete.map((p: any) => toSnakeCase(p));
        }

        // Check for DELETE without WHERE (wipe whole table)
        if (!cleanQuery.includes('where')) {
            await dexieTable.clear();
            return [];
        }

        const idMatch = queryText.match(/where\s+id\s*=\s*(?:\$([0-9]+)|'([^']+)')/i);
        let targetId = '';
        if (idMatch) {
            if (idMatch[1]) {
                targetId = params[parseInt(idMatch[1], 10) - 1];
            } else {
                targetId = idMatch[2];
            }
        }
        if (targetId) {
            const existing = await dexieTable.get(targetId);
            await dexieTable.delete(targetId);
            return existing ? [toSnakeCase(existing)] : [];
        }
    }

    return [];
};

// Tagged template string literal support for query execution
export const sql = (strings: TemplateStringsArray | string, ...values: any[]) => {
    let queryText = '';
    let params: any[] = [];

    if (typeof strings === 'string') {
        queryText = strings;
        // If values was passed as an array e.g. sql(query, [v1, v2, ...]) or query(sql, params)
        if (values.length === 1 && Array.isArray(values[0])) {
            params = values[0];
        } else {
            params = values;
        }
    } else {
        for (let i = 0; i < strings.length; i++) {
            queryText += strings[i];
            if (i < values.length) {
                queryText += `$${i + 1}`;
            }
        }
        params = values;
    }

    if (originalSql) {
        return originalSql(queryText as any, params as any) as any;
    } else {
        // Fallback to offline simulator
        return executeSqlOffline(queryText, params);
    }
};

export const query = async <T = any>(sqlString: string, params: any[] = []): Promise<T[]> => {
    try {
        const result = await (sql as any)(sqlString, params);
        return result as unknown as T[];
    } catch (error) {
        console.error("Database query failed:", error);
        throw error;
    }
};
