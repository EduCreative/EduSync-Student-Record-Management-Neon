let bispColumnEnsured = false;
let bispColumnPromise: Promise<void> | null = null;

export function isStudentsUserFkError(err: any): boolean {
    const code = err?.code;
    const constraint = err?.constraint;
    const message = typeof err?.message === 'string' ? err.message : '';
    return (
        (code === '23503' || message.includes('23503') || message.includes('violates foreign key constraint')) &&
        (constraint === 'students_user_id_fkey' || message.includes('students_user_id_fkey'))
    );
}

/**
 * Checks whether students_user_id_fkey in the live database still points to a
 * legacy table (such as Supabase's auth.users) instead of public.profiles(id).
 * If so, clears any orphaned user_id references and repoints the FK to profiles(id).
 */
export async function repairStudentsUserFkIfLegacy(sql: any): Promise<boolean> {
    try {
        const fkRows = await sql`
            SELECT c.conname, c.confrelid::regclass::text AS ref_table
            FROM pg_constraint c
            WHERE c.conrelid = 'students'::regclass
              AND c.conname = 'students_user_id_fkey'
            LIMIT 1
        `;

        if (fkRows && fkRows.length > 0) {
            const refTable = String(fkRows[0].ref_table || '').replace(/^public\./, '');
            if (refTable === 'profiles') {
                return false;
            }
        }

        await sql`
            UPDATE students
            SET user_id = NULL
            WHERE user_id IS NOT NULL
              AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = students.user_id)
        `;
        await sql`ALTER TABLE students DROP CONSTRAINT IF EXISTS students_user_id_fkey`;
        await sql`
            ALTER TABLE students
            ADD CONSTRAINT students_user_id_fkey
            FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE SET NULL
        `;
        return true;
    } catch (repairErr) {
        console.error('Failed to repair legacy students_user_id_fkey constraint:', repairErr);
        return false;
    }
}

/**
 * Ensures students.receive_bisp_support exists without acquiring table locks on
 * subsequent calls (cached once verified in the current server instance).
 */
export async function ensureBispSupportColumn(sql: any): Promise<void> {
    if (bispColumnEnsured) return;
    if (!bispColumnPromise) {
        bispColumnPromise = (async () => {
            try {
                const colRows = await sql`
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_schema = 'public'
                      AND table_name = 'students'
                      AND column_name = 'receive_bisp_support'
                    LIMIT 1
                `;
                if (!colRows || colRows.length === 0) {
                    await sql`
                        ALTER TABLE students
                        ADD COLUMN IF NOT EXISTS receive_bisp_support BOOLEAN NOT NULL DEFAULT FALSE
                    `;
                }
                bispColumnEnsured = true;
            } catch (err) {
                bispColumnPromise = null;
                throw err;
            }
        })();
    }
    return bispColumnPromise;
}
