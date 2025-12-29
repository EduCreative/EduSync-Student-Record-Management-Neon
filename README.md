
# EduSync - Modern Student Record Management System (Neon Edition)

**EduSync** is now powered by **Neon Serverless Postgres**, providing a more reliable and responsive data layer that eliminates the manual "hibernation" issues of traditional free-tier databases.

---

## ✨ Key Migration Updates
- **Neon Integration**: Replaced Supabase with Neon for Postgres storage.
- **Improved Availability**: Automatic wakeup on requests—no more manual unpausing.
- **Custom Auth**: Direct Postgres-based user management.

## 🚀 Setup and Installation

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (version 18 or higher)
- A [Neon](https://neon.tech/) account (Free tier)

### 2. Neon Configuration
1. **Create a Neon Project**: Navigate to Neon dashboard and create a project.
2. **Database Connection**: Copy your `DATABASE_URL`.
3. **Initialize Schema**: Run the SQL commands in the "Supabase Database Schema" section (now Neon Schema) in your Neon SQL Editor.

### 3. Local Setup
1. Update your `.env` file:
   ```
   VITE_NEON_DATABASE_URL=postgres://user:pass@ep-hostname.region.aws.neon.tech/neondb?sslmode=require
   ```

---

## 🏗️ Architecture
- **Database**: Neon Serverless Postgres
- **Offline Sync**: Dexie.js (IndexedDB)
- **Frontend**: React + Vite
