
# Changelog

## [3.3.7] - 2025-02-21

### Added
- **Functional Cloud Restore**: The `restoreData` function now actually writes data to the Neon database. It supports clearing existing records and re-populating from a JSON snapshot (local or Google Drive).
- **Context-Aware Safety**: Restore logic automatically restricts its scope to the current school ID for Admin users, preventing accidental cross-school data corruption.

### Fixed
- **Environment Variable Binding**: Confirmed `VITE_GOOGLE_CLIENT_ID` integration for Vercel deployments.

## [3.3.6] - 2025-02-21

### Added
- **Google Drive Backup Utility**: Integrated Google Identity Services and Drive API for off-site data snapshots.
