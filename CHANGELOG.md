
# Changelog

## [3.8.0] - 2026-08-24

### Added
- **Challans per A4 Page Configuration**: Added flexible option selector for `1 per Page`, `2 per Page`, or `3 per Page` (defaulting to 3 per page) alongside `Copies per Challan` (2 or 3 copies) in both Bulk Fee Challans and Range Fee Challans print modals.
- **Dynamic Print Layout Scaling**: Configured `.challan-wrapper` CSS styles (`.per-page-1`, `.per-page-2`, `.per-page-3`) to scale vertical heights (~275mm, ~140mm, ~94mm), card inner padding, and QR code sizing dynamically.
- **Precise Page-Break Enforcement**: Added explicit page-break triggers (`pageBreakAfter: 'always'`) on every Nth challan wrapper to prevent page boundary spilling during PDF export or paper printing.

## [3.7.0] - 2026-08-24

### Fixed
- **Print Visibility Fix**: Resolved clipping of the bottom payment acknowledgment bar (`Pay Date:`, `Paid:`, `Bal.:`) in browser print and PDF export by refining vertical layout paddings and setting `overflow: visible` with flexible height bounds (`min-height: 94mm`) in print styles.
- **Challan ID Standardization**: Enforced the requested `yyyymm-stdid` format (e.g. `202601-1099`) across challan metadata headers, prior payment records, desk scan QR code payloads, and newly generated challan records.
- **High-Contrast Print Elements**: Enhanced border line-weights and text contrast for acknowledgment fields so printed sheets and saved PDFs render cleanly.

## [3.6.9] - 2026-08-24

### Added
- **Future Payment Date Prevention**: Added strict client-side date validation on fee payment forms (`FeePaymentModal` and `FeeCollectionPage`) to prevent entering future dates for 'Payment Date'.
- **HTML5 & Real-Time Form Controls**: Integrated `max={today}` on date pickers, real-time input change checks, and explicit form error alerts if a future date is chosen.
- **Data Layer Date Enforcer**: Added a backend date validation check in `DataContext` (`recordFeePayment` & `updateFeePayment`) to guarantee payment records never save with future dates.

## [3.6.8] - 2026-08-24

### Fixed
- **Chronological Prior Payment Lookup**: Refined the `LAST PAYMENT DETAIL` calculation to evaluate the student's entire historical fee ledger and extract the chronologically preceding paid or partially-paid transaction.
- **Multi-Month Carry-Over Support**: Correctly handles multi-month gaps (for example, if November was unpaid, a December challan automatically references October's payment details as the most recent transaction).
- **Strict Preceding Transaction Filter**: Guarantees that current-month records and future records are strictly excluded from the last payment box.

## [3.6.7] - 2026-08-24

### Fixed
- **Prior Payment Lookup in Fee Challans**: Resolved an issue where the `LAST PAYMENT DETAIL` box echoed the current month's payment. It now correctly searches for and displays the student's most recent prior paid or partially-paid challan before the current month.
- **Accurate Historical Context Across Months**: Dec 2025 challans now display Nov 2025 payment details, and Jan 2026 challans accurately display Dec 2025 paid challan details.
- **Self-Exclusion Rule**: Strictly excluded the current challan from its own `LAST PAYMENT DETAIL` calculation to guarantee historical reference accuracy.

## [3.6.6] - 2026-08-24

### Changed
- **Cashier Hand-Write Fill Lines**: Added pen fillable writing lines to `Pay Date:`, `Paid:`, and `Bal.:` in the bottom acknowledgment box when challans are printed at the start of the month.
- **Dynamic Payment Population**: When payments are entered into the system, the recorded payment date, paid amount, and remaining balance automatically print in place of the handwriting lines.
- **Explicit Discount Amount Labels**: Clarified `D. A.` / `D.A.` abbreviations to `Discount Amount (D.A.)` and `Discount (D.A.)` across breakdown tables.
- **Soft Slate Header Theme**: Replaced heavy dark slate header blocks with an ink-friendly soft slate banner style (`bg-slate-700` / `bg-slate-600`) and high-contrast section headers (`bg-slate-200 text-slate-900`) to improve print clarity and reduce ink consumption.

## [3.6.5] - 2026-08-24

### Added
- **Account Desk Quick Scan QR Code**: Embedded a QR code in the fee challan print view containing student ID, payment due date, total amount, and challan number for instant barcode/camera scanning at the account desk.
- **School Logo Support**: Embedded the school logo image (or fallback graduation crest icon) directly into the challan header.
- **Dark Theme Header Accent**: Applied a dark slate background styling to the top header band and copy badges (`School Copy` vs `Parent Copy`) for sharp contrast and professional print layout.
- **QR Decoder Support**: Updated `ChallanScannerPage` scanner engine to parse QR JSON payloads seamlessly.

## [3.6.4] - 2026-08-24

### Changed
- **2-Copy Challan Template**: Updated the 2-copy (Parent / School) fee challan printable layout to match the requested reference format (`challan.jpg`).
  - Added student metadata row (`Challan ID`, `Std.ID`, `Class`, `Std.Name`, `FatherNam`).
  - Added itemized fee breakdown table (`Monthly`, `Admission`, `Annual/Exam`, `Stationary`, `Other`) alongside `Current Fees`, `PreviousDues`, `Total Dues`, and `D. A.`.
  - Added structured `LAST PAYMENT DETAIL` table box on the right column (`Challan ID`, `Date`, `Amount`, `Paid`, `D.A.`, `Balance`).
  - Added bottom payment acknowledgment grid box (`Pay Date:`, `Paid:`, `Bal.:`).
- **Direct Challan Printing**: Added single-click "Print" button directly in `FeeCollectionPage` for instant challan rendering.


### Fixed
- **OAuth Origin Mismatch**: Re-synchronized platform OAuth configuration and improved diagnostic messages for Authorized JavaScript Origins in `GoogleDriveService`.

## [3.6.2] - 2026-08-24

### Added
- **Google Drive Backup OAuth**: Configured Google Workspace OAuth client credentials for secure Google Drive backups (`https://www.googleapis.com/auth/drive.file`).
- **Dynamic Client ID Resolution**: Updated `GoogleDriveService` to evaluate `VITE_GOOGLE_CLIENT_ID` at runtime with friendly missing key diagnostics.

## [3.6.1] - 2026-07-13

### Fixed
- **Registration & User Creation**: Dropped obsolete `profiles_id_fkey` constraint that linked to non-existent `auth.users` tables, resolving user registration and creation errors.
- **Missing Notification Schema**: Created the missing `notifications` table in Neon Postgres to eliminate fetching errors and restore notification capabilities.

## [3.6.0] - 2026-07-13

### Added
- **Local Dexie Database SQL Interpreter**: Fully integrated virtual SQL translation engine which runs queries on IndexedDB if the cloud connection or `VITE_NEON_DATABASE_URL` is unconfigured. This prevents system load-time failures.
- **Robust Demo Seeding**: Automatic seeding of high-quality sample data (schools, profiles, classes, exams, and financial challans) when running in offline sandbox mode.
- **Integrated Update Verification Engine**: Implemented automatic update checking against root `/version.json` with an eye-safe prompt to bust cache and fetch the latest version.

## [3.5.5] - 2025-02-21

### Fixed
- **Vercel Build**: Resolved `TS6133` errors by removing unused component declarations and imports in `SettingsPage` and `DataContext`.

## [3.5.4] - 2025-02-21

### Added
- **Smart Backup UI**: Redesigned the Google Drive backup interface inspired by WhatsApp's "Chat Backup."
- **Selective Backup**: Added an "Include Photos" toggle to exclude student/staff photos and school logos from backups, saving storage space and increasing sync speed.
- **Backup Statistics**: Real-time display of last backup date and file size.

## [3.5.3] - 2025-02-21

### Fixed
- **Image Backups**: Unified the restoration engine to ensure School Logos and Student Avatars (base64 strings) are preserved during system reconstruction.
- **Data Integrity**: Standardized table processing to dynamically map all columns from JSON backups to the Neon Postgres schema.
