
# Changelog

## [3.3.3] - 2025-02-21

### Added
- **Targeted Broadcasts**: Admins and Teachers can now send announcements to specific user roles or filter by classes when targeting Parents/Students.
- **Enhanced Recipient Resolution**: Added logic to find linked student accounts automatically when broadcasting to specific classes.

### Fixed
- **Build Errors**: Resolved TypeScript `TS6133` unused variable and unused declaration errors in `AnnouncementsPage.tsx` and `constants.tsx`.

## [3.3.2] - 2025-02-21

### Added
- **Announcement Broadcasting**: Teachers and Admins can now send custom announcements to targeted groups (e.g., all Parents, or specific classes).
- **Notification Center**: A new bell icon in the header with a real-time unread badge and dropdown feed for all system alerts and custom announcements.
- **Recipient Targeting**: Broadcast engine resolves recipients based on roles and class assignments automatically.
