-- 1. ALTER TABLE ADD COLUMN IF NOT EXISTS
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id);
ALTER TABLE results ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id);
ALTER TABLE fee_challans ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone_number TEXT;

-- 2. Backfill school_id
UPDATE attendance a SET school_id = s.school_id FROM students s WHERE a.student_id = s.id;
UPDATE results r SET school_id = s.school_id FROM students s WHERE r.student_id = s.id;

-- 3. Duplicate checks
-- WARNING: Run these queries. If they return results, you MUST delete or update 
-- those duplicate rows before proceeding to the constraints below.
SELECT student_id, month, year, COUNT(*) FROM fee_challans WHERE status <> 'Cancelled' GROUP BY student_id, month, year HAVING COUNT(*) > 1;

-- 4. Constraints (Run AFTER clearing duplicates)
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_student_challan ON fee_challans (student_id, month, year) WHERE status <> 'Cancelled';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_amounts') THEN
    ALTER TABLE fee_challans ADD CONSTRAINT check_amounts CHECK (paid_amount >= 0 AND discount >= 0 AND total_amount >= 0);
  END IF;
END $$;
