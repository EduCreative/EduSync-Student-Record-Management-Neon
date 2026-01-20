
# EduSync - Modern Student Record Management System (Neon Edition)

**EduSync** is a high-performance school management platform powered 100% by **Neon Serverless Postgres**. It offers a robust feature set for school owners, administrators, accountants, teachers, parents, and students.

---

## ✨ Key Features (v3.3.8)
- **Intelligent Dashboards**: Real-time insights into fee recovery, attendance, and student distribution.
- **Advanced Financial Engine**: Multi-part challan generation, partial payment tracking, and automated discount reporting.
- **Academic Suite**: Class management with student promotion logic, result cards, and attendance tracking.
- **Modern Communication**: Targeted announcements and real-time notification center.
- **Enterprise Reporting**: Professional PDF-ready printouts for report cards, certificates, and financial ledgers.
- **Hybrid Sync**: Support for Offline-First (Dexie.js) and Online-Only database modes.
- **Google Drive Backup**: Securely save snapshots to your personal cloud.

---

## 🚀 Setup and Installation

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (version 18 or higher)
- A [Neon](https://neon.tech/) account

### 2. Neon Configuration
1. **Create a Neon Project**: Navigate to the Neon dashboard and create a new project.
2. **Database Connection**: 
   - Select **"Pooled connection"** from the dropdown.
   - Copy the connection string.
3. **Set Environment Variable**:
   Set `VITE_NEON_DATABASE_URL` in your deployment environment.

### 3. Initialize Schema
Run the SQL commands provided at the end of this file in your Neon **SQL Editor**.

---

## 🗄️ Neon Schema (SQL)
*(Refer to the end of this file for the full SQL schema used for profiles, students, fee_challans, results, and more.)*
