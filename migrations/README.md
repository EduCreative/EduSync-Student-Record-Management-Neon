# Database Migrations

`schema.sql` at the root of the repository is the single source of truth and baseline schema for fresh database installations.

Every subsequent database schema change is added as a new sequentially numbered file (`001_...sql`, `002_...sql`, etc.) in this directory.

### Migration Rules:
1. **Idempotence**: Every migration statement must be safe to run multiple times (use `CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, etc.).
2. **Standard Statements Only**: Do NOT use `DO $$` blocks or custom procedural functions in migration files.
3. **Statement Delimiters**: Each SQL statement must end with `;` on its own line.
4. **Execution**: Applied migrations are tracked automatically in the `schema_migrations` table by running `npm run migrate`.
