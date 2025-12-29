
# Changelog

## [3.2.6] - 2025-02-21

### Fixed
- **Fee Collection Report**: Implemented strict date normalization. The report now correctly captures payments with timestamps (ISO strings) by truncating them to `YYYY-MM-DD` before comparison.
- **Data Migration Support**: Improved `paymentHistory` scanning to look for alternative keys (`date`, `paidDate`, `paidAt`), ensuring migrated records show up in reports.
- **Sub-Total Accuracy**: Fixed a bug where numeric values were occasionally treated as strings during aggregation, causing incorrect grand totals.

## [3.2.5] - 2025-02-21

### Fixed
- **Fee Collection Report**: Completely redesigned the reporting engine to track individual transactions from `paymentHistory`. This fixes the issue where payments were not showing up if they were partial or lacked a primary challan date.
- **Reporting Accuracy**: Improved daily aggregation to correctly sum multiple payments made on the same day across different students.
