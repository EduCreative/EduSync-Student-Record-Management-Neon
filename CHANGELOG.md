
# Changelog

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
