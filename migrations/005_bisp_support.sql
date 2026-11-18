-- Migration 005: Add informational receive_bisp_support column to students table
ALTER TABLE students ADD COLUMN IF NOT EXISTS receive_bisp_support BOOLEAN NOT NULL DEFAULT FALSE;
