
# Changelog

## [3.5.2] - 2025-02-21

### Fixed
- **Announcements**: Resolved "Failed to send announcement" error by optimizing the database broadcast process and improving targeting logic.
- **Parent Targeting**: Fixed an issue where parents were not receiving class-specific announcements.
- **Broadcast Reliability**: Implemented chunked parallel processing for notifications to prevent timeouts during large-scale broadcasts.

## [3.5.1] - 2025-02-21
- **Vercel Build**: Resolved `TS6133` error regarding unused variables.
- **Header (Mobile)**: Improved responsiveness for small screens.
