
# Changelog

## [3.6.1] - 2026-07-13

### Fixed
- **Registration & User Creation**: Dropped obsolete `profiles_id_fkey` constraint that linked to non-existent `auth.users` tables, resolving user registration and creation errors.
- **Missing Notification Schema**: Created the missing `notifications` table in Neon Postgres to eliminate fetching errors and restore notification capabilities.

## [3.6.0] - 2026-07-13

### Added
- **Local Dexie Database SQL Interpreter**: Fully integrated virtual SQL translation engine which runs queries on IndexedDB if the cloud connection or `VITE_NEON_DATABASE_URL` is unconfigured. This prevents system load-time failures.
- **Robust Demo Seeding**: Automatic seeding of high-quality sample data (schools, profiles, classes, exams, and financial challans) when running in offline sandbox mode.
- **Integrated Update Verification Engine**: Implemented automatic update checking against root `/version.json` with an eye-safe prompt to bust cache and fetch the latest version.

## [3.5.5] - 2025-02-21

### Fixed
- **Vercel Build**: Resolved `TS6133` errors by removing unused component declarations and imports in `SettingsPage` and `DataContext`.

## [3.5.4] - 2025-02-21

### Added
- **Smart Backup UI**: Redesigned the Google Drive backup interface inspired by WhatsApp's "Chat Backup."
- **Selective Backup**: Added an "Include Photos" toggle to exclude student/staff photos and school logos from backups, saving storage space and increasing sync speed.
- **Backup Statistics**: Real-time display of last backup date and file size.

## [3.5.3] - 2025-02-21

### Fixed
- **Image Backups**: Unified the restoration engine to ensure School Logos and Student Avatars (base64 strings) are preserved during system reconstruction.
- **Data Integrity**: Standardized table processing to dynamically map all columns from JSON backups to the Neon Postgres schema.
