
# Changelog

## [3.52.0] - 2026-11-12

### Report Format, Logo Sizing, Print Preview & Filename Convention Updates
- **Compact Corner School Logo**:
  - Adjusted logo dimensions in `PrintableReportLayout.tsx` and `PrintableReportCard.tsx` from `h-16 w-16` to a compact, neat `h-10 w-10` corner alignment next to the school name and address.
- **High-Contrast Print Preview Font Colors**:
  - Enforced high-contrast dark text (`text-secondary-900`) and pristine white background on the print preview container and blob iframe body, eliminating invisible/light gray text issues.
- **Print Preview & Print/Save Format Consistency**:
  - Injected explicit `@media print`, `-webkit-print-color-adjust: exact`, `print-color-adjust: exact`, and table pagination print rules into the print HTML generator in `PrintPreview.tsx` so that Print/Save output formatting matches Print Preview 100%.
- **Standardized PDF & CSV Filename Naming Convention**:
  - Updated all reports (`FeeCollectionReportModal.tsx`, `DefaulterReportModal.tsx`, `AttendanceReportModal.tsx`, `ClassListReportModal.tsx`, `DiscountReportModal.tsx`, `MissingDataReportModal.tsx`, `BulkChallanReportModal.tsx`, `ReportCardModal.tsx`) to follow the requested naming convention: `EduSync-[Report Name]-[Class(s)]-[dates/month].pdf` (and corresponding `.csv` filenames).

## [3.51.0] - 2026-11-12

### Fine-Grained Permissions for Database Backup & Recovery
- **Database Backup & Recovery Permission (`CAN_MANAGE_BACKUPS`)**:
  - Added `CAN_MANAGE_BACKUPS` permission to the fine-grained permissions system in `src/permissions.ts`.
  - Configured Admin role to have Database Backup & Recovery enabled by default.
  - Added "System & Security" group in `UserFormModal.tsx` allowing Owners and Admins to toggle Database Backup & Recovery permission for Accountants and other staff members so they can make local backups for safety when the Owner is busy.
  - Updated `SettingsPage.tsx` to authorize users holding `CAN_MANAGE_BACKUPS` permission (or Owner) to view and execute Database Backup & Recovery operations.

## [3.50.0] - 2026-11-12

### Assigned Branch Persistence & User Registration Approval Workflow
- **Assigned Branch Persistence Fix**:
  - Resolved issue in `src/context/DataContext.tsx` (`updateUser` and `addUserByAdmin`) where `branchId`, `role`, `disabledNavLinks`, and `permissionsOverrides` were stripped from write payloads.
  - Updated server write handler `src/server/handlers/write/users.ts` (`update-user` and `add-user`) to validate and persist `branch_id`, `role`, `school_id`, `disabled_nav_links`, and `permissions_overrides`.
  - Fixed SQL branch validation to support users initially created without a school ID by resolving against `targetUser.school_id || session.schoolId`.
- **Self-Registration "Pending Approval" & In-App Notification Flow**:
  - Updated `src/server/handlers/auth/register.ts` to associate registered users with the school and insert accounts with `'Pending Approval'` status.
  - Added automated in-app notifications sent to all active Administrators and Owners whenever a new user self-registers, complete with a direct link to `/users`.
  - Added automated audit logging to `activity_logs` for new user self-registrations.
  - Added 1-click "Approve" button in `UserManagementPage.tsx` for pending users, with instant state sync, toast feedback, and approval notification delivered to the user.
  - Fixed user filtering in `UserManagementPage.tsx` and `AdminDashboard.tsx` to include users pending school/branch assignment.

## [3.49.0] - 2026-11-12

### Branch-Locked Staff (P29b & P29c: Server Enforcement & Client Scope)
- **Server-Side Authorization & Data Isolation (P29b)**:
  - Enforced `isBranchLocked(session)` across all read and write endpoints (`data/index.ts`, `data/students.ts`, `data/fees.ts`, `data/users.ts`, `photo.ts`, `notifications/index.ts`, `write/students.ts`, `write/classes.ts`, `write/challans.ts`, `write/payments.ts`, `write/academic.ts`, `write/users.ts`).
  - Locked staff are strictly restricted to data within their assigned branch, returning HTTP `403` (`"Outside your branch"`) on any unauthorized out-of-branch attempt.
  - Refused restricted institutional configuration actions (`branches`, `subjects`, `exams`, `fee_heads`, `school_events`, `update-school`) with HTTP 403 for locked staff.
- **Client Scope & Branch Switcher Integration (P29c)**:
  - Updated `useBranchFilter` hook (`src/hooks/useBranchFilter.ts`) to lock `selectedBranchId` to `user.branchId` when staff members are branch-locked (`user.role !== Owner && user.branchId`), disabling manual branch selection and ensuring client views match server isolation.
  - Updated `UserFormModal.tsx` and `UserManagementPage.tsx` with branch assignment controls, allowing Owners and unlocked Admins to assign staff members to specific branches or set them unlocked ("All Branches"), while displaying branch badges in the user directory.

## [3.48.0] - 2026-11-12

### Branch-Locked Staff (P29a: Database & Session)
- **Database Schema (`schema.sql` & Migration 003)**:
  - Added `branch_id UUID REFERENCES branches(id) ON DELETE RESTRICT` foreign key column and index to the `profiles` table.
  - Reordered table creation (`branches` created before `profiles`) to ensure pristine initialization order.
  - Created idempotent migration `migrations/003_user_branch.sql` and documented it in `migrations/README.md`.
- **Server Session & Token Helpers (`_db.ts` & `write/_helpers.ts`)**:
  - Added `branchId: string | null` to `TokenPayload`.
  - Updated `getSessionUser` to re-query `branch_id` fresh from the database on every request (forcing Owner role to always return `branchId: null`).
  - Implemented core server-side verification helpers: `isBranchLocked`, `branchOfClass`, `canAccessClass`, `canAccessStudent`, and `canAccessChallan`.
- **API Endpoints & Types (`auth/me.ts`, `login.ts`, `types.ts`)**:
  - Included `branchId` in session verification (`me.ts`), authentication login response (`login.ts`), and TypeScript definitions (`User`).

## [3.47.0] - 2026-11-12

### Google Drive Cloud Backup & Automated Scheduler
- **Google Drive OAuth & Permissions (`googleDriveService.ts`)**:
  - Integrated Firebase Auth popup sign-in requesting Google Drive file scope (`https://www.googleapis.com/auth/drive.file`).
  - Implemented multipart backup payload upload (`https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`) directly to Owner or Admin Google Drive account.
- **Automated Scheduler & Settings UI (`GoogleDriveBackupCard.tsx`)**:
  - Added schedule options (Disabled, Daily, Weekly, Monthly) persisting preferences in `localStorage` (`edusync_gdrive_frequency`).
  - Implemented automated background check on app mount that triggers cloud backup upload when interval elapses.
  - Added manual "Backup Now to Google Drive" button, connection status indicators, and last upload timestamp tracking.
- **Context & Data Pipeline Integration**:
  - Extracted `generateFullBackupPayload()` in `DataContext.tsx` shared between local JSON downloads and Google Drive cloud backups.

## [3.46.0] - 2026-11-11

### Branch Picker (View Filter Only) for School-Wide Staff (P29d)
- **Shared Reactive Hook (`useBranchFilter`)**:
  - Implemented `src/hooks/useBranchFilter.ts` providing `selectedBranchId`, `setSelectedBranchId`, `selectedBranchName`, `hasMultipleBranches`, `hasUnassignedClasses`, `branches`, and optimized lookups with memoized helpers (`filterClasses`, `filterStudents`, `filterFees`, `filterAttendance`, `filterResults`).
  - Automatically derives branch relationships through `student.classId -> class.branchId`. Classes with no branch are classified as `Unassigned`.
  - Persists preference per-browser in `localStorage` (`edusync_selected_branch`) with safety fallback to `'all'` if the branch is deleted or when switching active school (Owner role). Synchronizes across components in real-time.
- **Universal BranchPicker Component (`BranchPicker.tsx`)**:
  - Small, modern responsive selector supporting light and dark modes with sorted branch names and conditional 'Unassigned' option.
  - Automatically hides when the school has $\le 1$ branch (`hasMultipleBranches === false`).
- **Comprehensive Integration Across Dashboards & Modules**:
  - **Dashboards**: Integrated in `AdminDashboard.tsx` (serves Owner & Admin) and `AccountantDashboard.tsx`, ensuring all statistics cards, collection charts, recoveries, and lists adjust in unison.
  - **Management Pages**: Integrated into `StudentManagementPage.tsx`, `FeeCollectionPage.tsx`, and `AttendancePage.tsx` (teachers retain their class-specific view and do not see the picker). Replaced legacy local branch state in `ClassManagementPage.tsx`.
  - **Global Header**: Added compact responsive `BranchPicker` in `Header.tsx` for quick switching from anywhere.
  - **Reports & Document Exports**: Updated `ReportsPage.tsx` and all 6 core report modals (`FeeCollectionReportModal`, `DefaulterReportModal`, `DiscountReportModal`, `AttendanceReportModal`, `ClassListReportModal`, `MissingDataReportModal`).
  - Printed reports and exported CSV files display the active branch in headers and metadata.
- **Zero Calculation or Permission Regressions**:
  - Operates purely as a client-side view filter; backend APIs, database schemas, and permissions remain untouched.
  - Calculations with `'all'` or in single-branch schools match previous numbers exactly.

## [3.45.0] - 2026-11-10

### Branded Startup Splash Screen
- **Instant Perceived Performance**:
  - Added an inline static branded splash screen directly inside `index.html` root so the EduSync academic logo, title, and theme colors render immediately upon page request before JavaScript bundle download/execution.
  - Implemented seamless React hydration state handling in `AuthLoadingFallback` and `AppContent` via `useAuth().loading` to maintain the branded transition during session verification.

## [3.44.0] - 2026-11-10

### High-Resolution PWA Brand Icons & Mobile Polish
- **Branded Application Icons**:
  - Replaced placeholder solid blue squares with custom, high-resolution EduSync brand iconography featuring the golden academic book and glowing cyan neon graduation cap on a deep royal blue background.
- **Cross-Platform Device Support**:
  - Generated full asset suite across all standard resolutions:
    - `public/icons/icon-512.png` (512x512) and `public/icons/icon-192.png` (192x192) for desktop launchers, splash screens, and Android app drawers (`purpose: "any"`).
    - `public/icons/icon-maskable-512.png` and `public/icons/icon-maskable-192.png` with safe-zone margins for Android adaptive rounded/squircle icons (`purpose: "maskable"`).
    - `public/apple-touch-icon.png` (180x180) for iOS Safari home screen installation.
    - Multi-resolution favicons (`favicon-32x32.png`, `favicon-16x16.png`, and `favicon.png`).
- **Web App Manifest & Service Worker Cache Refresh**:
  - Upgraded `manifest.webmanifest` with separate `any` and `maskable` icon specifications, app `id`, `scope`, and descriptive metadata.
  - Added all icon assets and the manifest to `public/sw.js` precache list and bumped version to trigger automatic cache renewal on existing installed devices.

## [3.43.0] - 2026-11-10

### Password Security & User Management Fixes
- **Self-Service Password Change Restored (Bug A Fix)**:
  - Added the required `Current Password` input field to `src/components/users/UserProfilePage.tsx` and wired it into `updateUserPassword(password.new, password.current)`. Users can now successfully update their own passwords without encountering 400 validation failures.
- **Password Minimum Length Enforcement (Bug B Fix)**:
  - Aligned client-side form validation across `UserFormModal.tsx` and `UserProfilePage.tsx` to strictly require at least 8 characters, matching server-side validation rules.
- **Admin Direct Password Reset (Bug C Fix)**:
  - Replaced the placeholder toast in `src/components/users/UserFormModal.tsx` with a fully functional direct password reset panel for Owners and Admins.
  - Allows generating random secure passwords or entering custom temporary passwords, submits directly to `/api/auth/change-password`, and provides a one-click copy button for quick verbal/written sharing.
- **Operational & Code Quality Polish**:
  - Made CLI script SSL validation flexible in `scripts/backup.ts` and `scripts/restore.ts` via `DB_SSL_REJECT_UNAUTHORIZED` / `NODE_TLS_REJECT_UNAUTHORIZED`.
  - Replaced string cast with typesafe `Permission.CAN_SEND_ANNOUNCEMENTS` enum in `AnnouncementsPage.tsx`.
  - Fixed invalid Tailwind color class in `FeeCollectionPage.tsx`.

### Student Fee Structure Persistence (P0 Blocker Fix)
- **Server-Side Fee Structure Route**:
  - Implemented authorized `action === 'update-fee-structure'` in `src/server/handlers/write/students.ts` for Owner, Admin, and Accountant roles.
  - Persists customized student fee heads (`fee_structure JSONB`) with audit logging, resolving the issue where custom fee structures were silently dropped after F4.5 removed `fee_structure` from generic student profile updates.
- **Client & Context Wiring**:
  - Exposed `updateFeeStructure(studentId, feeStructure)` in `DataContext.tsx`.
  - Wired `StudentFeeStructure.tsx` save handler to invoke `updateFeeStructure`, updating the database and state immediately.

### Postgres Driver & Large School Scaling (F6)
- **Node-Postgres Connection (`pg`)**:
  - Upgraded CLI `scripts/backup.ts` and `scripts/restore.ts` from Neon HTTP driver to `pg` (`node-postgres`) using standard connection strings and TLS (`ssl: { rejectUnauthorized: true }`).
- **Batched Transactional Multi-Row Inserts**:
  - In `scripts/restore.ts`, batched rows into multi-row parameterized `INSERT INTO ... VALUES (...), (...)` statements of up to 200 rows per query executed inside a single `BEGIN ... COMMIT` transaction.
  - Guarantees instant rollback on any constraint violation and bypasses Neon serverless single-query HTTP payload limits (enabling smooth restores for 1,500+ student campuses with 89+ MB datasets).
  - Maintained complete foreign-key topological sorting, safety checks against non-empty databases (`--wipe` with typed confirmation), and per-table count verification.

### Security, Audit & Script Fixes (F7)
- **School Logo MIME & Base64 Validation**:
  - Enforced `validateAvatarDataUrl` on `logoUrl` during institution profile updates (`update-school` action in `src/server/handlers/write/users.ts`), rejecting invalid data URLs or non-image types with HTTP 400.
- **Load-Test Script Constraint Fix**:
  - Added NOT NULL column `class_id` (`classIds[0]`) to examination results `INSERT INTO results` in `scripts/load-test.ts`, allowing large-scale test seed generation to complete cleanly.
- **Unified Backup Table Whitelist**:
  - Added `'notifications'` to `ALLOWED_TABLES` in `/api/backup`, `src/context/DataContext.tsx`, and `RestoreModal.tsx` so in-app backup and browser restore cover all tables identical to CLI tools.

### Mobile Usability Polish
- **Attendance Sticky Save Bar**:
  - Implemented responsive sticky bottom bar in `src/components/attendance/AttendancePage.tsx` with light/dark backdrop blur and elevated shadow, keeping the save button readily accessible without scrolling on mobile devices.

## [3.42.0] - 2026-11-09

### Browser-Based Disaster Recovery (One-Click Restore)
- **Pre-Flight Integrity Verification**:
  - Implemented client-side JSON archive parsing and structural verification, ensuring table presence and row-count consistency before uploading.
- **Visual Data Audit Card**:
  - Displays backup creation timestamp, software version, target institution name, campus address, branch counts, student breakdowns (active, graduated, left), date ranges for fee challans and attendance logs, and verified row count totals.
- **Two-Tier Owner Security Guard**:
  - Requires the Institutional Owner to enter their account password (verified via bcrypt on the backend) and type `RESTORE` to authorize execution.
- **Staged Streaming Protocol**:
  - Bypasses Vercel's 4.5 MB serverless request ceiling by streaming records table-by-table in chunked batches into isolated staging tables (`staging_*`).
  - Guarantees zero live database corruption: active records remain 100% untouched until all chunks are uploaded and verified.
- **Atomic Swap & Receipt**:
  - Executes single-transaction table truncation and topological population from staging, clearing staging tables and issuing a 100% verified completion receipt.
- **Settings UI Integration**:
  - Added "Restore From Backup" button in **Settings > Database Backup & Recovery** for Owner accounts with complete light/dark mode and responsive layout support.


### Final Audit Security & Driver Fixes (F1 - F7)
- **F1 (Database Backup & Restore Driver Corrections)**:
  - Fixed Neon driver SQL identifier parameterization in `scripts/backup.ts`, `scripts/restore.ts`, and `src/server/handlers/data/backup.ts`.
  - Replaced broken `${sql(tableName)}` parameterization with compile-safe allowlist dispatch in the serverless `/api/backup` route and double-quoted identifiers with parameterized values in CLI scripts.
- **F2 (Avatar Stored XSS Mitigation & MIME / Size Guards)**:
  - Enforced server-side image MIME type validation (`image/jpeg`, `image/png`, `image/webp`) and a 500 KB payload ceiling in `src/server/handlers/write/students.ts` and `src/server/handlers/write/users.ts`.
  - In `src/server/handlers/photo.ts`, validated decoded MIME against the allowlist, rejected non-image types with HTTP 415, and attached `X-Content-Type-Options: nosniff` and `Content-Security-Policy: default-src 'none'`.
- **F3 (Migration Runner Comment Parsing)**:
  - In `scripts/migrate.ts`, stripped SQL comments cleanly before splitting statements so statements with leading comments are preserved and executed without dropping tables.
- **F4 (Login Information Leak Mitigation & Password Length Standards)**:
  - In `src/server/handlers/auth/login.ts`, reordered authentication to verify bcrypt password hashes before evaluating account status (`Pending Approval`, `Suspended`), eliminating user status enumeration.
  - Elevated minimum password length requirement from 6 to 8 characters across `register.ts`, `change-password.ts`, `write/users.ts`, `RegisterPage.tsx`, and `ResetPasswordPage.tsx`.
- **F6 (Payment History Data Loss Protection)**:
  - In `src/server/handlers/write/payments.ts` (`update-payment` action), added server-side guards preventing payment history from being submitted empty when a non-zero amount is recorded or reducing an already-paid challan to zero by clearing history.
- **F7 (Real Notifications for Fee Deadline Reminders)**:
  - Connected `FeeRemindersPage.tsx` to the real `/api/notifications` broadcast system via `sendAnnouncement`, linking parent and student accounts to fee reminders with direct `/fees` route navigation.
- **O6 (Auth Storage Security Hygiene)**:
  - Removed redundant `localStorage.setItem('edusync_user')` and `localStorage.removeItem('edusync_user')` calls in `AuthContext.tsx`.
- **F5a & F5b (Repository Cleanup & Lockfile Hygiene)**:
  - Deleted leftover temporary pasted prompt assets from `public/assets/aistudio/` and added the pattern to `.gitignore`.
  - Removed root `bun.lock` file to maintain a clean npm-only build environment.


### Phase H: Polish, Documentation & Versioning
- **P25 (Direct Report Card Modal Launch from Student Profiles)**:
  - Enhanced `ReportCardModal.tsx` with optional `initialStudentId` and `initialStudentClassId` props.
  - When invoked from a student profile, automatically pre-selects the student's class, pre-selects the latest examination term (sorting exam names and selecting the last), hides the Class selection dropdown while keeping the Exam dropdown interactive, and targets only that student's report card.
  - Preserved existing full-class report card batch generation from `ReportsPage.tsx`.
  - In `StudentProfilePage.tsx`, updated the "View Report Card" button to directly launch `ReportCardModal` with pre-filled student and class identifiers.
- **P26 (Reactivate Student Workflow for 'Left' Status)**:
  - In `StudentProfilePage.tsx`, added a "Reactivate Student" button (`btn-secondary`) visible only when `student.status === 'Left'`.
  - On click, prompts a confirmation modal: *"Reactivate this student to Active status? Attendance and fee history are not affected."*
  - Upon confirmation, invokes `updateStudent({ ...student, status: 'Active' })` and triggers a success toast notification, seamlessly restoring the student to active rosters with all historical fee ledgers and attendance records fully preserved.
- **P27 (Four Small Fixes)**:
  - In `StudentManagementPage.tsx`, converted `hasRollbackSnapshot` from a stale `useMemo` to a reactive computed boolean `Boolean(localStorage.getItem('edusync_last_promotion_snapshot'))`. Added `snapshotVersion` state bumped after every await of `reactivateGraduatedStudents` and `revertLastPromotion`, passing it as the `key` to `GraduatedStudentsModal` to force clean component re-renders.
  - In `Header.tsx`, updated `SyncStatus` with a `forceTick` state and a 30,000 ms `setInterval` effect to prevent the relative "Synced: Xs ago" timestamp indicator from freezing.
  - In `AttendancePage.tsx`, updated `handleSaveAttendance` error handling to automatically rebuild the attendance map from current state for `selectedDate` and reset the record buttons if a save fails, updating the error toast to *"Could not save attendance. Changes have been reverted."*
- **P28 (Documentation Refresh & Cleanup)**:
  - Completely rewrote `README.md` as an accurate, concise guide under 120 lines covering single-school architecture with branches, tech stack, environment variables (`DATABASE_URL`, `SESSION_SECRET`), CLI commands (`dev`, `build`, `setup`, `migrate`, `backup`, `restore`, `load-test`), and directory structure, eliminating legacy multi-school and Google Drive sections.
  - Rewrote `UserManual.md` to document single-school operations, branch setups, user roles, the in-app "Download Full Backup" tool, and mobile PWA functionality.

## [3.39.0] - 2026-11-07

### Phase G: Mobile PWA & Responsiveness
- **P22 (Installable PWA Manifest, Service Worker & Offline Banner)**:
  - Created Web App Manifest `public/manifest.webmanifest` (`name: "EduSync"`, `short_name: "EduSync"`, `start_url: "/"`, `display: "standalone"`, `theme_color: "#1e40af"`, `background_color: "#ffffff"`, and 192x192 & 512x512 icons with both `any` and `maskable` purposes).
  - Linked manifest in `index.html` along with `apple-touch-icon`, `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`, and `apple-mobile-web-app-title`.
  - Implemented custom vanilla service worker `public/sw.js`:
    - Caches only the core app shell; determines cache name dynamically as `'edusync-' + version` from `/version.json` (fetched with `cache: 'no-store'`; falls back to `'edusync-unknown'`).
    - Cache-first strategy for `/assets/*`.
    - Network-first strategy for navigation with `/index.html` offline fallback.
    - Strictly never intercepts or caches `/api/*`, `/version.json`, or `/sw.js`.
    - Uses `skipWaiting()` and `clients.claim()` and removes older cache revisions on activate.
  - Registered service worker in `src/main.tsx` exclusively in production mode (`import.meta.env.PROD`).
  - Integrated with `src/components/common/UpdateChecker.tsx`: triggers `registration.update()` when a new version is detected and prompts user to reload.
  - Updated `vercel.json` with headers for `/sw.js` (`Cache-Control: no-cache`), correct `application/manifest+json` content type for `/manifest.webmanifest`, and excluded `/sw.js`, `/manifest.webmanifest`, `/icons/*`, and `/version.json` from the SPA rewrite rule.
  - Added a visible offline banner in `src/components/layout/Layout.tsx` using existing `isOnline` from `SyncContext`: *"You are offline. Records cannot be saved until the connection returns."*
- **P23 (Code Splitting & Notification Polling Throttle)**:
  - Code-split application pages in `src/App.tsx` and `src/components/layout/Layout.tsx` using `React.lazy` and wrapped with `<Suspense>` small loading spinner fallbacks, while preserving static imports for `LoginPage`, `Layout`, and `Dashboard`.
  - Configured `build.rollupOptions.output.manualChunks` in `vite.config.ts` to separate `'react-vendor'` (`react`, `react-dom`), `'lucide'` (`lucide-react`), `'qrcode'` (`qrcode.react`), and `'charts'` (`src/components/charts/`) into distinct bundles without adding new dependencies.
  - In `src/context/NotificationContext.tsx`, throttled notification polling interval from 60 seconds to 5 minutes (300,000 ms), added visibility check to skip polling while `document.visibilityState === 'hidden'`, and attached `visibilitychange` listener to refresh notifications immediately when the tab becomes active.
- **P24 (Mobile Cards for Fee Collection)**:
  - In `src/components/fees/FeeCollectionPage.tsx`, wrapped the 9-column desktop table in `<div className="overflow-x-auto hidden md:block">`.
  - Added `<div className="block md:hidden p-2 space-y-2">` mobile card view mapped from the same `paginatedChallans` array.
  - Formatted mobile cards with top row (student avatar, name, roll number, status badge), second row (class name, formatted challan month, due date), third row (Outstanding balance and Current Dues in distinct stat boxes), and action row maintaining exact same actions and role permissions (Record Payment, Edit Payment, Cancel, Print, View Fee History).

## [3.38.0] - 2026-11-07

### Phase F: Data Size Optimization & Reliable Backups
- **P17 (Express Gzip Compression & Payload Monitoring)**:
  - Installed `compression` middleware in `server.ts` and `src/server/index.ts` mounted as the primary middleware, enabling transparent gzip compression for all JSON responses.
  - In `src/server/handlers/data/index.ts`, omitted unused `school_id` column from attendance queries to reduce redundant payload bytes.
  - Implemented `X-Payload-Bytes` HTTP response header on `GET /api/data` calculating uncompressed byte length, with automated `console.warn` logging whenever the uncompressed payload exceeds 3 MB.
- **P18 (Dedicated /api/photo Endpoint & Avatar Decoupling)**:
  - Created `src/server/handlers/photo.ts` and registered route `/api/photo` in `apiRouter.ts`.
  - Implemented role-based access scoping for photos: staff access restricted to their own school's members; parents access only their children; students access only their own photos.
  - Decodes stored data URL/base64 avatars to raw byte buffers, responds with exact MIME content type, `Cache-Control: private, max-age=86400`, and ETag caching with 304 Not Modified support.
  - In `data/index.ts`, `data/students.ts`, and `data/users.ts`, removed base64 `avatar_url` from SELECT queries; selected boolean `has_avatar` and `avatar_len`, generating lightweight `/api/photo?kind=...&id=...&v=...` URLs to shrink the initial `/api/data` payload by over 95%.
  - In `src/server/handlers/write/students.ts` and `src/server/handlers/write/users.ts`, protected avatar persistence: incoming values beginning with `/api/photo` are preserved unchanged, `data:` replaces the avatar, and empty/null removes it.
  - Updated `Avatar.tsx` with `loading="lazy"` attribute and graceful fallback to initials on image error.
- **P19 (Benchmark Load Test Script)**:
  - Created `scripts/load-test.ts` runnable via `npm run load-test`.
  - Implemented strict safety guard requiring `LOAD_TEST_OK=yes` and an empty `profiles` table to prevent execution against real data.
  - Synthetically seeds 1 school, 1 Owner, 3 branches, 30 classes, 1,500 students with ~35 KB fake base64 avatars, fee heads, 18,000 fee challans (12 months per student with realistic payment histories), 90,000 attendance records (60 days), and 2,400 exam results via batched atomic transactions.
  - Executes authenticated benchmark against `BASE_URL/api/data`, measuring response duration, raw JSON size, gzip compressed size, compression ratio, and detailed per-key payload size breakdown. Exits non-zero if raw size exceeds 4,000,000 bytes.
- **P20 (Full CLI Backup & Restore with Topological Sort)**:
  - Created `scripts/backup.ts` (`npm run backup`): dynamically introspects all tables from `information_schema` (excluding `login_attempts` and `schema_migrations`), dumping all rows into timestamped `backups/edusync-YYYYMMDD-HHmmss.json` with keyset pagination (500 rows per batch) to prevent memory spikes on large tables. Added `backups/` to `.gitignore`.
  - Created `scripts/restore.ts` (`npm run restore -- <file>`): dynamically reads foreign key constraints from `information_schema`/`pg_catalog` and computes topological dependency insertion order (detecting cycles). Enforces safety refusal if target tables are non-empty unless `--wipe` is passed with typed `"RESTORE"` confirmation. Inserts all rows inside ONE atomic `sql.transaction` and verifies per-table row counts.
  - Updated `src/server/handlers/write/restore.ts` to instruct users to run CLI restore: `Restore is done from the command line: npm run restore -- <file>`.
  - Registered `"backup"` and `"restore"` scripts in `package.json`.
- **P21 (In-App "Download Full Backup" & Google Drive Code Cleanup)**:
  - Created `/api/backup` endpoint (`src/server/handlers/data/backup.ts`) restricted to Owner with table whitelist and keyset pagination up to 3 MB per chunk.
  - Implemented `downloadFullBackup()` in `DataContext.tsx` that streams table records chunk by chunk via `/api/backup` without relying on in-memory state, tracks progress through `operationProgress`, packages standard backup JSON format, and triggers browser file download.
  - Updated `SettingsPage.tsx` to replace Google Drive card with "Database Backup & Recovery" card featuring "Download Full Backup" button, `localStorage` timestamp tracking, and CLI restore instructions.
  - Deleted obsolete `src/utils/googleDriveService.ts` and removed `VITE_GOOGLE_CLIENT_ID` from `.env.example` and `src/vite-env.d.ts`.

## [3.37.0] - 2026-11-06

### Phase E: Single-School Architecture & Branches
- **P14 (First-Run Interactive Setup Script)**:
  - Created interactive CLI script `scripts/setup.ts` runnable via `npm run setup`.
  - Verifies database connection and checks if table `profiles` exists; if missing, outputs Neon SQL instructions and exits with code 2.
  - Refuses execution if `profiles` table already contains records unless `--force` flag is provided.
  - Interactively requests School Name, School Address, Owner Name, Owner Email, and Owner Password (hidden with confirmation, minimum 10 characters).
  - Hashes owner password using `bcryptjs` with cost factor 12 and inserts initial school institution and Owner account with 'Active' status.
  - Automatically seeds default fee head "Tuition Fee" with amount Rs. 0 and prompts for optional additional fee heads.
  - Ensures `schema_migrations` table exists and records all existing migration scripts from `migrations/*.sql` as already applied.
  - Prints clear completion summary with credentials masked. Registered script `"setup": "tsx scripts/setup.ts"` in `package.json`.
- **P15 (Single-School Interface Mode & Owner Elevation)**:
  - In `AuthContext.tsx`, ensured `effectiveRole` is always `user.role`, eliminating legacy role downgrades of Owner to Admin.
  - Automatically resolves and populates `activeSchoolId` to `user.schoolId` for all users including Owner during session hydration and login.
  - Removed `switchSchoolContext` method and cleaned up all callers across the codebase.
  - Removed "Schools" nav item from `NAV_LINKS[UserRole.Owner]`, equipping Owner with the complete suite of institutional management links (Dashboard, Class Management, Students, Fee Management, Scan & Pay, Attendance, Results, Reports, Announcements, User Accounts, User Logs, Settings).
  - Streamlined `Header.tsx` to display single institution branding (logo, legal name, NEON badge) for all users, completely removing the school switcher dropdown.
  - In `Dashboard.tsx`, configured Owner to seamlessly open the primary `AdminDashboard` view.
  - In `Layout.tsx`, updated view routing permissions so Owner maintains full access across all Admin and academic views.
  - In `src/server/handlers/write/users.ts`, blocked `add-school` and `delete-school` with HTTP 403 "Single-school installation", while keeping `update-school` accessible to Owner and Admin.
  - In `SettingsPage.tsx`, gated Google Drive Backup and Data Snapshots to `user.role === 'Owner'`, while keeping the Institution Profile editor accessible to both Owner and Admin.
- **P16 (Branches Table, Class Branch Assignment, and Branch Filters)**:
  - Created `branches` table in `schema.sql` (prior to `classes`) with unique constraint on `(school_id, name)`.
  - Added `branch_id UUID REFERENCES branches(id) ON DELETE SET NULL` column to `classes` table in `schema.sql` and created `migrations/002_branches.sql`.
  - Added `Branch` interface and optional `branchId` to `Class` in `src/types.ts`.
  - In `src/server/handlers/data/index.ts`, fetched `branches` and selected `branch_id` on classes, returning `branches: transformedBranches` in API responses.
  - In `src/server/handlers/write/classes.ts`, added `add-branch`, `update-branch`, and `delete-branch` actions with 409 conflict checks preventing branch deletion while classes remain assigned.
  - Handled `branchId` persistence in `add-class` and `update-class` handlers.
  - In `DataContext.tsx`, added `branches` state, `addBranch`, `updateBranch`, `deleteBranch` methods, and included branches in JSON backups.
  - In `SettingsPage.tsx`, added a dedicated "Campus Branches" management card allowing Owner and Admin to view assigned class counts, create, edit, and delete branches.
  - In `ClassFormModal.tsx`, added branch selector dropdown shown when branches exist.
  - In `ClassManagementPage.tsx`, added branch filter dropdown and a Branch badge column in the classes table when branches are configured.
  - In `StudentManagementPage.tsx`, added branch filter dropdown when branches are configured, scoping students whose class belongs to the chosen branch.

## [3.36.0] - 2026-11-06

### Phase D: Real Dashboard Metrics
- **P11 (ParentDashboard Live Metrics)**:
  - Replaced hardcoded "95%" attendance with real 30-day attendance percentage (`Present / total`) calculated from records within `[getKarachiDateOffset(-30), getTodayKarachi()]`. Automatically invokes `loadAttendanceRange` if needed.
  - Replaced literal "Class Name" with dynamically resolved `${class.name}${class.section ? ' - ' + class.section : ''}`.
  - Replaced hardcoded "Paid" with real balance status from `getLedgerForStudent(child.id)`: displays "Paid" (green) if `balance <= 0.01` or `Rs. X due` (red).
  - Replaced hardcoded "A" grade with real grade calculated across the latest exam results using the canonical grading scale exported from `StudentResults.tsx`.
- **P12 (StudentDashboard Live Metrics & Announcements Cleanup)**:
  - Wired student attendance, overall grade, and fee status to live 30-day attendance, latest exam grade, and student ledger balance identically to ParentDashboard.
  - Replaced placeholder "Upcoming Exams: 2" with "Exams Taken" displaying the exact count of distinct exams recorded for the student.
  - Removed static placeholder Announcements section in favor of real notifications via the notification bell.
- **P13 (Unified Cashier Collection Math)**:
  - Rewrote daily, monthly, and range collection calculations in `AdminDashboard.tsx` and `AccountantDashboard.tsx` to follow a single unified collection rule: iterates through each `payment_history` entry on its respective payment date (`String(date).slice(0, 10)`), with single-payment fallback on `paidDate` for legacy/simple records.
  - Removed flawed assumption in `feeCollectionData` and `monthlyCollection` that credited entire challan payments to a single date, ensuring multi-instalment payments reflect accurately across day and month charts matching `FeeCollectionReportModal`.

## [3.35.0] - 2026-11-06

### Phase C: Money Safety & Atomic Database Transactions
- **P08 (Payments Atomic Overpayment Guard & Safe Cancellation)**:
  - Moved overpayment checks directly into SQL `UPDATE fee_challans` `WHERE` clause: `status <> 'Cancelled' AND (allowOverpayment = true OR (paid_amount + numAmount) <= (total_amount - discount))`.
  - Added atomic idempotency check: `AND (idempotencyKey IS NULL OR NOT (payment_history @> ...))`.
  - On 0 rows updated, queries fresh database row to distinguish missing challan (404), cancelled challan (409), previously committed idempotent request (200 duplicatePrevented), or concurrent payment collision (409 with fresh remaining balance).
  - Hardened `cancel-challan`: strictly restricted to `Owner` and `Admin`, rejecting cancellation with HTTP 409 if `paid_amount > 0`, `discount > 0`, or `payment_history` is non-empty.
  - Converted `increase-tuition` from sequential per-student queries into an atomic batch `sql.transaction([...])`.
  - Verified `FeePaymentModal.tsx` surfaces the exact server-side HTTP 409 conflict message.
- **P09 (Challan Arrears Strictly Prior Months & Scoped Fee Heads)**:
  - Scoped historical arrears aggregation in `challans.ts` strictly to months/years earlier than the target generation date using SQL `array_position(ARRAY['January',...,'December']::text[], month)`.
  - Filtered fee head lookup during generation by `school_id = effectiveSchoolId`.
  - Added guard against backdated challan generation: students with existing non-cancelled challans in later months are skipped to preserve ledger monotonicity.
  - Returned `skippedBackdated` in API response and displayed count in `DataContext.tsx` success toast.
- **P10 (Atomic Multi-Row Writes with sql.transaction)**:
  - `students.ts` `bulk-add-students`: pre-validates all records before querying; returns 400 listing duplicates if identical roll numbers exist in payload; executes all inserts inside `sql.transaction([...])`; intercepts Postgres unique violations (`23505`) and rolls back entirely with HTTP 409 `DUPLICATE_ROLL`.
  - `students.ts` `promote-students`, `reactivate-graduated`, and `revert-promotion`: wrapped chunked status and class updates into single all-or-nothing `sql.transaction([...])` executions.
  - `users.ts` `bulk-add-users`: validates all user rows and hashes all passwords with bcrypt *before* database writing; executes inserts in `sql.transaction([...])`; catches email uniqueness violations (`23505`) and returns 409 naming the conflicting email with zero partial rows written.
  - `users.ts` `add-user`: added HTTP 409 response on duplicate email (`23505`).
  - `challans.ts` `generate`: executes all multi-row chunk inserts within one `sql.transaction([...])`, preventing partial monthly batches on database failures.

## [3.34.0] - 2026-11-06

### Phase B: Cleanup, DB Sessions & Migration Baseline
- **P04 (Leftover Scaffolding & Dead UI Cleanup)**:
  - Cleaned `index.html`: deleted `<script type="importmap">` and Google gsi client script; added `<meta name="theme-color" content="#1e3a8a">`.
  - Removed dead "Sign in with Google" button, "Or" divider, unused `GoogleIcon`, and no-op `Remember this device` checkbox from `LoginPage.tsx`.
  - Changed registration link text to "Create an account" with "New accounts need approval from your school administrator".
  - Cleaned `RegisterPage.tsx`: removed `Admin` and `Accountant` options from self-registration (restricted to Teacher, Parent, Student) and defaulted to `Teacher`.
  - Deleted unused files `src/components/auth/AccountSetupPage.tsx`, `src/lib/supabaseClient.ts`, `firebase-applet-config.json`, and one-time script `scripts/hash-passwords.ts`.
  - Kept `metadata.json` for AI Studio frame permissions (`camera` support for barcode scanning).
  - Updated `package.json` start script to `NODE_ENV=production tsx server.ts` and removed unused `@google/genai` dependency.
  - Set `server.ts` port to `Number(process.env.PORT) || 3000`.
- **P05 (Database-Verified Sessions & Hardened Cookies)**:
  - Added `getSessionUser(req, res)` to `src/server/_db.ts` to query `profiles` on each request for fresh role, schoolId, name, avatar, and active status.
  - Invalidated cookies and rejected requests immediately for suspended/inactive/pending users.
  - Replaced inline token checks with `getSessionUser` across `verifySession` (`_helpers.ts`), `data/index.ts`, `data/students.ts`, `data/fees.ts`, `data/users.ts`, `data/schools.ts`, `auth/me.ts`, and `notifications/index.ts`.
  - Standardized cookie security flags across prod and dev: `httpOnly: true`, `sameSite: 'lax'`, `secure: isProd`, `maxAge: 12h`, and eliminated non-standard `partitioned` option.
- **P06 (Migration Runner & Baseline Sync)**:
  - Cleaned obsolete migration files (`001_schema_sync.sql`, `002_roll_unique.sql`, `003_challan_number.sql`) whose definitions are now established directly in `schema.sql`.
  - Created `migrations/README.md` defining strict idempotent SQL migration standards.
  - Implemented `scripts/migrate.ts` (`npm run migrate`) to apply pending SQL migrations in individual transactions and record execution in `schema_migrations`.
- **P07 (PostgreSQL-Backed Rate Limiting)**:
  - Created `migrations/001_login_attempts.sql` and added `login_attempts` table with `(email, attempted_at DESC)` index to `schema.sql`.
  - Replaced Vercel-ineffective in-memory Map in `src/server/handlers/auth/login.ts` with database queries against `login_attempts` (max 5 failed attempts per 15 min).
  - Enforced strict bcrypt password verification, deleting legacy plaintext comparisons and auto-upgrades.
  - Automatically cleared failed attempts on valid login and pruned attempts older than 1 day.

## [3.33.0] - 2026-11-06

### Phase A: Small Bug Fixes & Privacy Hardening
- **P01 (`PrintableChallan.tsx`)**:
  - Eliminated React hook rule violation where `useData()` was conditionally invoked within a `try/catch` block.
  - Made `allFees: FeeChallan[]` a required prop across all printable challan instances (`FeeCollectionPage`, `BulkChallanReportModal`, `ChallanRangeReportModal`), ensuring stable, predictable rendering during single, bulk, and ranged printing.
- **P02 (`AttendanceReportModal.tsx`, `DiscountReportModal.tsx`, `FeeCollectionReportModal.tsx`)**:
  - Replaced `.toISOString().split('T')[0]` invocations with `toLocalDateString()` from `utils/dates` to prevent 1-day timezone boundary shifts in Asia/Karachi (UTC+5).
  - Adopted `getTodayKarachi()` and `getFirstDayOfKarachiMonth()` for report filter default states.
  - Reordered `normalizeDate` branches so that DMY regex matching precedes `new Date()` parsing, preventing dates such as `01/02/2026` from misinterpreting as US-locale MDY (Jan 2) rather than Pakistan standard DMY (Feb 1).
- **P03 (`students.ts` & `notifications/index.ts`)**:
  - Corrected teacher field masking in `/api/data/students` from non-existent `cnic`/`parent_cnic` keys to `father_cnic`, matching the privacy masking in `/api/data`.
  - Added strict school-scoping verification on recipient profiles in `/api/notifications` `send` action, preventing cross-school notification leaks.

## [3.32.0] - 2026-11-05

### Batch F3: Client Consumers Use Server-Authoritative Multi-Year Ledger
- **F3.0 (`types.ts` & `DataContext.tsx`)**: Introduced `StudentLedger` type, `ledger` state, and `getLedgerForStudent(studentId)` helper in `DataContext.tsx`.
- **F3.1 (`AdminDashboard.tsx`)**: Computed `totalOutstandingDues` strictly from active students' ledger balance (`Math.max(0, getLedgerForStudent(s.id)?.balance || 0)`), preventing past-year arrears from disappearing.
- **F3.2 (`StudentManagementPage.tsx`)**: Replaced client-side `studentBalanceMap` with `getLedgerForStudent(id)?.balance || 0` across student balance columns and CSV export.
- **F3.3 (`StudentProfilePage.tsx`)**: Sourced fee balances, total paid, and total dues directly from `getLedgerForStudent(studentId)`.
- **F3.4 (`FeeCollectionPage.tsx`)**: Updated Outstanding filter to show challans if either the challan is Unpaid/Partial OR the student has a remaining ledger balance (`balance > 0.01`).
- **F3.5 (`StudentFeeHistory.tsx`)**: Added a multi-year total outstanding summary banner using `getLedgerForStudent(studentId)` above the payment history table.
- **F3.6 (`FeeRemindersPage.tsx`)**: Verified student multi-year ledger balance before skipping paid challan rows (`fee.status === 'Paid' && studentBalance <= 0.01`).
- **F3.7 (`DefaulterReportModal.tsx`)**: Sourced cumulative defaulter balances and net dues from `getLedgerForStudent(student.id)`.

### Batch F4: Remaining Client Bugs & High-Reliability Polish
- **F4.1 (`FeePaymentModal.tsx`)**:
  - Enforced `Math.max(0, ...)` on payment history sum recalculations.
  - Preserved `discount` and `method` attributes per history entry during edits.
  - Implemented an older-challan hard block (`setError('A newer challan exists for this student. Record the payment on the latest challan instead.')`).
- **F4.2 (`PrintableChallan.tsx`)**:
  - Implemented active `lateFee` prop handling, adding effective late fee to `finalDues` when challans are past due and unpaid.
  - Displayed "Late Fee" breakdown row above "Discount Amount (D.A.)" and reflected final dues in the Account Desk QR code payload and bottom acknowledgment balance.
- **F4.3 (`tailwind.config.js`)**:
  - Added `safelist: ['per-page-1', 'per-page-2', 'per-page-3']` to prevent dynamic printable wrapper classes from being purged in production builds.
- **F4.4 (`ChallanGenerationPage.tsx`)**:
  - Included `fineAmount` in `handlePreview` arrears calculations to maintain 100% parity with the backend generator.
- **F4.5 (`StudentFormModal.tsx` & `students.ts`)**:
  - Stripped `fee_structure` from both edit submit payloads and the backend `update-student` SQL UPDATE query, ensuring custom tuition fees set via "Increase Tuition Fee" are never overwritten by routine profile updates.
- **F4.6 (`FeeHeadsManagement.tsx`)**:
  - Made `handleDelete` async and awaited `deleteFeeHead`, closing the confirmation dialog only on success and presenting toast errors on failure.
- **F4.7 (`FeeCollectionPage.tsx`)**:
  - Added an "All Months" option (`<option value="">All Months</option>`) to the Challan Month dropdown filter.
  - Clarified button label to "Edit Payment" for already paid or partially paid challans.
  - Added a pagination clamp effect ensuring `currentPage` automatically adjusts if filtered rows decrease below the active page.

## [3.31.0] - 2026-11-04

### Batch F2: Server-Side Ledger & Date Precision
- **F2.1 (`/api/data` Ledger & Outstanding Dues)**: Updated `/api/data` to return older-year outstanding dues and a per-student ledger computed across all years, preventing fiscal-year rollovers from hiding past arrears.
- **F2.2 (`toLocalDateString` Helper)**: Added `toLocalDateString` in `src/utils/dates.ts` to ensure local Karachi date calculations (`YYYY-MM-DD`).
- **F2.3 (Date Helper Migration)**: Replaced `.toISOString().split('T')[0]` across calendar, attendance, and student form/management views with `toLocalDateString` or `getTodayKarachi` to prevent off-by-one UTC day-shift bugs.

## [3.30.0] - 2026-11-04

### Batch F1: Hazards & Data-Loss Vector Mitigations
- **F1.1 (Restore Endpoint & UI Safeguards)**: Stubbed `scripts/restore.ts` and replaced the in-app restore file upload UI in `SettingsPage.tsx` with a warning notice.
- **F1.2 (Migration 003)**: Created `migrations/003_challan_number.sql` dropping the erroneous `challan_number` unique index to prevent multi-school collision errors (`23505`), and cleaned up `001_schema_sync.sql` and `schema.sql`.
- **F1.3 (`change-password` Session Enforcement)**: Upgraded `change-password.ts` to use `verifySession` instead of JWT-only `verifyToken`, ensuring suspended/inactive users cannot reset passwords.
- **F1.4 (`update-payment` Validation)**: Added strict array validation for `paymentHistory` in `payments.ts` to prevent ledger wiping.
- **F1.5 (`bulk-update-order` Scoping)**: Added school ownership filtering to `bulk-update-order` in `classes.ts` to prevent cross-tenant class reordering.

## [3.29.0] - 2026-11-03

### Phases 1-5 Audit Implementation & Administrative Polish
- **Phase 1 (Ledger & Payment Integrity)**: Atomic JSONB payment history appends, idempotency key checks, cancellation guards, and delete-unpaid conflict checks.
- **Phase 2 (High-Speed Challan Generation & Duplicate Guards)**: Single-query aggregated arrears, chunked batch insertions (`ON CONFLICT DO NOTHING`), unique roll numbers (`002_roll_unique.sql`), and 23505 error handling.
- **Phase 3 (Timezone Precision & Scalability)**: Karachi timezone helper (`getTodayKarachi`), scoped attendance (45 days) and academic year fee queries, and optimistic state updates.
- **Phase 4 (Atomic CLI Database Restore)**: Created `scripts/restore.ts` with Neon WebSocket Pool transactions (`BEGIN ... COMMIT / ROLLBACK`), and updated HTTP restore endpoint to return `410 Gone` with CLI instructions.
- **Phase 5 (Administrative Usability & UX Polish)**: Omitted `feeStructure` on student profile updates to preserve custom tuition rates, prevented ImportModal premature completion on failure, added confirmation/validation before deleting referenced fee heads, and added natural alphanumeric sorting (`naturalCompare`) for challan reports.

## [3.28.0] - 2026-11-03

### Phase 4: Advanced Reporting, Activity Log Integration & System Verification
- **Advanced Reporting & Export Endpoints**: Verified secure, tenant-isolated backend report generation for fee collections, defaulters, attendance, and student metrics.
- **Activity Log & Audit Trail Expansion**: Ensured comprehensive server activity log persistence across tenant operations and admin/owner monitoring.
- **Production Hardening & System Versioning**: Bumped application version to `3.28.0` across all metadata, version files, and changelogs.

## [3.27.0] - 2026-11-03

### Phase 3: Security Hardening, Role Access Controls & Session Integrity
- **Strict `SESSION_SECRET` Enforcement (A1 - `_db.ts`)**: Removed fallback secret; server refuses to start if `SESSION_SECRET` is missing or shorter than 32 characters.
- **Role Allow-Lists & Creation Scope (A2 - `users.ts`, `register.ts`)**: Enforced strict role creation boundaries (Admins may only create Accountant, Teacher, Parent, Student within their own school; Owner required for Admin/Owner accounts).
- **Secure Password Changes & Resets (A3 - `change-password.ts`)**: Required current password for self-change, restricted administrative resets to authorized roles (preventing resetting Owner passwords), and recorded audit log entries for every change.
- **School Ownership Checks (A4 - `_helpers.ts`, `classes.ts`, `users.ts`)**: Enforced `requireSameSchool` verification across entity updates and deletions, preventing cross-tenant data tampering.
- **Session Re-Validation & Status Checks (A5 - `_helpers.ts`, `AuthContext.tsx`)**: Re-read user status from database on each authenticated API call; automatically clear session cookie and reject with 401 if inactive or suspended.
- **Database Schema Synchronization (`migrations/001_schema_sync.sql`)**: Synced missing columns (`attendance.school_id`, `results.school_id`, `fee_challans.created_at`, `profiles.phone_number`), backfilled tenant IDs, and added active partial unique indexes and check constraints.

## [3.26.0] - 2026-11-03

### System Resumption & Production Verification
- Resumed task execution following compaction, verifying full TypeScript compilation, Vercel API routing configuration (`vercel.json`), and robust backend integration.

## [3.25.0] - 2026-11-03

### Phase 2: High-Performance Challan Generation & Duplicate Guards
- **Single-Query Aggregated Arrears Calculation (A11 - `src/server/handlers/write/challans.ts`)**:
  - Replaced the O(N) loop with a single aggregated PostgreSQL query (`GROUP BY student_id`) computing total charged fees, fines, payments, and discounts across all past non-cancelled challans for all students simultaneously.
  - Reduced database round trips during monthly generation from 500+ down to ~6 queries.
- **Chunked Multi-Row Insertion with `ON CONFLICT DO NOTHING` (A11 - `src/server/handlers/write/challans.ts`)**:
  - Implemented batch parameterized insertions in chunks of 100 students leveraging `ON CONFLICT (student_id, month, year) WHERE status <> 'Cancelled' DO NOTHING RETURNING id`.
  - Accurately reports created challan count and skipped duplicate count based on returned rows.
  - Generates zero duplicate challans when run repeatedly for the whole school.
- **Removed 20-Second Client Timeout (A11 - `ChallanGenerationPage.tsx`)**:
  - Eliminated the arbitrary `Promise.race` 20s timeout in `ChallanGenerationPage.tsx`, allowing large batches to complete smoothly.
- **Unique Roll Numbers Per School (B2 - `migrations/002_roll_unique.sql` & `schema.sql`)**:
  - Created migration `migrations/002_roll_unique.sql` to detect duplicate roll numbers and enforce `students_school_roll_unique` partial unique index on `(school_id, roll_number) WHERE status <> 'Deleted'`.
  - Added `students_school_roll_unique` index to `schema.sql` for fresh database instances.
- **SQLSTATE 23505 Duplicate Roll Handling (B2 - `src/server/handlers/write/students.ts`)**:
  - In `add-student`, `update-student`, and `bulk-add-students`, caught unique constraint violation error `23505` and returned HTTP 409 with `{ error: 'DUPLICATE_ROLL', rollNumber }`.
- **Import Modal Error Stage Retention (B4 & B2 - `ImportModal.tsx` & `DataContext.tsx`)**:
  - Removed `setStage('complete')` from the `finally` block in `handleConfirmImport`, setting it only on successful import.
  - Kept errors and preview stage active on failure, dynamically identifying duplicate roll numbers and marking conflicted rows as "Roll number already exists" in invalid records so users can review and re-import remaining records without starting over.

## [3.24.0] - 2026-11-03

### Phase 1: Ledger & Payment Integrity
- **Atomic Payment Append & Discount Validation (A8 - `src/server/handlers/write/payments.ts`)**:
  - Replaced JavaScript memory array mutation with native PostgreSQL atomic JSONB concatenation (`payment_history = COALESCE(payment_history, '[]'::jsonb) || ${JSON.stringify([newRecord])}::jsonb`).
  - Added strict check rejecting any payment attempt on challans with `status === 'Cancelled'`.
  - Added strict validation rejecting negative discount values (`discount < 0`).
  - Enforced balance protection rejecting payment amounts exceeding the net remaining balance (`total_amount - discount - paid_amount`) unless explicitly confirmed via `allowOverpayment === true`.
- **Server-Side Payment Recalculation & Audit (A9 - `src/server/handlers/write/payments.ts`)**:
  - In `update-payment`, ignored client-supplied `paidAmount`; recomputed `paid_amount` strictly from the server-validated sum of entries in `paymentHistory` (rejecting any negative amounts).
  - Recalculated payment `status` ('Paid', 'Partial', 'Unpaid') strictly on the server based on the recomputed total and net payable balance.
  - Rejected payment edits on `Cancelled` challans.
  - Enhanced audit logging to record old `paid_amount`, old history count, new `paid_amount`, and new history count.
- **Payment Idempotency & Double-Click Retry Guard (B1 - `FeePaymentModal.tsx` & `payments.ts`)**:
  - In `FeePaymentModal.tsx`, generated an idempotency key using `useRef(crypto.randomUUID())` on modal mount and passed it to `recordFeePayment`.
  - In `record-payment`, stored `idempotencyKey` inside each history entry; if an identical key is received again, returns the existing challan with HTTP 200 without duplicate billing.
  - Passed `allowOverpayment: true` only after user confirmation in the overpayment prompt.
- **Safe Unpaid Challan Deletion (A12 - `src/server/handlers/write/challans.ts`)**:
  - In `delete-unpaid`, restricted deletion candidates strictly to challans with `paid_amount = 0`, `discount = 0`, empty `payment_history`, and non-cancelled status.
  - Added historical carry-over guard: checks if any affected student has a subsequent non-cancelled challan in a later month or year; returns HTTP 409 Conflict with detailed student and challan information to prevent breaking dues carry-over chains.

## [3.23.13] - 2026-11-03

### Vercel Deployment API Rewrite & Serverless Parity
- **Vercel Rewrite Configuration (`vercel.json`)**:
  - Restored explicit `/api/(.*)` and `/api` rewrite rules pointing to the `/api` serverless handler ahead of the SPA single-page fallback.
  - Resolves `404 Not Found` errors when accessing `/api/auth/login`, `/api/data`, and `/api/write/*` on Vercel deployments.
- **Canonical Serverless Function (`api/index.js`)**:
  - Configured `build` script in `package.json` to bundle `src/server/index.ts` directly into `api/index.js` using esbuild.
  - Added dual CommonJS export compatibility footer (`module.exports = handler; module.exports.default = handler;`) to support any Node.js runtime environment.
- **Intelligent URL Restoration (`src/server/index.ts`)**:
  - Restored requested URI resolution in the serverless handler via `x-matched-path`, `x-forwarded-uri`, `x-original-url`, `x-real-url`, and `req.originalUrl` when Vercel rewrites incoming paths to `/api`.
- **Catch-All Forwarding Proxy (`api/[...slug].js`)**:
  - Replaced duplicate 1.6MB bundle in `api/[...slug].js` with a lightweight 2-line module proxy forwarding directly to `./index.js` for seamless backward compatibility.
- **API Health Check Endpoint (`src/server/apiRouter.ts`)**:
  - Added `GET /api` root endpoint returning `200 OK` status with operational timestamp for instant server health verification.
- **Client Error Extraction (`src/context/AuthContext.tsx`)**:
  - Enhanced 404 handler in `login()` to parse JSON `data?.error` before displaying fallback diagnostic instructions.

## [3.23.12] - 2026-11-02

### Native Catch-All Vercel Serverless Function (`api/[...slug].js`)
- **Real Server Bundle (`api/[...slug].js`)**:
  - Bundled the full, genuine Express backend from `src/server/index.ts` into a Vercel catch-all serverless function `api/[...slug].js`.
  - Deleted obsolete `api/index.js` stand-in.
- **Removed URL Path Hacks**:
  - Removed the `x-matched-path` URL rewriting workaround in `src/server/index.ts`.
- **Simplified `vercel.json`**:
  - Removed explicit `/api` rewrites, letting Vercel natively route all `/api/*` requests to `api/[...slug].js`.

## [3.23.11] - 2026-11-02

### Vercel `/api` Rewrite & CommonJS Scope Isolation (`api/package.json`)
- **Isolated CommonJS Scope (`api/package.json`)**:
  - Added a local `api/package.json` file containing `{"type": "commonjs"}`. This tells Vercel's Node runtime to execute `api/index.js` in CommonJS mode (where `require()` is fully supported) even though the root package.json is set to `"type": "module"`.
- **Vercel Rewrites (`vercel.json`)**:
  - Pointed `vercel.json` rewrites back to `/api`, matching Vercel's standard serverless function convention.

## [3.23.10] - 2026-11-02

### CommonJS Extension Fix (`api/index.cjs`)
- **Renamed `api/index.js` to `api/index.cjs`**:
  - Because your root `package.json` specifies `"type": "module"`, Vercel treats all `.js` files as ES modules, which caused the `ReferenceError: require is not defined` error. Renaming the standalone serverless function to `.cjs` forces Vercel's Node.js runtime to treat it as CommonJS, allowing `require()` to execute perfectly.

## [3.23.9] - 2026-11-02

### Zero-Dependency Standalone Serverless Entrypoint (`api/index.js`)
- **Direct Native CommonJS Implementation**:
  - Replaced all multi-file bundling steps with a dedicated, robust CommonJS `api/index.js` file at the root. It directly connects to Neon PostgreSQL (`@neondatabase/serverless`), performs authentication via `bcryptjs` and `jsonwebtoken`, and handles API routes without any complex module resolution chains or dynamic `require` errors.

## [3.23.8] - 2026-11-02

### CommonJS Serverless Output Format Fix
- **Switched esbuild format to CJS (`--format=cjs`)**:
  - Resolved `Error: Dynamic require of "tty" is not supported` by compiling `api/index.js` as CommonJS (`--format=cjs`). This allows Node.js built-in modules (`tty`, `util`, `debug`) to be correctly required without ESM dynamic require translation errors in Vercel's serverless runtime.

## [3.23.7] - 2026-11-02

### Fully Bundled Serverless Artifact (`api/index.js`)
- **esbuild Single-File Bundling**:
  - Restored esbuild bundling to combine all server files and dependencies into a single self-contained `api/index.js` file. This resolves Vercel's `ERR_MODULE_NOT_FOUND` error for submodules (`apiRouter`, `_db`, etc.) when running in the serverless `/var/task` environment.

## [3.23.6] - 2026-11-02

### Standalone Serverless Entrypoint Fix (`api/index.ts`)
- **Direct Standalone Implementation**:
  - Replaced the relative import (`../src/server/index`) in `api/index.ts` with a fully self-contained Express server initialization. This completely eliminates Vercel's `ERR_MODULE_NOT_FOUND` error caused by cross-directory path resolution when running inside Vercel's serverless container (`/var/task`).

## [3.23.5] - 2026-11-02

### Native TypeScript Serverless Function on Vercel
- **Direct TypeScript Handler (`api/index.ts`)**:
  - Replaced legacy compiled JS artifacts with a clean native TypeScript Vercel serverless function entrypoint (`api/index.ts`), allowing Vercel's `@vercel/node` builder to compile and execute the Express application without missing module references.

## [3.23.4] - 2026-11-02

### Native Vercel TypeScript Serverless Function
- **Permanent Source File (`api/index.ts`)**:
  - Created a permanent source file `api/index.ts` in the repository root exporting the server handler (`import handler from '../src/server/index'`). The `api` folder is now directly visible and tracked in Git, ensuring Vercel detects the serverless function during repository analysis.
- **Vercel Rewrite Configuration (`vercel.json`)**:
  - Configured `rewrites` to map `/api/(.*)` directly to `/api/index.ts` with explicit `buildCommand: "npm run build"` and `outputDirectory: "dist"`.
- **Simplified Build Pipeline (`package.json`)**:
  - Streamlined `"build"` script to `"tsc && vite build"`, letting `@vercel/node` compile `api/index.ts` natively on deployment without depending on transient local esbuild bundles.

## [3.23.3] - 2026-11-02

### Vercel Serverless Function Rewrite Fix
- **Vercel Destination Matching (`vercel.json`)**:
  - Updated the rewrite destination from `/api` to `/api/index` (the canonical route path corresponding to the serverless function file `api/index.js`), resolving Vercel's `404 NOT_FOUND` for Express endpoints.
- **Pre-Handler Path Resolution (`src/server/index.ts`)**:
  - Added URL restoration inside the main export `handler` using `x-matched-path` or `x-forwarded-uri` before routing to Express, ensuring all incoming paths match `/api/...` routes cleanly.

## [3.23.2] - 2026-11-02

### Vercel Serverless Routing & Deployment Resilience
- **Vercel Rewrite Destination Fix (`vercel.json`)**:
  - Updated rewrite rules from `destination: "/api/index.js"` to `destination: "/api"` so Vercel invokes the Serverless Function instead of attempting to serve a static file and returning 404.
- **Serverless Crash Prevention (`_db.ts`)**:
  - Added safe fallback default for `SESSION_SECRET` so that missing or short environment variables in Vercel do not trigger fatal startup crashes during serverless module evaluation.
- **Vercel Path Resolution & Error Middleware (`src/server/index.ts`)**:
  - Supported URL restoration via `x-matched-path` and `x-forwarded-uri` headers alongside `req.originalUrl`.
  - Added global Express error handling middleware to ensure unhandled errors respond with JSON rather than unparseable HTML.
- **Detailed Client Error Reporting (`AuthContext.tsx`)**:
  - Improved error extraction in `login()` to parse HTML/status codes and show descriptive error messages if the backend returns 404 or 500.

## [3.23.1] - 2026-11-02

### Authentication & Vercel Serverless Deployment Fixes
- **Vercel Serverless Function Tracking (`api/index.js`, `.gitignore`)**:
  - Removed `api/index.js` from `.gitignore` so the bundled serverless entry point is included in git and deployed to Vercel, fixing `404 NOT_FOUND` / `Connection to authentication service failed`.
- **Cross-Site IFrame Cookie Support (`_db.ts`)**:
  - Configured `setSessionCookie` and `clearSessionCookie` with `SameSite=None; Secure; Partitioned` (CHIPS), allowing session cookies to be saved and sent inside cross-site iframes (such as the Google AI Studio preview).
- **Session State & 401 Handling (`AuthContext.tsx`, `DataContext.tsx`)**:
  - Removed fallback to stale `localStorage` user profile when server session verification fails, ensuring unauthenticated states cleanly render the Login page.
  - Added automatic logout and local state reset in `DataContext.tsx` when `/api/data` or `apiWrite` returns `401 Unauthorized`, eliminating persistent sync errors.

## [3.23.0] - 2026-11-01

### Database Migration & Schema Hardening
- **Schema Updates**:
  - Added missing `school_id` columns to `attendance` and `results`.
  - Added `created_at` timestamp and `check_amounts` constraint (`CHECK (paid_amount >= 0 AND discount >= 0 AND total_amount >= 0)`) to `fee_challans`.
  - Added `phone_number` to `profiles`.
- **Duplicate Prevention**:
  - Added unique partial indexes for `fee_challans` to prevent duplicate active challan generation per student per month and duplicate `challan_number` generation.

## [3.22.0] - 2026-11-01

### Fix Nested SQL Queries
- **Driver Compatibility Fix (`students.ts`, `challans.ts`, `payments.ts`)**:
  - Replaced nested `sql` template literal patterns (`${effectiveSchoolId ? sql`...` : sql`TRUE`}`) with a standard `AND` clause utilizing plain SQL parameters (`AND (${effectiveSchoolId}::uuid IS NULL OR school_id = ${effectiveSchoolId}::uuid)`) to bypass @neondatabase/serverless driver limitations.

## [3.21.0] - 2026-11-01

### Session Handling & Secure Cookie Authentication
- **HttpOnly Cookie Authentication & Token Removal (`AuthContext.tsx`, `DataContext.tsx`, `login.ts`)**:
  - Removed storing or sending the login token via `localStorage` (`edusync_token`) and `Authorization` headers across frontend clients.
  - Rely exclusively on HttpOnly session cookies with `credentials: 'include'`.
  - Removed token return from the login response body.
- **Dynamic Database Status Verification (`_helpers.ts`, `data/index.ts`)**:
  - Updated `verifySession` and `/api/data` to re-read the user's current status from the database on every request.
  - If a user's status is `Inactive` or `Suspended`, returns HTTP 401 and clears the session cookie.
- **Audit Logging Security (`users.ts`)**:
  - Restricted the `add-log` action to `Owner`, `Admin`, and `Accountant` roles.
  - Ignored any user name passed in the request body (relying strictly on verified session credentials).

## [3.20.0] - 2026-11-01

### School Ownership Enforcement & Record Pre-Loading
- **`requireSameSchool` Helper & `isAuthorized` Hardening (`_helpers.ts`)**:
  - Added `requireSameSchool(session, recordSchoolId)` helper (returns false unless session is Owner or recordSchoolId matches session.schoolId).
  - Updated `isAuthorized` to deny access when the caller is not an Owner and has no `schoolId`.
- **User Management Hardening (`users.ts`)**:
  - `update-user` and `delete-user` now pre-load the record first and enforce `requireSameSchool`.
  - `update-user` strictly prohibits changing user roles, and blocks Admins from touching Owner accounts.
  - `update-school` pre-loads the school record and enforces `requireSameSchool`.
- **School Configuration Hardening (`classes.ts`)**:
  - Every update/delete by ID action (`update-class`, `delete-class`, `update-subject`, `delete-subject`, `update-exam`, `delete-exam`, `update-fee-head`, `delete-fee-head`, `update-event`, `delete-event`) now pre-loads the record and enforces `requireSameSchool`.

## [3.19.0] - 2026-11-01

### Password Reset Security & Audit Hardening
- **Strict Password Reset Rules (`auth/change-password.ts`)**:
  - Changing your own password requires `currentPassword` (rejected if missing or incorrect).
  - Resetting someone else's password is allowed only for Owners (any non-Owner user) or Admins (only users of the same school whose role is below Admin: Accountant, Teacher, Parent, Student).
  - Protected Owner passwords: Nobody may reset an Owner's password except that Owner.
  - Returns HTTP 403 on permission violations.
- **Password Change Audit Logging**:
  - Writes a server audit log entry (`activity_logs`) for every successful password change or reset operation.

## [3.18.0] - 2026-11-01

### Role Creation & Registration Allow-List Enforcement
- **Strict Role Allow-Lists & School Isolation (`add-user` & `bulk-add-users`)**:
  - Admins may create only `Accountant`, `Teacher`, `Parent`, or `Student` accounts, and only within their own school (`session.schoolId`), ignoring any `schoolId` passed in the body.
  - Only Owners may create `Admin` or `Owner` roles.
  - Returns HTTP 403 otherwise.
- **Public Registration Allow-List (`auth/register.ts`)**:
  - Public registration is strictly restricted to `Teacher`, `Parent`, or `Student` roles (never `Admin` or `Owner`). Returns HTTP 403 otherwise.

## [3.17.0] - 2026-11-01

### Security Hardening & Secret Protection
- **Strict `SESSION_SECRET` Validation**:
  - Removed default fallback secret in `src/server/_db.ts` and `src/server/handlers/_db.ts`. Throws a startup error if `SESSION_SECRET` is missing or shorter than 32 characters.
- **Removal of Demo Login Shortcuts**:
  - Removed "Quick Demo Logins" section and `handleQuickLogin` helper from `LoginPage.tsx`.
- **Bulk User Import Hardening**:
  - Removed `'password123'` fallback default in `bulk-add-users` (`src/server/handlers/write/users.ts`); rows without a password are now strictly rejected.
- **Git & Environment Hygiene**:
  - Deleted untracked `cookies.txt` and added both `api/index.js` and `cookies.txt` to `.gitignore`.

## [3.16.5] - 2026-11-01

### Fixed & Resolved (Pre-Bundled Vercel Serverless Backend)
- **Pre-Bundled Serverless Execution (`api/index.js`)**:
  - Configured `esbuild` in `"build"` script to bundle `src/server/index.ts` into a self-contained JavaScript bundle (`api/index.js`) during deployment.
  - Updated `vercel.json` rewrites to point directly to `/api/index.js`, eliminating runtime `FUNCTION_INVOCATION_FAILED` errors caused by uncompiled TypeScript path resolution on Vercel's Edge/Node runtime.

## [3.16.4] - 2026-11-01

### Fixed & Hardened (Vercel Serverless Function Runtime Compatibility)
- **Explicit Vercel Handler Wrapper (`api/index.ts`)**:
  - Wrapped the Express app inside an explicit Vercel serverless function signature (`export default function handler(req, res) { return app(req, res); }`) to ensure 100% reliable execution and protocol compatibility on Vercel's Node.js runtime.

## [3.16.3] - 2026-11-01

### Fixed & Hardened (Vercel Production Deployment Routing)
- **Vercel Serverless Function Routing (`api/index.ts` & `vercel.json`)**:
  - Configured `api/index.ts` to mount `apiRouter` at both `/api` and `/` to gracefully handle Vercel's URL path routing differences.
  - Added explicit `/api/(.*)` rewrite rules in `vercel.json` ensuring 100% routing parity between local preview and Vercel serverless deployment.

## [3.16.2] - 2026-11-01

### Added & Improved (Sign-In Page Redesign & Version Badge)
- **Sign-In Page UI/UX Redesign (`LoginPage.tsx`)**:
  - Added prominent application version display (`v3.16.2`) on both desktop branding sidebar and mobile header.
  - Introduced **Quick Demo Logins** grid for instant testing across all roles (Owner, Admin, Accountant, Teacher, Parent, Student) with one-click credential filling.
  - Polished glassmorphism visual styling, input focus states, and responsive layout.

## [3.16.1] - 2026-11-01

### Optimized & Resolved (Vercel Serverless Function Limit Bypass)
- **Single Catch-All Serverless Function (`api/index.ts`)**:
  - Consolidated all 18 backend endpoints into a single serverless function entry point (`api/index.ts`) powered by a unified Express router (`src/server/apiRouter.ts`).
  - Reduced total Vercel serverless functions from 18 down to exactly **1 function**, fully resolving Vercel Hobby plan limits ("No more than 12 Serverless Functions can be added to a Deployment") without requiring any platform migration (stays free on Vercel with Neon PostgreSQL).

## [3.16.0] - 2026-11-01

### Removed & Hardened (Stage 4: Complete Removal of Database from Browser)
- **Zero Browser Database Architecture**:
  - Completely purged database drivers, database connection strings, and client-side SQL execution from the browser application bundle.
  - Removed `@neondatabase/serverless` and direct PostgreSQL drivers from the client bundle (driver retained strictly for serverless backend / Express execution).
  - Deleted `src/lib/neonClient.ts` virtual database driver.
  - Deleted `src/lib/db.ts` and uninstalled Dexie IndexedDB client fallback from the frontend application.
- **Serverless Notifications (`/api/notifications`)**:
  - Migrated `NotificationContext` from client-side SQL queries to an authenticated serverless endpoint supporting `GET` (fetch recent user notifications), `POST` mark read, mark all read, and role-authorized broadcast announcements.
- **Zero Leaked Credentials**:
  - Removed `VITE_NEON_DATABASE_URL` from `.env.example`, `src/vite-env.d.ts`, and documentation. Database connections require server-only `DATABASE_URL`.
- **Streamlined Data Recovery & Settings**:
  - Removed obsolete Dexie sync architecture and danger zone hard-reset controls from `SettingsPage.tsx` and `ThemeContext.tsx`.
  - Added modern "Data Snapshots & Recovery" interface for Administrators and Owners powered by serverless atomic transaction restore.
- **Verified Bundle Cleanliness**:
  - Confirmed via production compilation and bundle inspection that no database connection strings or browser SQL drivers exist in the static distribution output.

## [3.15.0] - 2026-11-01

### Added & Hardened (Stage 3: Safe Serverless Writes & Atomic Operations)
- **Serverless Write Mutation Architecture (`/api/write/*`)**:
  - `/api/write/_helpers.ts`: Session extraction, role permission authorization, multi-tenant school boundary enforcement, and server-side audit logging utility.
  - `/api/write/payments.ts`: Atomic payment processing, payment updating, challan cancellation, and tuition fee adjustments.
  - `/api/write/challans.ts`: Duplicate-guarded monthly fee challan generation and unpaid challan deletion with student school isolation.
  - `/api/write/academic.ts`: Multi-row batch upserts for daily student attendance and exam marks (`ON CONFLICT ... DO UPDATE`).
  - `/api/write/students.ts`: Student CRUD operations, leaving certificate generation, bulk imports, class promotions, graduations, and promotion rollbacks.
  - `/api/write/classes.ts`: CRUD operations and reordering for classes, subjects, exams, fee heads, and school calendar events.
  - `/api/write/users.ts`: User management with automatic `bcryptjs` password hashing, deactivation, bulk user imports, and school profile management.
  - `/api/write/restore.ts`: Atomic transactional database restore wrapped inside `BEGIN ... COMMIT / ROLLBACK` block.
- **Atomic Database Calculations (Preventing Cashier Race Conditions)**:
  - Replaced browser-side arithmetic with PostgreSQL-native updates: `paid_amount = paid_amount + $amt`.
  - Recomputed payment status (`Paid` vs `Partial`) inside PostgreSQL engine using `CASE WHEN (paid_amount + $amt) >= (total_amount - discount) THEN 'Paid' ELSE 'Partial' END`.
  - Append audit history to `payment_history` atomically.
- **Duplicate-Safe Monthly Challan Generation**:
  - Server-side pre-generation validation checks whether an active non-cancelled challan already exists for a student in the specified month and year, skipping duplicates and reporting skipped count to client.
- **Server-Authoritative Audit Logging**:
  - Activity logs are authored and written on the server in `activity_logs` using the verified authenticated session user's identity, preventing client-side spoofing.
- **Transactional Database Restore with Staff Account Protection**:
  - All restore queries execute within an atomic transaction. If any record fails, the entire transaction is rolled back and an exact error is returned (no false success messages).
  - Staff profiles, bcrypt password hashes, and activity logs are strictly preserved during single-school restores, eliminating admin lockout.
- **Bcrypt Hashing for Admin-Created Users**:
  - Newly created staff accounts (Admin, Accountant, Teacher) are automatically hashed using `bcryptjs` with 10 salt rounds on the server prior to storage.
- **Complete Elimination of Client-Side Mutations**:
  - Replaced all direct browser-side `sql` INSERT, UPDATE, and DELETE operations across `DataContext.tsx` with authenticated API calls.

## [3.14.0] - 2026-11-01

### Added & Hardened (Stage 2: Safe Scoped Reads & Data Isolation)
- **Serverless Data Read Architecture (`/api/data/*`)**:
  - `/api/data/index.ts`: Unified, low-latency authenticated read endpoint replacing multi-roundtrip client queries with a single scoped request.
  - `/api/data/students.ts`, `/api/data/fees.ts`, `/api/data/users.ts`, `/api/data/schools.ts`: Dedicated modular read endpoints with role-based access control.
- **Strict Role-Based Data Isolation**:
  - **Owner**: Full visibility across all schools or scoped to the selected active school.
  - **Admin & Accountant**: Strictly isolated to their own `school_id`; Owner accounts and foreign school data are omitted.
  - **Teacher**: Strictly isolated to their own `school_id`; fee challans and activity logs are omitted.
  - **Parent**: Restricted strictly to their own children (`child_student_ids`); other students, unrelated fee challans, and user profiles are completely hidden.
  - **Student**: Restricted strictly to their own profile, class, results, attendance, and fee challans.
- **Privacy & Credential Protection**:
  - `password` and password hashes are never queried or returned across any user read endpoint.
  - `cnic` and `parent_cnic` are excluded for roles that do not require them (Teacher, Parent, Student).
- **Client Refactoring (`DataContext.tsx`)**:
  - Replaced client-side `SELECT` statements in `fetchData()` with authenticated `fetch('/api/data')` carrying session cookies/tokens.
  - Preserved camelCase data shapes, numerical conversions, and JSON parsing so all dashboards, components, and charts render seamlessly without changes.

## [3.13.0] - 2026-10-31

### Added & Hardened (Stage 1: Production Authentication & Passwords)
- **Serverless Authentication Architecture**: Created backend API routes for Vercel Serverless Functions:
  - `/api/_db.ts`: Secure server-side database connection using `process.env.DATABASE_URL` (no frontend leaks), JWT generation, verification, and cookie parsing/serialization.
  - `/api/auth/login.ts`: Email lookup, `bcryptjs` password validation with automatic legacy password upgrade, account status verification (`Pending Approval`, `Inactive`, `Suspended`), rate limiting (5 failed attempts per email per 15 minutes), and secure cookie generation.
  - `/api/auth/me.ts`: Session hydration and token validation via `httpOnly` cookie and authorization header.
  - `/api/auth/logout.ts`: Session invalidation and cookie clearing endpoint.
  - `/api/auth/change-password.ts`: Authenticated password change endpoint with `bcryptjs` hashing.
  - `/api/auth/register.ts`: Account registration with `bcryptjs` hashing and pending approval workflow.
- **Client-Side Auth Hardening (`AuthContext.tsx`)**:
  - Removed client-side `SELECT ... password = ...` database queries.
  - Eliminated trusting `localStorage` as proof of user identity; session identity is verified by the backend `/api/auth/me` on every load.
  - Omitted password fields from client-facing payloads across all authentication operations.
- **Password Migration Utility**:
  - `scripts/hash-passwords.ts`: Standalone migration script that safely upgrades existing plaintext passwords to salted `bcryptjs` hashes, skipping existing hashes.
- **Dev & Production Parity**:
  - `server.ts`: Express application mounting Vite middleware in development and serving built assets in production, allowing serverless `/api/*` endpoints to be tested seamlessly on port 3000.

## [3.12.0] - 2026-10-31

### Fixed & Hardened (Audit Follow-Up)
- **Data Loss Bug in Student Edits**: Fixed a bug where editing an existing student (`updateStudent`) dropped `date_of_admission` and `secondary_contact_number`. Also restored missing `fee_structure` in `addStudent` to prevent loss of custom tuition rates on newly admitted students.
- **Complete Financial Audit Trail**: Added comprehensive activity logging across all financial mutations (`recordFeePayment`, `updateFeePayment`, `cancelChallan`, `deleteChallansForMonth`, `generateChallansForMonth`, `increaseTuitionFees`, and `issueLeavingCertificate`).
- **Dashboard Collection & Dues Reconciliation**:
  - Reconciled "Collected Today" and "Collected This Month" across Admin and Accountant dashboards to aggregate from `payment_history`, eliminating discrepancies between split payments and the Fee Collection Report.
  - Recomputed `totalOutstandingDues` on dashboards using active student cumulative balances rather than summing old overlapping challan records.
- **Fresh Database Schema Initialization Order**: Moved `schools` table definition before `profiles` in `schema.sql` so executing the schema on a fresh PostgreSQL instance completes without foreign key reference errors.
- **Restore Foreign Key Cascade Safety**: Added pre-emptive deletion/truncation of `activity_logs` before deleting profiles during school and global database restores, preventing foreign key constraint aborts.
- **Local Calendar Date Handling**: Introduced `getLocalTodayString()` to use local client timezone dates rather than UTC, avoiding premature date shifting around midnight in South Asian timezones (UTC+5).

## [3.11.0] - 2026-10-31

### Performance & Scalability
- **Production Database B-Tree Indexing**: Added explicit `CREATE INDEX IF NOT EXISTS` statements across all foreign keys and high-frequency filter columns in `schema.sql` (`student_id`, `class_id`, `school_id`, `month, year`, `status`, `paid_date`, `date`, `exam`). Eliminates O(N) sequential table scans on PostgreSQL, ensuring instantaneous query execution even with tens of thousands of historical records.
- **Concurrent Batch Execution**: Refactored mass-operation network loops (`setAttendance`, `saveResults`, `increaseTuitionFees`, `bulkAddStudents`) from sequential one-by-one queries to concurrent `Promise.all` batches with chunking (20-30 rows per batch) and real-time progress tracking. Reduces execution times from 30+ seconds down to 1-2 seconds.

### Financial Transactions & Ledger Integrity
- **Duplicate Challan Guard**: Added strict safeguards in both bulk generation (`generateChallansForMonth`) and single challan generation (`SingleChallanGenerationModal`) to detect existing non-cancelled challans for the same student, month, and year. Prevents accidental duplicate ledger creation and double-billing.
- **Accurate Arrears Carry-Over with Fines**: Updated cumulative ledger formula in `generateChallansForMonth` to incorporate penalty fines (`fineAmount`) into charged totals alongside fee items and opening balances, guaranteeing late fees correctly carry over into future months.

### Academic Records & Result Accuracy
- **Total Marks Parameter Mapping**: Fixed property key mapping in `saveResults` where `totalMarks` (camelCase) from UI inputs is now correctly mapped and validated before insertion, preventing null total marks in exam reports.
- **Cleaned Redundant Assets**: Removed orphaned `LeavingCertificatePage` legacy component to prevent duplicate maintenance paths.

## [3.10.0] - 2026-10-10

### Fixed
- **Google Drive Multipart Upload Specification**: Fixed the `Cloud Error - Upload failed:` issue during Google Drive cloud backup. Google Drive REST API's `uploadType=multipart` strictly requires RFC 2387 `multipart/related` format with boundary delimiters, not standard browser `multipart/form-data` generated by `FormData`. Reconstructed upload request body into standard `multipart/related` and added rich error response body extraction for crystal-clear error reporting.
- **Manual File Import / Local Backup Restore Data Loss**: Fixed the issue where local backup restore left only class data and lost students, attendance, fee challans, and exam results:
  - **Parameter Unwrapping in SQL Layer**: Fixed parameter wrapping bug in `sql` where calling `sql(query, values)` wrapped `values` into `[[v1, v2, ...]]`, assigning the entire array to `id` and setting all other columns (`schoolId`, `studentId`, `rollNumber`, etc.) to `undefined`.
  - **Atomic Offline Database Bulk Operations**: Implemented direct Dexie transactions (`db.transaction`) for offline restore with `bulkPut`, delivering fast, 100% lossless restoration of students, fee challans, attendance, results, classes, fee heads, and subjects.
  - **TRUNCATE & Extended DELETE Support**: Added support for `TRUNCATE TABLE`, `DELETE ... WHERE school_id = $1`, `DELETE ... WHERE student_id IN (...)`, and `DELETE FROM profiles WHERE role != 'Owner'` in the offline database interpreter.
- **Offline Direct JSON Export**: Updated `backupData` to read directly from Dexie tables when in offline mode, ensuring every single record saved in IndexedDB is included in the downloaded JSON snapshot file.

## [3.9.0] - 2026-10-10

### Fixed
- **Atomic Non-Cascading Promotion**: Completely resolved the sequential promotion bug where promoting Class 1 into Class 2 caused newly promoted students to be re-promoted in subsequent loop iterations, cascading all students into the final class and marking all 586 students as "Graduated". The promotion engine now snapshots current active students atomically and executes targeted ID-based batch promotions.
- **Offline & Neon SQL Batch Support**: Added native support for multi-ID array updates (`id = ANY(...)`), `class_id` updates, and set mutation parsing in the offline database simulator.

### Added
- **Graduated Students Management & Recovery Modal**: Added a dedicated recovery modal (`GraduatedStudentsModal`) accessible with 1 click from Class Management and Student Management. Allows administrators to:
  - **Restore to Previous Class from Fee & Exam History**: Automatically reconstructs students' prior classes from past fee challans and examination results and reactivates them.
  - **Keep Assigned Class & Reactivate Status**: Sets status back to `Active` while retaining current class IDs.
  - **Batch Reassign to Class**: Assigns all or selected graduated students to a chosen destination class.
  - **Undo Last Promotion**: 1-click rollback of the previous promotion using saved localStorage snapshots.
- **Graduated Filter & Notification Banners**: Added `Graduated` to the status dropdown filter in Student Management and informative notice banners in both Class Management and Student Management.
- **Enhanced Status Visuals**: Added distinct purple badges for `Graduated` students in student tables and student profile headers.

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
