# EduSync: Comprehensive User Manual (v3.40.0)

Welcome to **EduSync**, the school administration and student record management platform. This manual provides role-by-role guidance, financial operating procedures, academic tracking, and operational instructions.

---

## 1. 🔑 Access, Roles & Security

EduSync serves a single institution with optional campus branches. Access is partitioned using Role-Based Access Control (RBAC):

- **Owner**: Full institutional control. Manages campus branches, school profile details, administrative credentials, fee structures, and full database backups.
- **Admin**: Day-to-day school administration. Manages student enrollments, promotions, staff accounts, class assignments, and operational reports.
- **Accountant**: Dedicated financial management. Manages monthly fee challan generation, cashier desk collection, partial payments, and financial ledgers.
- **Teacher**: Academic operations. Marks student daily attendance, records exam marks, and tracks class performance.
- **Parent**: Family portal. Monitors attendance records, examination grades, and fee challans for their enrolled children.
- **Student**: Personal student portal. Accesses attendance history, report cards, and fee status.

Authentication is secured via database-backed password hashing (`bcrypt`), rate-limited login defense, and session cookies.

---

## 2. 🏛️ Branches & Campus Management

If your school operates across multiple campuses, you can organize classes by branch:

1. Navigate to **Settings > Campus Branches**.
2. Add new branches with names and addresses (e.g., "Main Campus", "Junior Campus").
3. Assign classes to specific branches via **Class Management**.
4. Filter students, classes, and fee records by branch across administrative screens.

*Note: A branch cannot be deleted if active classes remain assigned to it.*

---

## 3. 👥 Student Lifecycle & Profiles

### 3.1 Enrollment & ID Assignment
- Register students using **Student Management > "+ Add Student"** or bulk import records via CSV.
- Student IDs (`rollNumber`) are auto-generated or manually specified.
- Optional family link: Associate registered parent accounts with student profiles.

### 3.2 Student Profile Actions
- **View Report Card**: Directly opens the student's pre-filled report card modal for any exam term.
- **View Fee History**: Inspects all historical challans, payments, discounts, and current dues.
- **Reactivate Student**: If a student's status is marked as "Left", administrators can click **Reactivate Student** to restore them to "Active" status without altering historical records.
- **Issue / Reprint Leaving Certificate**: Produces standardized departure documentation.

### 3.3 Class Promotion & Rollback Safety
- End-of-year class promotions move students safely to subsequent grade levels.
- If a promotion needs to be reverted, administrators can restore the exact pre-promotion snapshot using the **Rollback Promotion** tool.

---

## 4. 💰 Financial Management & Fee Collection

### 4.1 Ledger & Arrears Architecture
- EduSync enforces a strict balance-forward ledger: unpaid dues carry over to future challans.
- Current-month challan generation strictly prevents double-counting arrears from unbilled future months.

### 4.2 Fee Collection & Cashier Desk
- Access **Fee Management > Fee Collection** on desktop or mobile.
  - **Desktop**: Fast 9-column tabular register with instant status filtering and sorting.
  - **Mobile**: Responsive touch-friendly card view showing student photo, roll number, class, due dates, outstanding dues, and action buttons.
- **Recording Payments**:
  - Click **Record Payment** to record cash, bank, or online receipts.
  - Overpayment guards guarantee payments cannot exceed total outstanding dues.
  - Payments are committed atomically to prevent concurrent overwrites.
- **Single & Bulk Printing**:
  - Print individual challans or generate bulk runs with configurable copies (2 or 3 copies) and challans per A4 sheet (1, 2, or 3 per page).

---

## 5. 📋 Academic Progress & Attendance

### 5.1 Attendance
- Teachers and administrators select class and date, cycling student statuses (**Present**, **Absent**, **Leave**) with 1 click or batch buttons.
- If network connectivity is lost during submission, buttons automatically revert to the saved state with a notification.

### 5.2 Examination Results & Report Cards
- Enter subject-wise marks in **Examination Results**.
- Open **Reports > Student Report Cards** or click **View Report Card** from any student profile to generate branded report cards.

---

## 6. 💾 Database Backup & Disaster Recovery

### 6.1 In-App "Download Full Backup"
Institutional Owners can export complete database backups at any time:
1. Log in with an **Owner** account.
2. Navigate to **Settings > Database Backup & Recovery**.
3. Click **Download Full Backup**.
4. The system streams records from all database tables and downloads a structured, timestamped JSON archive.

### 6.2 CLI Restore
To restore data into a clean database, administrators run the command line tool:
```bash
npm run restore -- backups/edusync-YYYYMMDD-HHmmss.json
```
The restore script verifies foreign key topological dependency order and executes inside an atomic database transaction.

---

## 7. 📱 Mobile PWA & Offline Support

- **PWA Installation**: EduSync is installable as a Progressive Web App on Android, iOS, and desktop browsers.
- **Offline Reliability**: If network connection drops, an offline status banner alerts the user: *"You are offline. Records cannot be saved until the connection returns."* The application shell remains loaded.
- **Live Updates**: When a new version is published, an in-app notification prompts you to update and reload seamlessly.

---
*EduSync Support & Administration: Contact your system administrator or kmasroor50@gmail.com.*
