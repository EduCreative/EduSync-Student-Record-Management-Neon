-- 001_login_attempts.sql: Database-backed login rate-limiting table
CREATE TABLE IF NOT EXISTS login_attempts (
    email TEXT NOT NULL,
    ip TEXT,
    attempted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_email_time ON login_attempts(email, attempted_at DESC);
