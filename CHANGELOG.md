
# Changelog

## [3.4.4] - 2025-02-21

### Fixed
- **Google Drive Authentication**: Completely refactored the OAuth token flow to prevent the "Stuck at 40%" issue. Removed polling in favor of a clean Promise-based callback.
- **Backup Concurrency**: Added internal locks to prevent multiple simultaneous backup attempts.

## [3.4.3] - 2025-02-21

### Fixed
- **Build Error TS6133**: Resolved unused parameter `selectedHeads` in `DataContext.tsx`.
- **Fee Generation**: Restored missing logic in `generateChallansForMonth` to correctly calculate student arrears and respect custom fee structures.
