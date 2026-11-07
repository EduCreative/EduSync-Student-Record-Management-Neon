-- Migration 002: Add branches table and class branch assignment
CREATE TABLE IF NOT EXISTS branches (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    address TEXT,
    school_id UUID REFERENCES schools(id) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(school_id, name)
);

ALTER TABLE classes ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;
