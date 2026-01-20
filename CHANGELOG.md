
# Changelog

## [3.4.3] - 2025-02-21

### Fixed
- **Build Error TS6133**: Resolved unused parameter `selectedHeads` in `DataContext.tsx`.
- **Fee Generation**: Restored missing logic in `generateChallansForMonth` to correctly calculate student arrears and respect custom fee structures.

## [3.4.2] - 2025-02-21

### Added
- **Intelligent Auto-Backup Scheduler**: Re-engineered the background sync to run safely without triggering infinite re-fetch loops.
- **Improved Data Integrity**: Added validation checks before performing global restores.

### Fixed
- **Build Error TS6133**: Resolved unused variable 'data' in SettingsPage.tsx.
- **Context Refresh**: Fixed a bug where switching schools didn't always reset the auto-backup due-date calculation.

## [3.4.1] - 2025-02-21
- **Scheduled Auto-Backups**: Users can now enable automatic backups to Google Drive.
