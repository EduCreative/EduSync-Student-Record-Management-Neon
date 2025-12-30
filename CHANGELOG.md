
# Changelog

## [3.2.9] - 2025-02-21

### Improved
- **Incremental Data Synchronization**: Refactored the data fetching engine to load data in weighted batches. Critical records (Classes, Schools) now appear immediately, while larger historical data (Fees, Attendance) syncs in the background.
- **Sync Progress Tracking**: Added a visual progress bar in the header and real-time status updates with percentages to provide better feedback during the initial synchronization process.
- **Non-Blocking Dashboard**: Users can now access the dashboard and reports as soon as the core data is ready, significantly reducing perceived wait times after login.

## [3.2.8] - 2025-02-21

### Improved
- **Fee Defaulter Report (Monthly Mode)**: Updated logic to show total outstanding dues as of the selected month (Arrears + Month Fees) rather than just the month's isolated portion. This provides a true "statement of account" for that month.
- **Enhanced Column Selection**: Added "Arrears" and "Month Fees" as separate toggleable columns in the Defaulter Report for better financial transparency.
