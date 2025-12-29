
# EduSync - Modern Student Record Management System (Neon Edition)

**EduSync** is now powered 100% by **Neon Serverless Postgres**, providing a unified data and storage layer that eliminates the manual "hibernation" issues of other free-tier platforms.

---

## ✨ Key Features
- **All-in-One Database**: Everything (Data + User Authentication + Image storage as Base64) lives in your Neon database.
- **Improved Availability**: Automatic wakeup on requests—no more manual unpausing.
- **Role-Based Access**: Owner, Admin, Accountant, Teacher, Parent, and Student roles.
- **Offline Sync**: Leverages Dexie.js for lightning-fast performance even with unstable connections.

## 🚀 Setup and Installation

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (version 18 or higher)
- A [Neon](https://neon.tech/) account

### 2. Neon Configuration
1. **Create a Neon Project**: Navigate to the Neon dashboard and create a new project.
2. **Database Connection**: 
   - On your Neon Dashboard, look for the **Connection Details** box.
   - Select **"Pooled connection"** from the dropdown.
   - Copy the connection string.
3. **Set Environment Variable**:
   Create or update your `.env` file with your connection string:
   ```
   VITE_NEON_DATABASE_URL=postgresql://user:pass@ep-hostname.region.aws.neon.tech/neondb?sslmode=require
   ```

### 3. Initialize Schema
Run the SQL commands in the "Neon Schema" section below in your Neon **SQL Editor**.

---

## 🏗️ Architecture
- **Database**: Neon Serverless Postgres
- **Image Handling**: Local compression to Base64 (stored in Postgres `TEXT` columns)
- **Offline Sync**: Dexie.js (IndexedDB)
- **Frontend**: React + Vite

---

## 🗄️ Neon Schema (SQL)

Run these commands in your Neon SQL Editor to set up the database:

```sql
-- Profiles table (Handles Users and Auth)
CREATE TABLE profiles (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT, 
  role TEXT NOT NULL,
  school_id UUID,
  status TEXT DEFAULT 'Pending Approval',
  avatar_url TEXT, -- Base64 encoded image
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  disabled_nav_links JSONB DEFAULT '[]',
  permissions_overrides JSONB DEFAULT '{}'
);

-- Schools table
CREATE TABLE schools (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT,
  logo_url TEXT, -- Base64 encoded image
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Classes table
CREATE TABLE classes (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  section TEXT,
  teacher_id UUID REFERENCES profiles(id),
  school_id UUID REFERENCES schools(id),
  sort_order INTEGER DEFAULT 0
);

-- Students table
CREATE TABLE students (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  roll_number TEXT NOT NULL,
  class_id UUID REFERENCES classes(id),
  school_id UUID REFERENCES schools(id),
  father_name TEXT,
  father_cnic TEXT,
  date_of_birth DATE,
  date_of_admission DATE,
  contact_number TEXT,
  secondary_contact_number TEXT,
  address TEXT,
  status TEXT DEFAULT 'Active',
  gender TEXT,
  admitted_class TEXT,
  gr_number TEXT,
  religion TEXT,
  caste TEXT,
  last_school_attended TEXT,
  opening_balance NUMERIC DEFAULT 0,
  user_id UUID REFERENCES profiles(id),
  avatar_url TEXT, -- Base64 encoded image
  fee_structure JSONB DEFAULT '[]',
  date_of_leaving DATE,
  reason_for_leaving TEXT,
  conduct TEXT,
  progress TEXT,
  place_of_birth TEXT
);

-- Fee Challans table
CREATE TABLE fee_challans (
  id UUID PRIMARY KEY,
  challan_number TEXT UNIQUE NOT NULL,
  student_id UUID REFERENCES students(id),
  class_id UUID REFERENCES classes(id),
  month TEXT NOT NULL,
  year INTEGER NOT NULL,
  due_date DATE,
  status TEXT DEFAULT 'Unpaid',
  fee_items JSONB DEFAULT '[]',
  previous_balance NUMERIC DEFAULT 0,
  total_amount NUMERIC DEFAULT 0,
  discount NUMERIC DEFAULT 0,
  paid_amount NUMERIC DEFAULT 0,
  paid_date DATE,
  payment_history JSONB DEFAULT '[]'
);

-- Attendance table
CREATE TABLE attendance (
  id UUID PRIMARY KEY,
  student_id UUID REFERENCES students(id),
  date DATE NOT NULL,
  status TEXT NOT NULL,
  UNIQUE(student_id, date)
);

-- Results table
CREATE TABLE results (
  id UUID PRIMARY KEY,
  student_id UUID REFERENCES students(id),
  class_id UUID REFERENCES classes(id),
  exam TEXT NOT NULL,
  subject TEXT NOT NULL,
  marks NUMERIC DEFAULT 0,
  total_marks NUMERIC DEFAULT 100,
  UNIQUE(student_id, class_id, exam, subject)
);

-- Fee Heads table
CREATE TABLE fee_heads (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  default_amount NUMERIC DEFAULT 0,
  school_id UUID REFERENCES schools(id)
);

-- School Events table
CREATE TABLE school_events (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL,
  date DATE NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  school_id UUID REFERENCES schools(id)
);

-- Activity Logs table
CREATE TABLE activity_logs (
  id UUID PRIMARY KEY,
  user_id UUID,
  user_name TEXT,
  user_avatar TEXT,
  school_id UUID,
  action TEXT,
  details TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Subjects table
CREATE TABLE subjects (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  school_id UUID REFERENCES schools(id)
);

-- Exams table
CREATE TABLE exams (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  school_id UUID REFERENCES schools(id)
);

-- Notifications table
CREATE TABLE notifications (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);
```
