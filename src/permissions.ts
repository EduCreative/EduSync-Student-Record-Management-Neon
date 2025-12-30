
import { UserRole } from './types';

export enum Permission {
  // School Management (Owner Only)
  CAN_MANAGE_SCHOOLS = 'CAN_MANAGE_SCHOOLS',
  CAN_DELETE_SCHOOLS = 'CAN_DELETE_SCHOOLS',

  // User Management
  CAN_MANAGE_USERS = 'CAN_MANAGE_USERS',
  CAN_DELETE_USERS = 'CAN_DELETE_USERS',

  // Student Management
  CAN_VIEW_STUDENTS = 'CAN_VIEW_STUDENTS',
  CAN_EDIT_STUDENTS = 'CAN_EDIT_STUDENTS',
  CAN_DELETE_STUDENTS = 'CAN_DELETE_STUDENTS',
  CAN_PROMOTE_STUDENTS = 'CAN_PROMOTE_STUDENTS',
  CAN_GENERATE_ID_CARDS = 'CAN_GENERATE_ID_CARDS',

  // Class Management
  CAN_VIEW_CLASSES = 'CAN_VIEW_CLASSES',
  CAN_EDIT_CLASSES = 'CAN_EDIT_CLASSES',
  CAN_DELETE_CLASSES = 'CAN_DELETE_CLASSES',

  // Fee & Financial Management
  CAN_MANAGE_FEES = 'CAN_MANAGE_FEES',
  CAN_MANAGE_FEE_HEADS = 'CAN_MANAGE_FEE_HEADS',
  CAN_VIEW_FINANCIAL_REPORTS = 'CAN_VIEW_FINANCIAL_REPORTS',
  CAN_SEND_FEE_REMINDERS = 'CAN_SEND_FEE_REMINDERS',

  // Academic Management
  CAN_MANAGE_ATTENDANCE = 'CAN_MANAGE_ATTENDANCE',
  CAN_MANAGE_RESULTS = 'CAN_MANAGE_RESULTS',
  CAN_VIEW_ACADEMIC_REPORTS = 'CAN_VIEW_ACADEMIC_REPORTS',

  // Communication
  CAN_SEND_ANNOUNCEMENTS = 'CAN_SEND_ANNOUNCEMENTS',
}

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.Owner]: Object.values(Permission), // Owner has all permissions

  [UserRole.Admin]: [
    Permission.CAN_MANAGE_USERS,
    Permission.CAN_DELETE_USERS,
    Permission.CAN_VIEW_STUDENTS,
    Permission.CAN_EDIT_STUDENTS,
    Permission.CAN_DELETE_STUDENTS,
    Permission.CAN_VIEW_CLASSES,
    Permission.CAN_EDIT_CLASSES,
    Permission.CAN_DELETE_CLASSES,
    Permission.CAN_MANAGE_FEES,
    Permission.CAN_MANAGE_FEE_HEADS,
    Permission.CAN_VIEW_FINANCIAL_REPORTS,
    Permission.CAN_SEND_FEE_REMINDERS,
    Permission.CAN_MANAGE_ATTENDANCE,
    Permission.CAN_MANAGE_RESULTS,
    Permission.CAN_VIEW_ACADEMIC_REPORTS,
    Permission.CAN_GENERATE_ID_CARDS,
    Permission.CAN_PROMOTE_STUDENTS,
    Permission.CAN_SEND_ANNOUNCEMENTS,
  ],

  [UserRole.Accountant]: [
    Permission.CAN_MANAGE_FEES,
    Permission.CAN_VIEW_FINANCIAL_REPORTS,
    Permission.CAN_VIEW_STUDENTS, // To see student names for fees
    Permission.CAN_SEND_FEE_REMINDERS,
  ],
  
  [UserRole.Teacher]: [
    Permission.CAN_MANAGE_ATTENDANCE,
    Permission.CAN_MANAGE_RESULTS,
    Permission.CAN_VIEW_STUDENTS, // To see students in their class
    Permission.CAN_VIEW_CLASSES,
    Permission.CAN_SEND_ANNOUNCEMENTS,
  ],

  [UserRole.Parent]: [], // View-only logic is handled by data filtering
  [UserRole.Student]: [], // View-only logic is handled by data filtering
};
