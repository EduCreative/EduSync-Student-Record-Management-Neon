
# Changelog

## [3.2.5] - 2025-02-21

### Fixed
- **Fee Collection Report**: Completely redesigned the reporting engine to track individual transactions from `paymentHistory`. This fixes the issue where payments were not showing up if they were partial or lacked a primary challan date.
- **Reporting Accuracy**: Improved daily aggregation to correctly sum multiple payments made on the same day across different students.

## [3.2.4] - 2025-02-21

### Fixed
- **Numeric Integrity**: Implemented automatic casting for Postgres `NUMERIC` types to prevent string concatenation in financial calculations.
- **Defaulter Report**: Fixed "Cumulative (All Time)" calculation errors where amounts were being concatenated as strings.
- **Fee Collection Report**: Resolved issue where payment records were not appearing due to type mismatches.
- **Responsive Layout**: Improved table responsiveness for print previews and mobile views.
