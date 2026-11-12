-- Migration 003: Add branch_id to profiles table for branch-locked staff
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_profiles_branch_id ON profiles(branch_id);
