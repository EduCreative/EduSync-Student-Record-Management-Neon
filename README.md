
# EduSync - Modern Student Record Management System (Neon Edition)

**EduSync** is a high-performance school management platform powered 100% by **Neon Serverless Postgres**.

---

## ✨ Key Features (v3.5.5)
- **Hybrid Sync**: Support for Offline-First (Dexie.js) and Online-Only database modes.
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
