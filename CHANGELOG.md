
# Changelog

## [3.2.7] - 2025-02-21

### Fixed
- **Fee Collection Report Visibility**: Fixed a critical issue where transferred data with missing or non-standard `paid_date` values were hidden. The report now intelligently falls back to the due date for untracked payments.
- **JSONB Parsing**: Added robust parsing for `payment_history` to ensure records appear even if stored as stringified JSON in the database.
- **Advanced Date Handling**: Improved `normalizeDate` to support `DD/MM/YYYY` and other regional formats often found in imported data.

## [3.2.6] - 2025-02-21

### Fixed
- **Fee Collection Report**: Implemented strict date normalization. The report now correctly captures payments with timestamps (ISO strings) by truncating them to `YYYY-MM-DD` before comparison.
- **Data Migration Support**: Improved `paymentHistory` scanning to look for alternative keys (`date`, `paidDate`, `paidAt`), ensuring migrated records show up in reports.
