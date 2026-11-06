
# EduSync - Modern Student Record Management System (Production Architecture)

**EduSync** is a high-performance school management platform powered by a secure serverless backend proxying to **Neon Serverless Postgres**.

---

## ✨ Key Features (v3.16.1 - Vercel Serverless Optimization & Zero Browser DB)
- **Single Catch-All Serverless Function (`api/index.ts`)**: Consolidated all backend API routes into a single serverless function entry point (`api/index.ts`) via a unified Express router (`src/server/apiRouter.ts`). This reduces total Vercel serverless functions from 18 down to exactly **1 function**, fully bypassing Vercel Hobby plan limits ("No more than 12 Serverless Functions can be added to a Deployment") without requiring any platform migration (stays 100% free on Vercel with Neon PostgreSQL).
- **Zero Browser Database (Stage 4)**: Completely eliminated all database drivers, connection strings, and client-side SQL execution from the browser bundle (`src/lib/neonClient.ts` and `src/lib/db.ts` removed).
- **Server-Authoritative Notifications**: Migrated `NotificationContext` to the authenticated `/api/notifications` serverless endpoint.
- **Server-Only PostgreSQL Credentials**: Eliminated `VITE_NEON_DATABASE_URL` entirely. The database is accessed exclusively on the server using `DATABASE_URL` via serverless API routes.

## ✨ Previous Features (v3.15.0 - Safe Serverless Writes & Atomic Mutations)
- **Serverless Write Mutation Architecture (Stage 3)**: Moved all database writes behind serverless endpoints (`/api/write/payments`, `/api/write/challans`, `/api/write/academic`, `/api/write/students`, `/api/write/classes`, `/api/write/users`, `/api/write/restore`) with strict role-based authorization and session verification.
- **Atomic Balance Updates (Race Condition Elimination)**: Payment recording now uses PostgreSQL-native arithmetic (`paid_amount = paid_amount + $amt`) and in-engine status calculation, preventing two cashiers from overwriting each other's collections.
- **Duplicate-Safe Monthly Challans**: Server-side duplicate checking prevents multiple active challans from being created for the same student in the same month and year.
- **Server-Authoritative Audit Logging**: System activity logs are authored and written on the server using verified session tokens rather than client-supplied values.
- **Transactional Database Restore**: Database restore runs within a single PostgreSQL transaction (`BEGIN ... COMMIT / ROLLBACK`), ensuring incomplete restores are rolled back and staff accounts and hashed passwords are protected from accidental wipeout.
- **Bcrypt Hashing for Newly Created Users**: All user accounts created through Admin management or bulk import are automatically hashed on the server with `bcryptjs`.
- **Zero Direct Client Mutations**: Removed all client-side `sql` INSERT, UPDATE, and DELETE operations from `DataContext.tsx`.

## ✨ Previous Features (v3.14.0)
- **Serverless Data Read Architecture (Stage 2)**: Replaced client-side `SELECT` queries with serverless endpoints (`/api/data`, `/api/data/students`, `/api/data/fees`, `/api/data/users`, `/api/data/schools`).
- **Role-Based Tenant & Data Isolation**:
  - **Owner**: Full access across all schools and global reports.
  - **Admin / Accountant**: Strictly restricted to their own `school_id`. Foreign schools and Owner profiles are invisible.
  - **Teacher**: Scoped to their school; administrative fee ledgers, audit logs, and CNICs are omitted.
  - **Parent**: Restricted strictly to their own children. No other students, families, or users are exposed.
  - **Student**: Restricted strictly to their own profile, class, results, attendance, and fee challans.
- **Zero Password & PII Leakage**: Plaintext passwords and password hashes are never returned across any data endpoint. Sensitive CNICs are masked or omitted for non-administrative roles.
- **Single Round-Trip Loading**: Consolidated multi-query browser loops into a single optimized server-side query batch, reducing network chatter and speeding up initial application load.

## ✨ Previous Features (v3.13.0)
- **Vercel Serverless Authentication Architecture (Stage 1)**: Shifted authentication logic from browser-side queries into secure serverless API endpoints (`/api/auth/login`, `/api/auth/me`, `/api/auth/logout`, `/api/auth/change-password`, `/api/auth/register`).
- **Zero Database Exposure**: Database connections on auth are performed via server-only `process.env.DATABASE_URL`, keeping master connection strings hidden from browser clients.
- **Bcrypt Password Security**: Passwords are authenticated strictly using standard salted bcrypt hashes. Plaintext fallback has been eliminated.
- **Brute-Force Rate Limiting**: Built-in protection against brute-force attacks limiting failed login attempts to a maximum of 5 attempts per email per 15-minute window (HTTP 429).
- **Secure HttpOnly Cookie Sessions**: Authentication tokens are signed with JWT (`SESSION_SECRET`) with 12-hour expiration and delivered via `httpOnly`, `Secure`, `SameSite=Strict` cookies, completely eliminating the vulnerability of treating unverified `localStorage` data as identity proof.
- **Zero Client Password Leakage**: Passwords and password hashes are never returned to client applications across login, me, and user list responses.

## ✨ Previous Features (v3.12.0)
- **Data Preservation on Student Edits**: Saved `dateOfAdmission`, `secondaryContactNumber`, and `feeStructure` on all student additions and updates, permanently eliminating silent field loss.
- **Full Financial Audit Logging**: Every payment, modification, cancellation, fee increase, leaving certificate, and challan deletion is logged to `activity_logs`.
- **Reconciled Dashboard Collections & Arrears**: Daily/monthly dashboard figures compute from individual payment records, perfectly reconciling with the cashier register and eliminating overlapping arrears inflation.
- **Robust Database Foreign Key Safety**: Cleaned `schema.sql` creation order and safe cascade deletion of audit records during backup restoration.
- **Production Database B-Tree Indexing**: Complete `CREATE INDEX IF NOT EXISTS` schema coverage in `schema.sql` across foreign keys, statuses, and dates, preventing sequential table scans and enabling lightning-fast query execution on large databases.
- **Concurrent Batch Operations**: Parallelized queries with `Promise.all` across attendance recording, results submission, tuition fee increments, and bulk CSV imports, eliminating UI lag and reducing bulk write times by up to 90%.
- **Duplicate Challan & Ledger Protection**: Comprehensive multi-layer protection in both batch and single challan generation to prevent duplicate active challans for the same student in the same month/year.
- **Accurate Arrears Carry-Over with Fines**: Full incorporation of late fines (`fineAmount`) into cumulative ledger calculations, guaranteeing penalty dues carry forward without manual recalculation.
- **High-Fidelity Google Drive Cloud Backup**: Built on RFC 2387 `multipart/related` compliant uploads with automatic token refreshing and descriptive API error diagnostics.
- **Instant, Lossless Local Backup & Restore**: Robust local file import and JSON export engine backed by atomic IndexedDB transactions, guaranteeing 100% data integrity for all students, ledgers, challans, and academic transcripts.
- **Safe, Atomic Student Promotion**: Promotes active students concurrently to destination classes based on initial state snapshots, completely eliminating cascading chain promotions.
- **Graduated Students Recovery & Reactivation Hub**: Full-featured recovery interface (`GraduatedStudentsModal`) to restore graduated students back to `Active` status, automatically reconstruct previous class assignments from fee or exam history, or revert the last promotion in 1 click.
- **Archived Student Visibility**: Added `Graduated` status filtering and notification banners in Class Management and Student Management so administrators always have complete clarity over their student body counts.
- **Challans per A4 Page Setting (1, 2, or 3 per Page)**: Added radio selector for 1, 2, or 3 challans per page (defaulting to 3 per page) alongside Copies per Challan (2 or 3 copies) across Bulk Fee Challans and Range Fee Challans modals.
- **Dynamic Print Layout Scaling & Height Adjustments**: Automatically adjusts vertical container heights (`.per-page-1`, `.per-page-2`, `.per-page-3`), card padding, and QR code sizes for clean, balanced layouts on A4 paper and PDF downloads.
- **Print / Save Acknowledgment Bar Fix**: Optimized print box paddings and overflow rules (`overflow: visible` with `min-height: 94mm`) to ensure `Pay Date:`, `Paid:`, and `Bal.:` fields render with 100% visibility both in Print Preview and in Print / Save PDF output.
- **Standardized Challan ID Format (`yyyymm-stdid`)**: Formatted Challan IDs strictly as `yyyymm-stdid` (e.g. `202601-1099`) across print metadata headers, last payment records, desk scan QR code payloads, and newly generated fee challans.
- **Payment Date Future Date Validation**: HTML5 date limits (`max={today}`) and real-time form validation prevent cashiers/accountants from selecting future payment dates when recording or updating payments.
- **Chronological Prior Payment Lookup & Multi-Month Carry-Over**: Evaluates the student's entire fee ledger to retrieve the chronologically preceding paid or partially-paid transaction in the `LAST PAYMENT DETAIL` section.
- **Cashier Fillable Receipt Fields**: Provides clean pen-writing lines (`Pay Date:`, `Paid:`, `Bal.:`) on printed monthly challans so cashiers can fill them by hand at the counter, which then print automatically once entered into the app.
- **Clarified Discount Amount (D.A.) Labels**: Explicitly labeled `Discount Amount (D.A.)` and `Discount (D.A.)` across fee breakdown tables.
- **Ink-Friendly Soft Theme**: Soft slate header banners (`bg-slate-700` / `bg-slate-600`) and high-contrast light table headers (`bg-slate-200`) for clear readability and optimal printer ink usage.
- **Desk Scan QR Code Integration**: Embedded QR codes on printable fee challans containing student ID, payment due date, total amount, and challan ID for fast scanning at the school's account desk.
- **Direct Challan Printing**: Convenient 1-click single challan print previews directly from Fee Collection and Fee History.
- **Production Serverless Architecture**: Fast, resilient serverless API handling authentication, scoped data reading, and atomic database mutations.
- **Auto-Seeded Demo Mode**: Instantly launches pre-loaded test data (Oakridge School) for easy testing and exploration of Owner, Admin, Accountant, Teacher, and Student roles.
- **Automatic Live Update Engine**: Intelligent checking against the static release registry to prompt users whenever a new update is deployed.
- **Smart Broadcasts**: Send targeted announcements to specific classes, parents, or student groups.
- **Google Drive Backup**: Securely save snapshots to your personal cloud, including logos and photos.
- **Global Owner Control**: Full system backup and restoration for Owners.

---

## 🛠️ Google Drive Integration Setup
If you see an "Access Blocked" or "Unverified App" screen when backing up to Drive:
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Select your project.
3. Navigate to **APIs & Services > OAuth consent screen**.
4. If the "Publishing status" is **Testing**, go to **Test users** and click **ADD USERS**.
5. Add the Gmail address you are using to log into the app.
6. When logging in through the app, click **Advanced > Go to edusync (unsafe)**.

---

## 🚀 Setup and Installation
### 1. Prerequisites
- [Node.js](https://nodejs.org/) (version 18 or higher)
- A [Neon](https://neon.tech/) PostgreSQL account

### 2. Environment Variables
- `DATABASE_URL`: Server-side PostgreSQL connection string (server environment only, never prefixed with `VITE_`).
- `SESSION_SECRET`: Secret key used to sign JWT session cookies (e.g. 32+ characters).
- `VITE_GOOGLE_CLIENT_ID`: (Optional) Your Google OAuth 2.0 Client ID for Drive integration.

---

## 🗄️ Neon Schema (SQL)
To ensure all features work correctly, run the SQL commands in `schema.sql` within your Neon SQL Editor. This will create the necessary tables for profiles, schools, students, fees, and announcements.
