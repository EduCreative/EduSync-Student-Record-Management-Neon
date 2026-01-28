
-- Profiles table for all user roles
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL, -- 'Owner', 'Admin', 'Accountant', 'Teacher', 'Parent', 'Student'
    school_id UUID REFERENCES schools(id),
    status TEXT DEFAULT 'Active',
    avatar_url TEXT,
    last_login TIMESTAMP WITH TIME ZONE,
    child_student_ids UUID[] DEFAULT '{}',
    disabled_nav_links TEXT[] DEFAULT '{}',
    permissions_overrides JSONB DEFAULT '{}'
);

-- Schools table
CREATE TABLE IF NOT EXISTS schools (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    logo_url TEXT
);

-- Classes table
CREATE TABLE IF NOT EXISTS classes (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    section TEXT,
    teacher_id UUID REFERENCES profiles(id),
    school_id UUID REFERENCES schools(id) NOT NULL,
    sort_order INTEGER DEFAULT 0
);

-- Subjects table
CREATE TABLE IF NOT EXISTS subjects (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    school_id UUID REFERENCES schools(id) NOT NULL
);

-- Exams table
CREATE TABLE IF NOT EXISTS exams (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    school_id UUID REFERENCES schools(id) NOT NULL
);

-- Students table
CREATE TABLE IF NOT EXISTS students (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES profiles(id),
    name TEXT NOT NULL,
    class_id UUID REFERENCES classes(id) NOT NULL,
    school_id UUID REFERENCES schools(id) NOT NULL,
    roll_number TEXT NOT NULL,
    gr_number TEXT,
    religion TEXT,
    avatar_url TEXT,
    father_name TEXT NOT NULL,
    father_cnic TEXT,
    date_of_birth DATE,
    date_of_admission DATE,
    contact_number TEXT NOT NULL,
    secondary_contact_number TEXT,
    address TEXT,
    status TEXT DEFAULT 'Active',
    gender TEXT NOT NULL,
    date_of_leaving DATE,
    reason_for_leaving TEXT,
    conduct TEXT,
    progress TEXT,
    place_of_birth TEXT,
    opening_balance NUMERIC DEFAULT 0,
    fee_structure JSONB DEFAULT '[]',
    admitted_class TEXT,
    caste TEXT,
    last_school_attended TEXT
);

-- Attendance table
CREATE TABLE IF NOT EXISTS attendance (
    id UUID PRIMARY KEY,
    student_id UUID REFERENCES students(id) NOT NULL,
    date DATE NOT NULL,
    status TEXT NOT NULL, -- 'Present', 'Absent', 'Leave'
    UNIQUE(student_id, date)
);

-- Fee Heads table
CREATE TABLE IF NOT EXISTS fee_heads (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    default_amount NUMERIC NOT NULL,
    school_id UUID REFERENCES schools(id) NOT NULL
);

-- Fee Challans table
CREATE TABLE IF NOT EXISTS fee_challans (
    id UUID PRIMARY KEY,
    challan_number TEXT NOT NULL,
    student_id UUID REFERENCES students(id) NOT NULL,
    class_id UUID REFERENCES classes(id) NOT NULL,
    month TEXT NOT NULL,
    year INTEGER NOT NULL,
    due_date DATE,
    status TEXT DEFAULT 'Unpaid', -- 'Paid', 'Unpaid', 'Partial', 'Cancelled'
    fee_items JSONB NOT NULL,
    previous_balance NUMERIC DEFAULT 0,
    total_amount NUMERIC NOT NULL,
    discount NUMERIC DEFAULT 0,
    paid_amount NUMERIC DEFAULT 0,
    paid_date DATE,
    payment_history JSONB DEFAULT '[]',
    fine_amount NUMERIC DEFAULT 0
);

-- Results table
CREATE TABLE IF NOT EXISTS results (
    id UUID PRIMARY KEY,
    student_id UUID REFERENCES students(id) NOT NULL,
    class_id UUID REFERENCES classes(id) NOT NULL,
    exam TEXT NOT NULL,
    subject TEXT NOT NULL,
    marks NUMERIC NOT NULL,
    total_marks NUMERIC NOT NULL,
    UNIQUE(student_id, class_id, exam, subject)
);

-- Activity Logs table
CREATE TABLE IF NOT EXISTS activity_logs (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) NOT NULL,
    user_name TEXT NOT NULL,
    user_avatar TEXT,
    school_id UUID REFERENCES schools(id) NOT NULL,
    action TEXT NOT NULL,
    details TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- School Events table
CREATE TABLE IF NOT EXISTS school_events (
    id UUID PRIMARY KEY,
    title TEXT NOT NULL,
    date DATE NOT NULL,
    category TEXT NOT NULL, -- 'Holiday', 'Exam', 'Event', 'Meeting'
    description TEXT,
    school_id UUID REFERENCES schools(id) NOT NULL
);

-- Notifications (Announcements) table
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    link TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
