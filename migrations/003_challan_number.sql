-- Migration 003: drop the erroneous unique index on challan_number.
-- challan_number is NOT unique across schools. Uniqueness is enforced by
-- idx_unique_active_student_challan (student_id, month, year) instead.
DROP INDEX IF EXISTS idx_unique_active_challan_number;
