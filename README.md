
# EduSync - Modern Student Record Management System (Neon Edition)

**EduSync** is a high-performance school management platform powered by **Neon Serverless Postgres** with an intelligent local-fallback sandbox.

---

## ✨ Key Features (v3.6.9)
- **Payment Date Future Date Validation**: HTML5 date limits (`max={today}`) and real-time form validation prevent cashiers/accountants from selecting future payment dates when recording or updating payments.
- **Chronological Prior Payment Lookup & Multi-Month Carry-Over**: Evaluates the student's entire fee ledger to retrieve the chronologically preceding paid or partially-paid transaction in the `LAST PAYMENT DETAIL` section.
- **Cashier Fillable Receipt Fields**: Provides clean pen-writing lines (`Pay Date:`, `Paid:`, `Bal.:`) on printed monthly challans so cashiers can fill them by hand at the counter, which then print automatically once entered into the app.
- **Clarified Discount Amount (D.A.) Labels**: Explicitly labeled `Discount Amount (D.A.)` and `Discount (D.A.)` across fee breakdown tables.
- **Ink-Friendly Soft Theme**: Soft slate header banners (`bg-slate-700` / `bg-slate-600`) and high-contrast light table headers (`bg-slate-200`) for clear readability and optimal printer ink usage.
- **Desk Scan QR Code Integration**: Embedded QR codes on printable fee challans containing student ID, payment due date, total amount, and challan ID for fast scanning at the school's account desk.
- **Direct Challan Printing**: Convenient 1-click single challan print previews directly from Fee Collection and Fee History.
- **Zero-Config Sandbox Fallback**: Seamless, crash-free execution using an advanced client-side SQLite-on-Dexie translation layer if `VITE_NEON_DATABASE_URL` is omitted.
- **Auto-Seeded Demo Mode**: Instantly launches pre-loaded test data (Oakridge School) for easy testing and exploration of Owner, Admin, Accountant, Teacher, and Student roles.
- **Automatic Live Update Engine**: Intelligent checking against the static release registry to prompt users whenever a new update is deployed.
- **Hybrid Sync**: Active replication support for Offline-First (Dexie.js) and Online-Only database states.
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
- A [Neon](https://neon.tech/) account

### 2. Environment Variables
- `VITE_NEON_DATABASE_URL`: Your Neon connection string.
- `VITE_GOOGLE_CLIENT_ID`: Your Google OAuth 2.0 Client ID.

---

## 🗄️ Neon Schema (SQL)
To ensure all features work correctly, run the SQL commands in `schema.sql` within your Neon SQL Editor. This will create the necessary tables for profiles, schools, students, fees, and announcements.
