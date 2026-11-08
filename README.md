# EduSync - Student Record & School Management System

**EduSync** is a modern, high-performance web application designed for single-school administration with multi-branch support. Built for speed, reliability, and security, it manages student enrollments, attendance, fee generation, cashier collection, examination results, academic progress, and institutional reporting.

---

## 🚀 Tech Stack

- **Frontend**: React 18 (SPA), TypeScript, Tailwind CSS, Lucide React, QR Code React
- **Build & Bundler**: Vite (custom manual chunks code splitting, PWA Service Worker & Web Manifest)
- **Backend**: Node.js & Express API proxy with gzip compression
- **Database**: PostgreSQL on [Neon](https://neon.tech/) using `@neondatabase/serverless`
- **Authentication**: Salted `bcryptjs` password hashing, JWT signed session tokens in `httpOnly`, `SameSite=Strict` cookies, and database rate-limited login defense

---

## ⚙️ Environment Variables

Create a `.env` file in the project root with the following variables:

```bash
# PostgreSQL connection string (Neon Serverless)
DATABASE_URL=postgresql://user:password@ep-sample-pooler.region.neon.tech/neondb?sslmode=require

# Secret key used for signing JWT session cookies (at least 32 characters)
SESSION_SECRET=your-random-32-character-secret-key-here
```

---

## 🛠️ CLI Commands

| Command | Description |
|---|---|
| `npm run dev` | Starts the Express server with Vite middleware in local development mode on port 3000 |
| `npm run build` | Compiles serverless Express handler with esbuild, typechecks with tsc, and builds Vite frontend |
| `npm run setup` | Interactive first-run setup script to initialize school, owner profile, fee heads, and migration records |
| `npm run migrate` | Inspects and runs pending SQL migration files from the `migrations/` directory |
| `npm run backup` | Dumps database tables into a timestamped, keyset-paginated JSON file in `backups/` |
| `npm run restore -- <file>` | Restores a backup file in foreign-key topological order within a single atomic transaction |
| `npm run load-test` | Benchmarks response sizes and execution speeds on a throwaway Neon branch (`LOAD_TEST_OK=yes`) |

---

## 📁 Project Structure

```
├── api/                    # Vercel serverless function entry (api/index.js)
├── backups/                # Local CLI backup dump directory (.gitignored)
├── migrations/             # Incremental SQL migration scripts
├── public/                 # Static assets, PWA manifest, service worker (sw.js), icons
├── scripts/                # CLI automation (setup.ts, migrate.ts, backup.ts, restore.ts, load-test.ts)
├── src/
│   ├── components/         # Modular React UI components
│   │   ├── attendance/     # Attendance marker and historical viewer
│   │   ├── auth/           # Login, registration, password recovery views
│   │   ├── classes/        # Class management, promotion, graduation modal
│   │   ├── common/         # Avatars, modals, toast alerts, update checker
│   │   ├── dashboard/      # Role-tailored dashboards (Admin, Accountant, Teacher, Parent, Student)
│   │   ├── fees/           # Fee collection, challan generator, fee structures
│   │   ├── layout/         # Header, sidebar, responsive layout with offline banner
│   │   ├── reports/        # Report cards, class lists, defaulters, fee collection
│   │   ├── results/        # Exam grading and result entry
│   │   ├── settings/       # School profile, branch manager, in-app backup download
│   │   └── students/       # Student directory, profile page, leaving certificates
│   ├── context/            # Global React state (Auth, Data, Sync, Notification, Toast)
│   ├── server/             # Server routes, database access, session resolver, write handlers
│   └── types.ts            # TypeScript data contracts and role definitions
├── schema.sql              # Master PostgreSQL schema definition
└── server.ts               # Local Express development and production server
```
