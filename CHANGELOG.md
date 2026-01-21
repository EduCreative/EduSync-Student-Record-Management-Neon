
# Changelog

## [3.4.8] - 2025-02-21

### Fixed
- **Unique Constraint Violations**: Resolved the "duplicate key value violates unique constraint" error during restore by implementing a robust SQL Upsert (Insert or Update) engine.
- **Data Visibility**: Fixed an issue where restored records wouldn't show up in the UI by strictly remapping all incoming data to the current active school's ID.
- **Relational Integrity**: Re-ordered the restoration sequence to ensure parent records (Classes/Fee Heads) exist before child records (Students/Challans).

## [3.4.7] - 2025-02-21
- **Restore Engine**: Initial implementation of conflict resolution logic.
