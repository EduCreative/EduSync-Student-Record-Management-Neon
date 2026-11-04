-- Migration 002: Unique Roll Numbers per School
-- 1. Identify any duplicate roll numbers among active/graduated students
-- WARNING: If this SELECT returns rows, update or correct the duplicate roll numbers before creating the unique index below.
SELECT school_id, roll_number, COUNT(*) 
FROM students 
WHERE status <> 'Deleted' 
GROUP BY school_id, roll_number 
HAVING COUNT(*) > 1;

-- 2. Partial unique index to enforce unique roll numbers per school (excluding Deleted students)
CREATE UNIQUE INDEX IF NOT EXISTS students_school_roll_unique 
ON students (school_id, roll_number) 
WHERE status <> 'Deleted';
