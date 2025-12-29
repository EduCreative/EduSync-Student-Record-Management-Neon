# EduSync User Manual

Welcome to the EduSync Student Record Management System! This guide will walk you through the key features and functionalities of the application to help you get started.

## 1. Introduction

EduSync is a modern, all-in-one platform designed to streamline school administration. It helps manage student records, finances, attendance, and academic results through a user-friendly, role-based interface.

## 2. Getting Started

### 2.1. Logging In
- Navigate to the application's URL.
- Enter the email address and password associated with your account.
- Click **"Sign In"**. If you have forgotten your password, use the **"Forgot password?"** link to receive reset instructions via email.

### 2.2. The Interface
The application is divided into three main areas:
1.  **Sidebar (Left):** Your primary navigation tool. It displays all the modules and pages you have permission to access.
2.  **Header (Top):** Contains the school name/logo, notification bell, theme switcher, and your user profile menu (for accessing settings and logging out).
3.  **Main Content Area:** This is where the main content of the selected page is displayed, such as your dashboard, data tables, or forms.

## 3. User Roles & Dashboards

EduSync has six user roles, each with a tailored dashboard and specific permissions.

- **Owner:** Can manage multiple schools, oversee all system users, and has full administrative privileges. The dashboard provides a high-level overview of all schools.
- **Admin:** Manages a single school's operations, including students, staff, classes, finances, and reporting. The dashboard is interactive, allowing you to click on charts to see detailed data.
- **Accountant:** Manages fee collection, generates financial reports, and handles fee challan creation.
- **Teacher:** Manages assigned classes, takes daily attendance, and enters student exam results.
- **Parent:** Can view their children's profiles, attendance records, exam results, and fee status.
- **Student:** Can view their own dashboard, attendance, results, and fee status.

## 4. How-To Guides: Core Modules

### 4.1. User Management (Admin/Owner)
-   **Navigate:** Click **"User Accounts"** or **"Users"** in the sidebar.
-   **Add a User:** Click the **"+ Add User"** button and fill in the form with the user's name, email, role, and a temporary password.
-   **Edit a User:** Click the **"Edit"** button on any user's row to update their details, status, or permissions.
-   **Approve a User:** New users (except Owners) register with a "Pending Approval" status. Admins can edit the user and change their status to "Active" to grant them access.
-   **Import Users:** Click **"Import CSV"** to bulk-upload new users. Download the sample template to ensure your file is formatted correctly.

### 4.2. Student Management (Admin)
-   **Navigate:** Click **"Students"** in the sidebar.
-   **Add a Student:** Click **"+ Add Student"** and complete the comprehensive student profile form.
-   **View Profile:** Click the **"View"** button on a student's row to see their full profile, including academic, financial, and attendance history.
-   **Import Students:** Use the **"Import CSV"** button for bulk enrollment.

### 4.3. Fee Management (Accountant/Admin)
-   **Navigate:** Click **"Fee Management"** in the sidebar.
-   **Manage Fee Heads:** Go to the **"Fee Heads"** tab to create or edit fee categories (e.g., "Tuition Fee," "Lab Fee") and their default amounts.
-   **Generate Challans:**
    1.  Go to the **"Challan Generation"** tab.
    2.  Select the month and year.
    3.  Check the fee heads you want to include and adjust amounts if necessary.
    4.  Click **"Generate Challans"**. This creates challans for all active students.
-   **Record a Payment:**
    1.  Go to the **"Fee Collection"** tab.
    2.  Search for a student by name or roll number.
    3.  A list of their outstanding challans will appear.
    4.  Click **"Record Payment"** on the relevant challan, enter the amount paid, and confirm.

### 4.4. Attendance (Teacher/Admin)
-   **Navigate:** Click **"Attendance"** in the sidebar.
-   **Mark Attendance:**
    1.  Select the class and date.
    2.  A list of students will appear. By default, all are marked "Present."
    3.  Click the status button for any student to cycle through "Present," "Absent," and "Leave."
    4.  Use the "Mark All" buttons for quick changes.
    5.  Click **"Save Attendance"** when finished.

### 4.5. Results (Teacher/Admin)
-   **Navigate:** Click **"Results"** in the sidebar.
-   **Enter Results:**
    1.  Select the class, exam type (e.g., "Mid-Term"), and subject.
    2.  Enter the marks obtained and total marks for each student.
    3.  Click **"Save Results"**.

## 5. Reporting

-   **Navigate:** Click **"Reports"** in the sidebar.
-   **Generate a Report:**
    1.  Find the report you need (e.g., "Fee Defaulter Report").
    2.  Click **"Generate Report &rarr;"**.
    3.  A modal will appear with options (e.g., date range, class filter).
    4.  Set your desired options. The modal will show a summary of the data found.
-   **Print / Save as PDF:** Click **"Print Preview"**. A new view will open. You can use your browser's print dialog to either print the document or save it as a PDF file.
-   **Export to CSV:** Click **"Export CSV"** to download the report data as a spreadsheet file, which can be opened in applications like Microsoft Excel or Google Sheets.

## 6. Settings & Personalization

-   **Navigate:** Click your profile picture in the top-right header, then select **"Settings"** or **"My Profile"**.
-   **Update Your Profile:** In the **"My Profile"** page, you can change your full name and upload a new profile picture.
-   **Change Password:** Use the "Change Password" section to set a new password for your account.
-   **Appearance:** In **"Settings"**, you can switch between Light and Dark mode or adjust the application's font size for better readability.
-   **Data Management (Admin):** Admins can back up all school data to a JSON file or restore from a backup file. **Warning:** Restoring data is a destructive action and will overwrite existing data.

---

For any issues not covered in this manual, please contact your system administrator.