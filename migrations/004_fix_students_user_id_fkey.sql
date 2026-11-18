-- Migration 004: Point students.user_id foreign key to public.profiles(id) instead of legacy auth.users(id)
UPDATE students SET user_id = NULL WHERE user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = students.user_id);

ALTER TABLE students DROP CONSTRAINT IF EXISTS students_user_id_fkey;

ALTER TABLE students ADD CONSTRAINT students_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE SET NULL;
