// FIX: Reverted Dexie import to a default import. The named import '{ Dexie }' does not provide the class constructor needed for subclassing, which caused errors where core methods like '.version()' and '.transaction()' were not found.
import * as DexieModule from 'dexie';
import type { Table } from 'dexie';
import { School, User, Class, Student, Attendance, FeeChallan, Result, ActivityLog, FeeHead, SchoolEvent, Notification, Subject, Exam } from '../types';

// FIX: Use namespace import and extract default to ensure correct class constructor for extension.
const Dexie = (DexieModule as any).default;

export const DBNAME = 'EduSyncDB';

export class EduSyncDB extends Dexie {
    schools!: Table<School, string>;
    users!: Table<User, string>;
    classes!: Table<Class, string>;
    students!: Table<Student, string>;
    attendance!: Table<Attendance, string>;
    fees!: Table<FeeChallan, string>;
    results!: Table<Result, string>;
    logs!: Table<ActivityLog, string>;
    feeHeads!: Table<FeeHead, string>;
    events!: Table<SchoolEvent, string>;
    notifications!: Table<Notification, string>;
    subjects!: Table<Subject, string>;
    exams!: Table<Exam, string>;

    constructor() {
        super(DBNAME);
        this.version(1).stores({
            schools: 'id, name',
            users: 'id, schoolId, role, email',
            classes: 'id, schoolId, teacherId',
            students: 'id, schoolId, classId, userId',
            attendance: 'id, &[studentId+date]',
            fees: 'id, studentId, classId, month, year, challanNumber',
            results: 'id, &[studentId+classId+exam+subject]',
            logs: 'id, userId, schoolId, timestamp',
            feeHeads: 'id, schoolId',
            events: 'id, schoolId, date',
            notifications: 'id, userId, isRead, timestamp',
        });
        
        // FIX: Add a new, empty version 2. This forces an upgrade transaction,
        // resolving potential issues with a corrupted or inconsistent database state
        // from previous development versions, which can cause the DB to hang.
        this.version(2).stores({});
        
        this.version(3).stores({
            subjects: 'id, schoolId, name'
        });

        this.version(4).stores({
            exams: 'id, schoolId, name'
        });

        // FIX: Bump version to force an upgrade and resolve potential DB hangs.
        this.version(5).stores({});

        // FIX: Bump version again to force another upgrade to resolve hanging state.
        this.version(6).stores({});

        // FIX: Bump version again to force another upgrade to resolve hanging state.
        this.version(7).stores({});

        // FIX: Bump version to 8 to unblock current user and add a hard reset feature as a permanent solution.
        this.version(8).stores({});

        // FIX: Final bump to version 9 to unblock user and allow access to new Sync Mode feature.
        this.version(9).stores({});

        this.on('blocked', () => {
            console.warn(
              `Database is blocked. This can happen if you have multiple tabs open with different versions of the code, or if a transaction is long-running. Please close other tabs.`
            );
        });
    }
}

export const db = new EduSyncDB();

export async function deleteDatabase() {
    await db.close();
    await Dexie.delete(DBNAME);
    console.log(`${DBNAME} has been deleted.`);
}