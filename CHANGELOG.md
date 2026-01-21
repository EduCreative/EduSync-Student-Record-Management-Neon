
# Changelog

## [3.4.6] - 2025-02-21

### Added
- **Global Operation Overlay**: Moved the progress overlay to the main layout so batch tasks (imports, promotes) are visible from any page.
- **Batch Progress Tracking**: Added percentage-based feedback to `increaseTuitionFees`, `promoteAllStudents`, and `bulkUpdateClassOrder`.
- **Enhanced Button Feedback**: Added loading spinners to all primary action buttons in modals.

### Fixed
- **UI Responsiveness**: Ensured batch operations yield to the UI thread for smoother progress updates.

## [3.4.5] - 2025-02-21
- **Restore Engine Overhaul**: Fixed an issue where restored records wouldn't show up due to School ID mismatches.
