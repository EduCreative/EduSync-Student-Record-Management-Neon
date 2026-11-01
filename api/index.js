// src/server/index.ts
import express from "express";

// src/server/apiRouter.ts
import { Router } from "express";

// src/server/handlers/auth/login.ts
import bcrypt from "bcryptjs";

// src/server/_db.ts
import { neon } from "@neondatabase/serverless";
import jwt from "jsonwebtoken";
var SESSION_SECRET = process.env.SESSION_SECRET || "edusync_session_secret_default_key_change_in_production_2026";
var COOKIE_NAME = "edusync_session";
var getDatabaseUrl = () => {
  return process.env.DATABASE_URL || "";
};
var getDb = () => {
  const url = getDatabaseUrl();
  if (!url) {
    throw new Error("DATABASE_URL is not configured in server environment.");
  }
  return neon(url);
};
function signToken(payload) {
  return jwt.sign(payload, SESSION_SECRET, { expiresIn: "12h" });
}
function verifyToken(token) {
  try {
    return jwt.verify(token, SESSION_SECRET);
  } catch {
    return null;
  }
}
function parseCookies(req) {
  const header = req.headers?.cookie || req.headers?.Cookie || "";
  if (!header || typeof header !== "string") return {};
  const cookies = {};
  const pairs = header.split(";");
  for (const pair of pairs) {
    const trimmed = pair.trim();
    if (!trimmed) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      try {
        cookies[key] = decodeURIComponent(val);
      } catch {
        cookies[key] = val;
      }
    }
  }
  return cookies;
}
function serializeCookie(name, val, options = {}) {
  let cookie = `${encodeURIComponent(name)}=${encodeURIComponent(val)}`;
  if (options.maxAge !== void 0) {
    cookie += `; Max-Age=${Math.floor(options.maxAge)}`;
  }
  if (options.path) {
    cookie += `; Path=${options.path}`;
  }
  if (options.httpOnly) {
    cookie += `; HttpOnly`;
  }
  if (options.secure) {
    cookie += `; Secure`;
  }
  if (options.sameSite) {
    cookie += `; SameSite=${options.sameSite.charAt(0).toUpperCase() + options.sameSite.slice(1).toLowerCase()}`;
  }
  return cookie;
}
function extractToken(req) {
  const cookies = parseCookies(req);
  if (cookies[COOKIE_NAME]) {
    return cookies[COOKIE_NAME];
  }
  const authHeader = req.headers?.authorization || req.headers?.Authorization;
  if (authHeader && typeof authHeader === "string" && authHeader.toLowerCase().startsWith("bearer ")) {
    return authHeader.substring(7).trim();
  }
  return null;
}
function authenticateRequest(req) {
  const token = extractToken(req);
  if (!token) return null;
  return verifyToken(token);
}
function setSessionCookie(res, token) {
  const isProd = process.env.NODE_ENV === "production";
  const cookieStr = serializeCookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: "strict",
    path: "/",
    maxAge: 12 * 60 * 60
    // 12 hours
  });
  res.setHeader("Set-Cookie", cookieStr);
}
function clearSessionCookie(res) {
  const isProd = process.env.NODE_ENV === "production";
  const cookieStr = serializeCookie(COOKIE_NAME, "", {
    httpOnly: true,
    secure: isProd,
    sameSite: "strict",
    path: "/",
    maxAge: 0
  });
  res.setHeader("Set-Cookie", cookieStr);
}
function toCamelCase(obj) {
  if (!obj || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(toCamelCase);
  const newObj = {};
  for (const key of Object.keys(obj)) {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    newObj[camelKey] = toCamelCase(obj[key]);
  }
  return newObj;
}

// src/server/handlers/auth/login.ts
var failedAttempts = /* @__PURE__ */ new Map();
var RATE_LIMIT_WINDOW_MS = 15 * 60 * 1e3;
var MAX_FAILED_ATTEMPTS = 5;
function isRateLimited(email) {
  const record = failedAttempts.get(email);
  if (!record) return false;
  if (Date.now() > record.resetTime) {
    failedAttempts.delete(email);
    return false;
  }
  return record.count >= MAX_FAILED_ATTEMPTS;
}
function recordFailedAttempt(email) {
  const record = failedAttempts.get(email);
  if (!record || Date.now() > record.resetTime) {
    failedAttempts.set(email, {
      count: 1,
      resetTime: Date.now() + RATE_LIMIT_WINDOW_MS
    });
  } else {
    record.count += 1;
  }
}
function clearFailedAttempts(email) {
  failedAttempts.delete(email);
}
async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const email = (body.email || "").trim().toLowerCase();
    const password = body.password || body.pass || "";
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }
    if (isRateLimited(email)) {
      return res.status(429).json({
        error: "Too many failed login attempts. Please try again after 15 minutes."
      });
    }
    const sql = getDb();
    const users = await sql`
            SELECT id, school_id, name, email, password, role, status, 
                   avatar_url, child_student_ids, disabled_nav_links, permissions_overrides, last_login
            FROM profiles 
            WHERE LOWER(email) = LOWER(${email}) 
            LIMIT 1
        `;
    if (!users || users.length === 0) {
      recordFailedAttempt(email);
      return res.status(401).json({ error: "Invalid email or password." });
    }
    const user = users[0];
    if (user.status === "Pending Approval" || user.status === "Pending") {
      return res.status(403).json({ error: "Your account is pending approval by administration." });
    }
    if (user.status === "Suspended" || user.status === "Inactive") {
      return res.status(403).json({ error: "Your account is inactive or suspended. Please contact administration." });
    }
    let isMatch = false;
    const storedPassword = user.password || "";
    if (storedPassword.startsWith("$2a$") || storedPassword.startsWith("$2b$") || storedPassword.startsWith("$2y$")) {
      isMatch = await bcrypt.compare(password, storedPassword);
    } else {
      if (storedPassword === password) {
        isMatch = true;
        try {
          const newHash = await bcrypt.hash(password, 10);
          await sql`UPDATE profiles SET password = ${newHash} WHERE id = ${user.id}`;
        } catch (hashErr) {
          console.error("Auto-upgrade password hashing error:", hashErr);
        }
      }
    }
    if (!isMatch) {
      recordFailedAttempt(email);
      return res.status(401).json({ error: "Invalid email or password." });
    }
    clearFailedAttempts(email);
    try {
      await sql`UPDATE profiles SET last_login = NOW() WHERE id = ${user.id}`;
    } catch (loginTimeErr) {
      console.error("Failed to update last_login:", loginTimeErr);
    }
    const tokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      schoolId: user.school_id || null,
      name: user.name || "",
      avatarUrl: user.avatar_url || ""
    };
    const token = signToken(tokenPayload);
    setSessionCookie(res, token);
    const { password: _p, ...safeUserData } = user;
    const safeUser = toCamelCase(safeUserData);
    return res.status(200).json({
      success: true,
      user: safeUser,
      token
      // Also provided for cross-origin or fallback header authentication
    });
  } catch (err) {
    console.error("Login API error:", err);
    return res.status(500).json({ error: "Server authentication error. Please try again." });
  }
}

// src/server/handlers/auth/me.ts
async function handler2(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }
  try {
    const token = extractToken(req);
    if (!token) {
      return res.status(401).json({ user: null, error: "No active session found" });
    }
    const payload = verifyToken(token);
    if (!payload || !payload.userId) {
      return res.status(401).json({ user: null, error: "Session expired or invalid" });
    }
    const sql = getDb();
    const users = await sql`
            SELECT id, school_id, name, email, role, status, 
                   avatar_url, child_student_ids, disabled_nav_links, permissions_overrides, last_login
            FROM profiles 
            WHERE id = ${payload.userId} 
            LIMIT 1
        `;
    if (!users || users.length === 0) {
      return res.status(401).json({ user: null, error: "User not found" });
    }
    const user = users[0];
    if (user.status === "Suspended" || user.status === "Inactive") {
      return res.status(403).json({ user: null, error: "Account suspended or inactive" });
    }
    const safeUser = toCamelCase(user);
    return res.status(200).json({
      user: safeUser
    });
  } catch (err) {
    console.error("Auth me API error:", err);
    return res.status(500).json({ user: null, error: "Failed to verify session" });
  }
}

// src/server/handlers/auth/logout.ts
async function handler3(req, res) {
  if (req.method !== "POST" && req.method !== "GET") {
    res.setHeader("Allow", ["POST", "GET"]);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }
  try {
    clearSessionCookie(res);
    return res.status(200).json({ success: true, message: "Logged out successfully." });
  } catch (err) {
    console.error("Logout error:", err);
    return res.status(500).json({ error: "Failed to log out." });
  }
}

// src/server/handlers/auth/change-password.ts
import bcrypt2 from "bcryptjs";
async function handler4(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }
  try {
    const token = extractToken(req);
    if (!token) {
      return res.status(401).json({ error: "Unauthorized: No active session" });
    }
    const payload = verifyToken(token);
    if (!payload || !payload.userId) {
      return res.status(401).json({ error: "Unauthorized: Session invalid or expired" });
    }
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const { currentPassword, newPassword, targetUserId } = body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: "New password must be at least 6 characters long." });
    }
    const sql = getDb();
    const userIdToUpdate = targetUserId && targetUserId !== payload.userId ? targetUserId : payload.userId;
    if (userIdToUpdate !== payload.userId && payload.role !== "Owner" && payload.role !== "Admin") {
      return res.status(403).json({ error: "Forbidden: Insufficient permissions to change other user passwords" });
    }
    const users = await sql`
            SELECT id, password, role FROM profiles WHERE id = ${userIdToUpdate} LIMIT 1
        `;
    if (!users || users.length === 0) {
      return res.status(404).json({ error: "User profile not found." });
    }
    const targetUser = users[0];
    if (userIdToUpdate === payload.userId && currentPassword) {
      const storedHash = targetUser.password || "";
      let isCurrentValid = false;
      if (storedHash.startsWith("$2a$") || storedHash.startsWith("$2b$") || storedHash.startsWith("$2y$")) {
        isCurrentValid = await bcrypt2.compare(currentPassword, storedHash);
      } else {
        isCurrentValid = currentPassword === storedHash;
      }
      if (!isCurrentValid) {
        return res.status(400).json({ error: "Current password is incorrect." });
      }
    }
    const hashedNewPassword = await bcrypt2.hash(newPassword, 10);
    await sql`
            UPDATE profiles 
            SET password = ${hashedNewPassword} 
            WHERE id = ${userIdToUpdate}
        `;
    return res.status(200).json({
      success: true,
      message: "Password updated successfully."
    });
  } catch (err) {
    console.error("Change password error:", err);
    return res.status(500).json({ error: "Internal server error changing password." });
  }
}

// src/server/handlers/auth/register.ts
import bcrypt3 from "bcryptjs";
import crypto from "crypto";
async function handler5(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const { name, email, password, role } = body;
    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: "All fields (name, email, password, role) are required." });
    }
    const normalizedEmail = email.trim().toLowerCase();
    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters long." });
    }
    const sql = getDb();
    const existing = await sql`SELECT id FROM profiles WHERE LOWER(email) = LOWER(${normalizedEmail}) LIMIT 1`;
    if (existing.length > 0) {
      return res.status(409).json({ error: "Email is already registered." });
    }
    const hashedPassword = await bcrypt3.hash(password, 10);
    const userId = crypto.randomUUID();
    await sql`
            INSERT INTO profiles (id, name, email, password, role, status)
            VALUES (${userId}, ${name.trim()}, ${normalizedEmail}, ${hashedPassword}, ${role}, 'Pending Approval')
        `;
    return res.status(201).json({ success: true, message: "Account registered successfully." });
  } catch (err) {
    console.error("Register API error:", err);
    return res.status(500).json({ error: "Registration failed. Please try again." });
  }
}

// src/server/handlers/data/index.ts
async function handler6(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }
  try {
    const session = authenticateRequest(req);
    if (!session) {
      return res.status(401).json({ error: "Unauthorized: Session invalid or expired" });
    }
    const sql = getDb();
    const { role, userId, schoolId: userSchoolId } = session;
    const requestedSchoolId = req.query?.schoolId || req.query?.activeSchoolId;
    const isOwner = role === "Owner";
    const isAdmin = role === "Admin";
    const isAccountant = role === "Accountant";
    const isTeacher = role === "Teacher";
    const isParent = role === "Parent";
    const isStudent = role === "Student";
    const effectiveSchoolId = isOwner ? requestedSchoolId || null : userSchoolId;
    let schoolsData = [];
    if (isOwner) {
      schoolsData = await sql`SELECT id, name, address, logo_url FROM schools ORDER BY name ASC`;
    } else if (effectiveSchoolId) {
      schoolsData = await sql`SELECT id, name, address, logo_url FROM schools WHERE id = ${effectiveSchoolId}`;
    }
    let classesData = [];
    let subjectsData = [];
    let examsData = [];
    let feeHeadsData = [];
    let eventsData = [];
    if (isOwner && !effectiveSchoolId) {
      [classesData, subjectsData, examsData, feeHeadsData, eventsData] = await Promise.all([
        sql`SELECT id, name, section, teacher_id, school_id, sort_order FROM classes ORDER BY sort_order ASC, name ASC`,
        sql`SELECT id, name, school_id FROM subjects ORDER BY name ASC`,
        sql`SELECT id, name, school_id FROM exams ORDER BY name ASC`,
        sql`SELECT id, name, default_amount, school_id FROM fee_heads ORDER BY name ASC`,
        sql`SELECT id, title, description, date, category, school_id FROM school_events ORDER BY date ASC`
      ]);
    } else if (effectiveSchoolId) {
      [classesData, subjectsData, examsData, feeHeadsData, eventsData] = await Promise.all([
        sql`SELECT id, name, section, teacher_id, school_id, sort_order FROM classes WHERE school_id = ${effectiveSchoolId} ORDER BY sort_order ASC, name ASC`,
        sql`SELECT id, name, school_id FROM subjects WHERE school_id = ${effectiveSchoolId} ORDER BY name ASC`,
        sql`SELECT id, name, school_id FROM exams WHERE school_id = ${effectiveSchoolId} ORDER BY name ASC`,
        sql`SELECT id, name, default_amount, school_id FROM fee_heads WHERE school_id = ${effectiveSchoolId} ORDER BY name ASC`,
        sql`SELECT id, title, description, date, category, school_id FROM school_events WHERE school_id = ${effectiveSchoolId} ORDER BY date ASC`
      ]);
    }
    let usersData = [];
    if (isOwner) {
      usersData = effectiveSchoolId ? await sql`
                    SELECT id, school_id, name, email, role, status, avatar_url, child_student_ids, disabled_nav_links, permissions_overrides, last_login 
                    FROM profiles 
                    WHERE school_id = ${effectiveSchoolId} OR school_id IS NULL
                    ORDER BY name ASC
                  ` : await sql`
                    SELECT id, school_id, name, email, role, status, avatar_url, child_student_ids, disabled_nav_links, permissions_overrides, last_login 
                    FROM profiles 
                    ORDER BY name ASC
                  `;
    } else if (isAdmin || isAccountant) {
      usersData = await sql`
                SELECT id, school_id, name, email, role, status, avatar_url, child_student_ids, disabled_nav_links, permissions_overrides, last_login 
                FROM profiles 
                WHERE (school_id = ${effectiveSchoolId} OR school_id IS NULL) AND role != 'Owner'
                ORDER BY name ASC
            `;
    } else if (isTeacher) {
      usersData = await sql`
                SELECT id, school_id, name, email, role, status, avatar_url, last_login 
                FROM profiles 
                WHERE school_id = ${effectiveSchoolId} AND role IN ('Admin', 'Accountant', 'Teacher')
                ORDER BY name ASC
            `;
    } else {
      usersData = [];
    }
    let studentsData = [];
    let targetStudentIds = [];
    if (isOwner || isAdmin || isAccountant || isTeacher) {
      studentsData = effectiveSchoolId ? await sql`SELECT * FROM students WHERE school_id = ${effectiveSchoolId} ORDER BY roll_number ASC, name ASC` : await sql`SELECT * FROM students ORDER BY roll_number ASC, name ASC`;
      if (isTeacher) {
        studentsData = studentsData.map((s) => {
          const { father_cnic: _fc, ...safeStudent } = s;
          return safeStudent;
        });
      }
      targetStudentIds = studentsData.map((s) => s.id);
    } else if (isParent) {
      const parentProfile = await sql`SELECT child_student_ids, phone_number, email FROM profiles WHERE id = ${userId} LIMIT 1`;
      let childIds = [];
      if (parentProfile.length > 0) {
        const p = parentProfile[0];
        if (Array.isArray(p.child_student_ids)) {
          childIds = p.child_student_ids;
        } else if (typeof p.child_student_ids === "string") {
          try {
            childIds = JSON.parse(p.child_student_ids);
          } catch {
            childIds = [];
          }
        }
      }
      if (childIds.length > 0) {
        studentsData = await sql`SELECT * FROM students WHERE id = ANY(${childIds}) ORDER BY name ASC`;
      } else {
        studentsData = [];
      }
      targetStudentIds = studentsData.map((s) => s.id);
    } else if (isStudent) {
      studentsData = await sql`SELECT * FROM students WHERE user_id = ${userId} LIMIT 1`;
      targetStudentIds = studentsData.map((s) => s.id);
    }
    let feesData = [];
    let attData = [];
    let resData = [];
    if (targetStudentIds.length > 0) {
      if (!isTeacher) {
        feesData = await sql`
                    SELECT id, challan_number, student_id, class_id, month, year, due_date, fee_items, 
                           previous_balance, total_amount, discount, paid_amount, status, 
                           paid_date, fine_amount, payment_history, created_at
                    FROM fee_challans 
                    WHERE student_id = ANY(${targetStudentIds})
                    ORDER BY year DESC, month DESC
                `;
      }
      [attData, resData] = await Promise.all([
        sql`SELECT id, student_id, date, status, school_id FROM attendance WHERE student_id = ANY(${targetStudentIds})`,
        sql`SELECT id, student_id, exam, subject, marks, total_marks, school_id FROM results WHERE student_id = ANY(${targetStudentIds})`
      ]);
    }
    let logsData = [];
    if (isOwner) {
      logsData = effectiveSchoolId ? await sql`SELECT * FROM activity_logs WHERE school_id = ${effectiveSchoolId} ORDER BY timestamp DESC LIMIT 250` : await sql`SELECT * FROM activity_logs ORDER BY timestamp DESC LIMIT 250`;
    } else if (isAdmin || isAccountant) {
      logsData = await sql`SELECT * FROM activity_logs WHERE school_id = ${effectiveSchoolId} ORDER BY timestamp DESC LIMIT 250`;
    }
    const transformedSchools = toCamelCase(schoolsData);
    const transformedClasses = toCamelCase(classesData);
    const transformedSubjects = toCamelCase(subjectsData);
    const transformedExams = toCamelCase(examsData);
    const transformedEvents = toCamelCase(eventsData);
    const transformedFeeHeads = toCamelCase(feeHeadsData).map((fh) => ({
      ...fh,
      defaultAmount: Number(fh.defaultAmount || 0)
    }));
    const transformedUsers = toCamelCase(usersData);
    const transformedStudents = toCamelCase(studentsData).map((s) => ({
      ...s,
      openingBalance: Number(s.openingBalance || 0),
      feeStructure: (s.feeStructure || []).map((item) => ({
        ...item,
        amount: Number(item.amount || 0)
      }))
    }));
    const transformedFees = toCamelCase(feesData).map((f) => {
      let history = f.paymentHistory;
      if (typeof history === "string") {
        try {
          history = JSON.parse(history);
        } catch {
          history = [];
        }
      }
      if (!Array.isArray(history)) history = [];
      return {
        ...f,
        previousBalance: Number(f.previousBalance || 0),
        totalAmount: Number(f.totalAmount || 0),
        discount: Number(f.discount || 0),
        paidAmount: Number(f.paidAmount || 0),
        fineAmount: Number(f.fineAmount || 0),
        paymentHistory: history.map((p) => ({
          ...p,
          amount: Number(p.amount || 0)
        }))
      };
    });
    const transformedAttendance = toCamelCase(attData);
    const transformedResults = toCamelCase(resData).map((r) => ({
      ...r,
      marks: Number(r.marks || 0),
      totalMarks: Number(r.totalMarks || 100)
    }));
    const transformedLogs = toCamelCase(logsData);
    return res.status(200).json({
      schools: transformedSchools,
      classes: transformedClasses,
      subjects: transformedSubjects,
      exams: transformedExams,
      feeHeads: transformedFeeHeads,
      events: transformedEvents,
      users: transformedUsers,
      students: transformedStudents,
      fees: transformedFees,
      attendance: transformedAttendance,
      results: transformedResults,
      logs: transformedLogs
    });
  } catch (err) {
    console.error("Data read API error:", err);
    return res.status(500).json({ error: "Failed to read school records from database." });
  }
}

// src/server/handlers/data/students.ts
async function handler7(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }
  try {
    const session = authenticateRequest(req);
    if (!session) {
      return res.status(401).json({ error: "Unauthorized: Session invalid or expired" });
    }
    const sql = getDb();
    const { role, userId, schoolId } = session;
    const requestedSchoolId = req.query?.schoolId;
    const effectiveSchoolId = role === "Owner" ? requestedSchoolId || null : schoolId;
    let students = [];
    if (role === "Owner" || role === "Admin" || role === "Accountant" || role === "Teacher") {
      students = effectiveSchoolId ? await sql`SELECT * FROM students WHERE school_id = ${effectiveSchoolId} ORDER BY roll_number ASC, name ASC` : await sql`SELECT * FROM students ORDER BY roll_number ASC, name ASC`;
      if (role === "Teacher") {
        students = students.map((s) => {
          const { cnic: _c, parent_cnic: _pc, ...safeStudent } = s;
          return safeStudent;
        });
      }
    } else if (role === "Parent") {
      const parentProfile = await sql`SELECT child_student_ids FROM profiles WHERE id = ${userId} LIMIT 1`;
      let childIds = [];
      if (parentProfile.length > 0) {
        const p = parentProfile[0];
        if (Array.isArray(p.child_student_ids)) childIds = p.child_student_ids;
        else if (typeof p.child_student_ids === "string") {
          try {
            childIds = JSON.parse(p.child_student_ids);
          } catch {
            childIds = [];
          }
        }
      }
      students = childIds.length > 0 ? await sql`SELECT * FROM students WHERE id = ANY(${childIds}) ORDER BY name ASC` : [];
    } else if (role === "Student") {
      students = await sql`SELECT * FROM students WHERE user_id = ${userId} LIMIT 1`;
    }
    const transformed = toCamelCase(students).map((s) => ({
      ...s,
      openingBalance: Number(s.openingBalance || 0),
      feeStructure: (s.feeStructure || []).map((item) => ({
        ...item,
        amount: Number(item.amount || 0)
      }))
    }));
    return res.status(200).json({ students: transformed });
  } catch (err) {
    console.error("Students read API error:", err);
    return res.status(500).json({ error: "Failed to read students from database." });
  }
}

// src/server/handlers/data/fees.ts
async function handler8(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }
  try {
    const session = authenticateRequest(req);
    if (!session) {
      return res.status(401).json({ error: "Unauthorized: Session invalid or expired" });
    }
    const sql = getDb();
    const { role, userId, schoolId } = session;
    const requestedSchoolId = req.query?.schoolId;
    if (role === "Teacher") {
      return res.status(200).json({ fees: [] });
    }
    let targetStudentIds = [];
    if (role === "Owner") {
      const effectiveSchoolId = requestedSchoolId || null;
      const students = effectiveSchoolId ? await sql`SELECT id FROM students WHERE school_id = ${effectiveSchoolId}` : await sql`SELECT id FROM students`;
      targetStudentIds = students.map((s) => s.id);
    } else if (role === "Admin" || role === "Accountant") {
      const students = await sql`SELECT id FROM students WHERE school_id = ${schoolId}`;
      targetStudentIds = students.map((s) => s.id);
    } else if (role === "Parent") {
      const parentProfile = await sql`SELECT child_student_ids FROM profiles WHERE id = ${userId} LIMIT 1`;
      let childIds = [];
      if (parentProfile.length > 0) {
        const p = parentProfile[0];
        if (Array.isArray(p.child_student_ids)) childIds = p.child_student_ids;
        else if (typeof p.child_student_ids === "string") {
          try {
            childIds = JSON.parse(p.child_student_ids);
          } catch {
            childIds = [];
          }
        }
      }
      targetStudentIds = childIds;
    } else if (role === "Student") {
      const studentProfile = await sql`SELECT id FROM students WHERE user_id = ${userId} LIMIT 1`;
      if (studentProfile.length > 0) {
        targetStudentIds = [studentProfile[0].id];
      }
    }
    let fees = [];
    if (targetStudentIds.length > 0) {
      fees = await sql`
                SELECT id, challan_number, student_id, class_id, month, year, due_date, fee_items, 
                       previous_balance, total_amount, discount, paid_amount, status, 
                       paid_date, fine_amount, payment_history, created_at
                FROM fee_challans 
                WHERE student_id = ANY(${targetStudentIds})
                ORDER BY year DESC, month DESC
            `;
    }
    const transformed = toCamelCase(fees).map((f) => {
      let history = f.paymentHistory;
      if (typeof history === "string") {
        try {
          history = JSON.parse(history);
        } catch {
          history = [];
        }
      }
      if (!Array.isArray(history)) history = [];
      return {
        ...f,
        previousBalance: Number(f.previousBalance || 0),
        totalAmount: Number(f.totalAmount || 0),
        discount: Number(f.discount || 0),
        paidAmount: Number(f.paidAmount || 0),
        fineAmount: Number(f.fineAmount || 0),
        paymentHistory: history.map((p) => ({
          ...p,
          amount: Number(p.amount || 0)
        }))
      };
    });
    return res.status(200).json({ fees: transformed });
  } catch (err) {
    console.error("Fees read API error:", err);
    return res.status(500).json({ error: "Failed to read fee records from database." });
  }
}

// src/server/handlers/data/users.ts
async function handler9(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }
  try {
    const session = authenticateRequest(req);
    if (!session) {
      return res.status(401).json({ error: "Unauthorized: Session invalid or expired" });
    }
    const sql = getDb();
    const { role, schoolId } = session;
    const requestedSchoolId = req.query?.schoolId;
    if (role === "Parent" || role === "Student") {
      return res.status(200).json({ users: [] });
    }
    let users = [];
    if (role === "Owner") {
      const effectiveSchoolId = requestedSchoolId || null;
      users = effectiveSchoolId ? await sql`
                    SELECT id, school_id, name, email, role, status, avatar_url, child_student_ids, disabled_nav_links, permissions_overrides, last_login 
                    FROM profiles 
                    WHERE school_id = ${effectiveSchoolId} OR school_id IS NULL
                    ORDER BY name ASC
                  ` : await sql`
                    SELECT id, school_id, name, email, role, status, avatar_url, child_student_ids, disabled_nav_links, permissions_overrides, last_login 
                    FROM profiles 
                    ORDER BY name ASC
                  `;
    } else if (role === "Admin" || role === "Accountant") {
      users = await sql`
                SELECT id, school_id, name, email, role, status, avatar_url, child_student_ids, disabled_nav_links, permissions_overrides, last_login 
                FROM profiles 
                WHERE (school_id = ${schoolId} OR school_id IS NULL) AND role != 'Owner'
                ORDER BY name ASC
            `;
    } else if (role === "Teacher") {
      users = await sql`
                SELECT id, school_id, name, email, role, status, avatar_url, last_login 
                FROM profiles 
                WHERE school_id = ${schoolId} AND role IN ('Admin', 'Accountant', 'Teacher')
                ORDER BY name ASC
            `;
    }
    const transformed = toCamelCase(users);
    return res.status(200).json({ users: transformed });
  } catch (err) {
    console.error("Users read API error:", err);
    return res.status(500).json({ error: "Failed to read users from database." });
  }
}

// src/server/handlers/data/schools.ts
async function handler10(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }
  try {
    const session = authenticateRequest(req);
    if (!session) {
      return res.status(401).json({ error: "Unauthorized: Session invalid or expired" });
    }
    const sql = getDb();
    const { role, schoolId } = session;
    let schools = [];
    if (role === "Owner") {
      schools = await sql`SELECT id, name, address, logo_url FROM schools ORDER BY name ASC`;
    } else if (schoolId) {
      schools = await sql`SELECT id, name, address, logo_url FROM schools WHERE id = ${schoolId}`;
    }
    const transformed = toCamelCase(schools);
    return res.status(200).json({ schools: transformed });
  } catch (err) {
    console.error("Schools read API error:", err);
    return res.status(500).json({ error: "Failed to read schools from database." });
  }
}

// src/server/handlers/write/_helpers.ts
import crypto2 from "crypto";
function verifySession(req, res) {
  const session = authenticateRequest(req);
  if (!session) {
    res.status(401).json({ error: "Unauthorized: Valid session required." });
    return null;
  }
  const sql = getDb();
  return { session, sql };
}
function isAuthorized(session, allowedRoles, targetSchoolId) {
  if (session.role === "Owner") {
    return true;
  }
  if (!allowedRoles.includes(session.role)) {
    return false;
  }
  if (targetSchoolId && session.schoolId && session.schoolId !== targetSchoolId) {
    return false;
  }
  return true;
}
async function writeServerAuditLog(sql, session, action, details, schoolId) {
  try {
    const id = crypto2.randomUUID();
    const effectiveSchoolId = schoolId || session.schoolId || null;
    const userName = session.name || session.email.split("@")[0];
    const userAvatar = session.avatarUrl || "";
    await sql`
            INSERT INTO activity_logs (id, user_id, user_name, user_avatar, school_id, action, details, timestamp)
            VALUES (${id}, ${session.userId}, ${userName}, ${userAvatar}, ${effectiveSchoolId}, ${action}, ${details}, ${(/* @__PURE__ */ new Date()).toISOString()})
        `;
  } catch (err) {
    console.warn("Failed to record server audit log:", err);
  }
}

// src/server/handlers/write/payments.ts
async function handler11(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }
  const auth = verifySession(req, res);
  if (!auth) return;
  const { session, sql } = auth;
  if (!isAuthorized(session, ["Owner", "Admin", "Accountant"])) {
    return res.status(403).json({ error: "Access denied: You do not have permission to manage fee payments." });
  }
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const { action } = body;
    if (action === "record-payment") {
      const { challanId, amount, discount = 0, paidDate } = body;
      const numAmount = Number(amount) || 0;
      const numDiscount = Number(discount) || 0;
      if (!challanId || numAmount <= 0) {
        return res.status(400).json({ error: "Challan ID and valid positive amount are required." });
      }
      const challanRows = await sql`
                SELECT fc.*, s.school_id, s.name as student_name, s.roll_number
                FROM fee_challans fc
                JOIN students s ON s.id = fc.student_id
                WHERE fc.id = ${challanId}
                LIMIT 1
            `;
      if (challanRows.length === 0) {
        return res.status(404).json({ error: "Challan not found." });
      }
      const challan = challanRows[0];
      if (session.role !== "Owner" && session.schoolId && challan.school_id !== session.schoolId) {
        return res.status(403).json({ error: "Unauthorized: This challan belongs to another school." });
      }
      const todayStr = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
      const validatedPaidDate = paidDate && paidDate > todayStr ? todayStr : paidDate || todayStr;
      let existingHistory = challan.payment_history || [];
      if (typeof existingHistory === "string") {
        try {
          existingHistory = JSON.parse(existingHistory);
        } catch {
          existingHistory = [];
        }
      }
      if (!Array.isArray(existingHistory)) existingHistory = [];
      const newRecord = {
        amount: numAmount,
        date: validatedPaidDate,
        recordedBy: session.name || session.email,
        recordedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      const updatedHistory = [...existingHistory, newRecord];
      const updateResult = await sql`
                UPDATE fee_challans
                SET 
                    paid_amount = paid_amount + ${numAmount},
                    discount = ${numDiscount},
                    paid_date = ${validatedPaidDate},
                    status = CASE 
                        WHEN (paid_amount + ${numAmount}) >= (total_amount - ${numDiscount}) THEN 'Paid' 
                        ELSE 'Partial' 
                    END,
                    payment_history = ${JSON.stringify(updatedHistory)}
                WHERE id = ${challanId}
                RETURNING *
            `;
      await writeServerAuditLog(
        sql,
        session,
        "Record Payment",
        `Recorded payment of Rs. ${numAmount.toLocaleString()} (Discount: Rs. ${numDiscount.toLocaleString()}) on Challan #${challan.challan_number} for ${challan.student_name} (Roll #${challan.roll_number})`,
        challan.school_id
      );
      return res.status(200).json({ success: true, challan: updateResult[0] });
    } else if (action === "update-payment") {
      const { challanId, paidAmount, discount = 0, paidDate, paymentHistory } = body;
      const numPaidAmount = Number(paidAmount) || 0;
      const numDiscount = Number(discount) || 0;
      if (!challanId) {
        return res.status(400).json({ error: "Challan ID is required." });
      }
      const challanRows = await sql`
                SELECT fc.*, s.school_id, s.name as student_name, s.roll_number
                FROM fee_challans fc
                JOIN students s ON s.id = fc.student_id
                WHERE fc.id = ${challanId}
                LIMIT 1
            `;
      if (challanRows.length === 0) {
        return res.status(404).json({ error: "Challan not found." });
      }
      const challan = challanRows[0];
      if (session.role !== "Owner" && session.schoolId && challan.school_id !== session.schoolId) {
        return res.status(403).json({ error: "Unauthorized: This challan belongs to another school." });
      }
      const todayStr = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
      const validatedPaidDate = paidDate && paidDate > todayStr ? todayStr : paidDate || todayStr;
      const status = numPaidAmount >= challan.total_amount - numDiscount ? "Paid" : numPaidAmount > 0 ? "Partial" : "Unpaid";
      const historyToSave = paymentHistory || challan.payment_history || [];
      const updateResult = await sql`
                UPDATE fee_challans
                SET 
                    paid_amount = ${numPaidAmount},
                    discount = ${numDiscount},
                    paid_date = ${validatedPaidDate},
                    status = ${status},
                    payment_history = ${JSON.stringify(historyToSave)}
                WHERE id = ${challanId}
                RETURNING *
            `;
      await writeServerAuditLog(
        sql,
        session,
        "Edit Payment",
        `Updated payment on Challan #${challan.challan_number} for ${challan.student_name} to Rs. ${numPaidAmount.toLocaleString()} (Discount: Rs. ${numDiscount.toLocaleString()})`,
        challan.school_id
      );
      return res.status(200).json({ success: true, challan: updateResult[0] });
    } else if (action === "cancel-challan") {
      const { challanId } = body;
      if (!challanId) {
        return res.status(400).json({ error: "Challan ID is required." });
      }
      const challanRows = await sql`
                SELECT fc.*, s.school_id, s.name as student_name
                FROM fee_challans fc
                JOIN students s ON s.id = fc.student_id
                WHERE fc.id = ${challanId}
                LIMIT 1
            `;
      if (challanRows.length === 0) {
        return res.status(404).json({ error: "Challan not found." });
      }
      const challan = challanRows[0];
      if (session.role !== "Owner" && session.schoolId && challan.school_id !== session.schoolId) {
        return res.status(403).json({ error: "Unauthorized: This challan belongs to another school." });
      }
      await sql`UPDATE fee_challans SET status = 'Cancelled' WHERE id = ${challanId}`;
      await writeServerAuditLog(
        sql,
        session,
        "Cancel Challan",
        `Cancelled fee challan #${challan.challan_number} for ${challan.student_name}`,
        challan.school_id
      );
      return res.status(200).json({ success: true });
    } else if (action === "increase-tuition") {
      const { studentIds, amount } = body;
      const incAmount = Number(amount) || 0;
      if (!Array.isArray(studentIds) || studentIds.length === 0 || incAmount === 0) {
        return res.status(400).json({ error: "studentIds array and non-zero amount are required." });
      }
      const effectiveSchoolId = session.role === "Owner" && body.schoolId ? body.schoolId : session.schoolId;
      const headRows = await sql`
                SELECT id, default_amount FROM fee_heads 
                WHERE LOWER(name) = 'tuition fee' 
                AND (${effectiveSchoolId ? sql`school_id = ${effectiveSchoolId}` : sql`TRUE`})
                LIMIT 1
            `;
      if (headRows.length === 0) {
        return res.status(400).json({ error: "Tuition Fee head not configured." });
      }
      const tuitionHead = headRows[0];
      for (const sId of studentIds) {
        const sRows = await sql`SELECT id, school_id, fee_structure FROM students WHERE id = ${sId}`;
        if (sRows.length > 0) {
          const student = sRows[0];
          if (session.role !== "Owner" && session.schoolId && student.school_id !== session.schoolId) {
            continue;
          }
          let structure = student.fee_structure || [];
          if (typeof structure === "string") {
            try {
              structure = JSON.parse(structure);
            } catch {
              structure = [];
            }
          }
          if (!Array.isArray(structure)) structure = [];
          const idx = structure.findIndex((item) => item.feeHeadId === tuitionHead.id);
          if (idx !== -1) {
            structure[idx].amount = (Number(structure[idx].amount) || 0) + incAmount;
          } else {
            structure.push({ feeHeadId: tuitionHead.id, amount: Number(tuitionHead.default_amount) + incAmount });
          }
          await sql`UPDATE students SET fee_structure = ${JSON.stringify(structure)} WHERE id = ${sId}`;
        }
      }
      await writeServerAuditLog(
        sql,
        session,
        "Fee Adjustment",
        `Adjusted tuition fee by Rs. ${incAmount.toLocaleString()} for ${studentIds.length} student(s)`,
        effectiveSchoolId
      );
      return res.status(200).json({ success: true, count: studentIds.length });
    } else {
      return res.status(400).json({ error: `Unknown action: ${action}` });
    }
  } catch (err) {
    console.error("Payment API error:", err);
    return res.status(500).json({ error: err.message || "Server error processing payment." });
  }
}

// src/server/handlers/write/challans.ts
import crypto3 from "crypto";
var MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December"
];
async function handler12(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }
  const auth = verifySession(req, res);
  if (!auth) return;
  const { session, sql } = auth;
  if (!isAuthorized(session, ["Owner", "Admin", "Accountant"])) {
    return res.status(403).json({ error: "Access denied: You do not have permission to generate or manage challans." });
  }
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const { action } = body;
    if (action === "generate") {
      const { month, year, selectedFeeHeads, studentIds, dueDate, schoolId } = body;
      const targetYear = Number(year);
      if (!month || !targetYear || !Array.isArray(studentIds) || studentIds.length === 0) {
        return res.status(400).json({ error: "Month, year, and studentIds array are required." });
      }
      const effectiveSchoolId = session.role === "Owner" && schoolId ? schoolId : session.schoolId;
      const students = await sql`
                SELECT id, name, roll_number, class_id, school_id, opening_balance, fee_structure
                FROM students
                WHERE id = ANY(${studentIds})
                AND (${effectiveSchoolId ? sql`school_id = ${effectiveSchoolId}` : sql`TRUE`})
                AND status = 'Active'
            `;
      if (students.length === 0) {
        return res.status(400).json({ error: "No active students found for challan generation." });
      }
      const feeHeads = await sql`SELECT id, name, default_amount FROM fee_heads`;
      const feeHeadMap = new Map(feeHeads.map((fh) => [fh.id, fh.name]));
      const monthIndex = MONTH_NAMES.indexOf(month) + 1;
      const monthStr = String(monthIndex).padStart(2, "0");
      const existingChallans = await sql`
                SELECT student_id 
                FROM fee_challans 
                WHERE student_id = ANY(${students.map((s) => s.id)})
                AND month = ${month} 
                AND year = ${targetYear} 
                AND status != 'Cancelled'
            `;
      const existingStudentSet = new Set(existingChallans.map((c) => c.student_id));
      let generatedCount = 0;
      let skippedDuplicates = 0;
      for (const student of students) {
        if (existingStudentSet.has(student.id)) {
          skippedDuplicates++;
          continue;
        }
        const pastChallans = await sql`
                    SELECT fee_items, fine_amount, paid_amount, discount
                    FROM fee_challans
                    WHERE student_id = ${student.id}
                    AND status != 'Cancelled'
                `;
        let totalCharged = Number(student.opening_balance) || 0;
        let totalCollected = 0;
        for (const pc of pastChallans) {
          let items2 = pc.fee_items || [];
          if (typeof items2 === "string") {
            try {
              items2 = JSON.parse(items2);
            } catch {
              items2 = [];
            }
          }
          if (Array.isArray(items2)) {
            for (const item of items2) {
              totalCharged += Number(item.amount) || 0;
            }
          }
          totalCharged += Number(pc.fine_amount) || 0;
          totalCollected += (Number(pc.paid_amount) || 0) + (Number(pc.discount) || 0);
        }
        const arrears = Math.max(0, totalCharged - totalCollected);
        let studentStructure = student.fee_structure || [];
        if (typeof studentStructure === "string") {
          try {
            studentStructure = JSON.parse(studentStructure);
          } catch {
            studentStructure = [];
          }
        }
        const feeStructureMap = new Map((studentStructure || []).map((item) => [item.feeHeadId, Number(item.amount) || 0]));
        const items = (selectedFeeHeads || []).map((h) => ({
          description: feeHeadMap.get(h.feeHeadId) || "Fee",
          amount: feeStructureMap.get(h.feeHeadId) ?? (Number(h.amount) || 0)
        }));
        const subtotal = items.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
        const totalAmount = subtotal + arrears;
        const challanId = crypto3.randomUUID();
        const cNum = `${targetYear}${monthStr}-${student.roll_number}`;
        await sql`
                    INSERT INTO fee_challans (
                        id, challan_number, student_id, class_id, month, year, 
                        due_date, status, fee_items, previous_balance, total_amount, 
                        discount, paid_amount, fine_amount
                    ) VALUES (
                        ${challanId}, ${cNum}, ${student.id}, ${student.class_id}, ${month}, ${targetYear}, 
                        ${dueDate || null}, 'Unpaid', ${JSON.stringify(items)}, ${arrears}, ${totalAmount}, 
                        0, 0, 0
                    )
                `;
        generatedCount++;
      }
      await writeServerAuditLog(
        sql,
        session,
        "Generate Challans",
        `Generated ${generatedCount} fee challans for ${month} ${targetYear} (Skipped ${skippedDuplicates} duplicates)`,
        effectiveSchoolId
      );
      return res.status(200).json({
        success: true,
        count: generatedCount,
        skippedDuplicates
      });
    } else if (action === "delete-unpaid") {
      const { month, year, schoolId } = body;
      const targetYear = Number(year);
      if (!month || !targetYear) {
        return res.status(400).json({ error: "Month and year are required." });
      }
      const effectiveSchoolId = session.role === "Owner" && schoolId ? schoolId : session.schoolId;
      const deletedRows = await sql`
                DELETE FROM fee_challans 
                WHERE month = ${month} 
                AND year = ${targetYear} 
                AND paid_amount = 0 
                AND student_id IN (
                    SELECT id FROM students 
                    WHERE (${effectiveSchoolId ? sql`school_id = ${effectiveSchoolId}` : sql`TRUE`})
                )
                RETURNING id
            `;
      await writeServerAuditLog(
        sql,
        session,
        "Delete Challans",
        `Deleted ${deletedRows.length} unpaid challans for ${month} ${targetYear}`,
        effectiveSchoolId
      );
      return res.status(200).json({
        success: true,
        count: deletedRows.length
      });
    } else {
      return res.status(400).json({ error: `Unknown action: ${action}` });
    }
  } catch (err) {
    console.error("Challan API error:", err);
    return res.status(500).json({ error: err.message || "Server error processing challans." });
  }
}

// src/server/handlers/write/academic.ts
import crypto4 from "crypto";
async function handler13(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }
  const auth = verifySession(req, res);
  if (!auth) return;
  const { session, sql } = auth;
  if (!isAuthorized(session, ["Owner", "Admin", "Teacher"])) {
    return res.status(403).json({ error: "Access denied: You do not have permission to manage academic records." });
  }
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const { action } = body;
    if (action === "set-attendance") {
      const { date, records, schoolId } = body;
      if (!date || !Array.isArray(records) || records.length === 0) {
        return res.status(400).json({ error: "Date and records array are required." });
      }
      const effectiveSchoolId = session.role === "Owner" && schoolId ? schoolId : session.schoolId;
      const BATCH_SIZE = 50;
      for (let i = 0; i < records.length; i += BATCH_SIZE) {
        const batch = records.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map((r) => {
          const recId = crypto4.randomUUID();
          return sql`
                        INSERT INTO attendance (id, student_id, date, status, school_id)
                        VALUES (${recId}, ${r.studentId}, ${date}, ${r.status}, ${effectiveSchoolId || null})
                        ON CONFLICT (student_id, date) DO UPDATE 
                        SET status = EXCLUDED.status
                    `;
        }));
      }
      await writeServerAuditLog(
        sql,
        session,
        "Attendance Recorded",
        `Recorded daily attendance for ${records.length} student(s) on ${date}`,
        effectiveSchoolId
      );
      return res.status(200).json({ success: true, count: records.length });
    } else if (action === "save-results") {
      const { results, schoolId } = body;
      if (!Array.isArray(results) || results.length === 0) {
        return res.status(400).json({ error: "Results array is required." });
      }
      const effectiveSchoolId = session.role === "Owner" && schoolId ? schoolId : session.schoolId;
      const BATCH_SIZE = 50;
      for (let i = 0; i < results.length; i += BATCH_SIZE) {
        const batch = results.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map((r) => {
          const recId = crypto4.randomUUID();
          const marksVal = Number(r.marks) || 0;
          const totalMarksVal = Number(r.totalMarks ?? r.total_marks ?? 100) || 100;
          return sql`
                        INSERT INTO results (id, student_id, class_id, exam, subject, marks, total_marks, school_id)
                        VALUES (${recId}, ${r.studentId}, ${r.classId}, ${r.exam}, ${r.subject}, ${marksVal}, ${totalMarksVal}, ${effectiveSchoolId || null})
                        ON CONFLICT (student_id, class_id, exam, subject) DO UPDATE 
                        SET marks = EXCLUDED.marks, total_marks = EXCLUDED.total_marks
                    `;
        }));
      }
      await writeServerAuditLog(
        sql,
        session,
        "Save Results",
        `Saved exam results for ${results.length} record(s)`,
        effectiveSchoolId
      );
      return res.status(200).json({ success: true, count: results.length });
    } else {
      return res.status(400).json({ error: `Unknown action: ${action}` });
    }
  } catch (err) {
    console.error("Academic API error:", err);
    return res.status(500).json({ error: err.message || "Server error saving academic data." });
  }
}

// src/server/handlers/write/students.ts
import crypto5 from "crypto";
async function handler14(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }
  const auth = verifySession(req, res);
  if (!auth) return;
  const { session, sql } = auth;
  if (!isAuthorized(session, ["Owner", "Admin"])) {
    return res.status(403).json({ error: "Access denied: Only Admins and Owners can modify student records." });
  }
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const { action } = body;
    if (action === "add-student") {
      const { student } = body;
      if (!student || !student.name || !student.rollNumber) {
        return res.status(400).json({ error: "Student name and roll number are required." });
      }
      const effectiveSchoolId = session.role === "Owner" && student.schoolId ? student.schoolId : session.schoolId;
      const id = crypto5.randomUUID();
      await sql`
                INSERT INTO students (
                    id, name, roll_number, class_id, school_id, father_name, father_cnic, 
                    date_of_birth, date_of_admission, contact_number, secondary_contact_number, 
                    address, status, gender, admitted_class, gr_number, religion, caste, 
                    last_school_attended, opening_balance, user_id, fee_structure, avatar_url
                ) VALUES (
                    ${id}, ${student.name}, ${student.rollNumber}, ${student.classId || null}, 
                    ${effectiveSchoolId}, ${student.fatherName || null}, ${student.fatherCnic || null}, 
                    ${student.dateOfBirth || null}, ${student.dateOfAdmission || null}, 
                    ${student.contactNumber || null}, ${student.secondaryContactNumber || null}, 
                    ${student.address || null}, 'Active', ${student.gender || "Male"}, 
                    ${student.admittedClass || null}, ${student.grNumber || null}, 
                    ${student.religion || null}, ${student.caste || null}, 
                    ${student.lastSchoolAttended || null}, ${Number(student.openingBalance) || 0}, 
                    ${student.userId || null}, ${JSON.stringify(student.feeStructure || [])},
                    ${student.avatarUrl || null}
                )
            `;
      await writeServerAuditLog(
        sql,
        session,
        "Add Student",
        `Added student: ${student.name} (Roll #${student.rollNumber})`,
        effectiveSchoolId
      );
      return res.status(200).json({ success: true, id });
    } else if (action === "update-student") {
      const { student } = body;
      if (!student || !student.id) {
        return res.status(400).json({ error: "Student ID is required." });
      }
      const existingRows = await sql`SELECT id, school_id, name, roll_number FROM students WHERE id = ${student.id}`;
      if (existingRows.length === 0) {
        return res.status(404).json({ error: "Student not found." });
      }
      const existing = existingRows[0];
      if (session.role !== "Owner" && session.schoolId && existing.school_id !== session.schoolId) {
        return res.status(403).json({ error: "Unauthorized: Student belongs to another school." });
      }
      await sql`
                UPDATE students SET
                    name = ${student.name},
                    roll_number = ${student.rollNumber},
                    class_id = ${student.classId || null},
                    father_name = ${student.fatherName || null},
                    father_cnic = ${student.fatherCnic || null},
                    date_of_birth = ${student.dateOfBirth || null},
                    date_of_admission = ${student.dateOfAdmission || null},
                    contact_number = ${student.contactNumber || null},
                    secondary_contact_number = ${student.secondaryContactNumber || null},
                    address = ${student.address || null},
                    status = ${student.status || "Active"},
                    gender = ${student.gender || "Male"},
                    avatar_url = ${student.avatarUrl || null},
                    admitted_class = ${student.admittedClass || null},
                    gr_number = ${student.grNumber || null},
                    religion = ${student.religion || null},
                    caste = ${student.caste || null},
                    last_school_attended = ${student.lastSchoolAttended || null},
                    opening_balance = ${Number(student.openingBalance) || 0},
                    user_id = ${student.userId || null},
                    fee_structure = ${JSON.stringify(student.feeStructure || [])}
                WHERE id = ${student.id}
            `;
      await writeServerAuditLog(
        sql,
        session,
        "Edit Student",
        `Updated student profile: ${student.name} (Roll #${student.rollNumber})`,
        existing.school_id
      );
      return res.status(200).json({ success: true });
    } else if (action === "delete-student") {
      const { studentId } = body;
      if (!studentId) {
        return res.status(400).json({ error: "Student ID is required." });
      }
      const existingRows = await sql`SELECT id, school_id, name, roll_number FROM students WHERE id = ${studentId}`;
      if (existingRows.length === 0) {
        return res.status(404).json({ error: "Student not found." });
      }
      const existing = existingRows[0];
      if (session.role !== "Owner" && session.schoolId && existing.school_id !== session.schoolId) {
        return res.status(403).json({ error: "Unauthorized: Student belongs to another school." });
      }
      await sql`UPDATE students SET status = 'Deleted' WHERE id = ${studentId}`;
      await writeServerAuditLog(
        sql,
        session,
        "Delete Student",
        `Soft deleted student: ${existing.name} (Roll #${existing.roll_number})`,
        existing.school_id
      );
      return res.status(200).json({ success: true });
    } else if (action === "bulk-add-students") {
      const { students, schoolId } = body;
      if (!Array.isArray(students) || students.length === 0) {
        return res.status(400).json({ error: "Students array is required." });
      }
      const effectiveSchoolId = session.role === "Owner" && schoolId ? schoolId : session.schoolId;
      const BATCH_SIZE = 25;
      for (let i = 0; i < students.length; i += BATCH_SIZE) {
        const batch = students.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map((s) => {
          const id = crypto5.randomUUID();
          return sql`
                        INSERT INTO students (
                            id, name, roll_number, class_id, school_id, father_name, father_cnic, 
                            date_of_birth, date_of_admission, contact_number, secondary_contact_number, 
                            address, status, gender, admitted_class, gr_number, religion, caste, 
                            last_school_attended, opening_balance, user_id, fee_structure
                        ) VALUES (
                            ${id}, ${s.name}, ${s.rollNumber || s.roll_number}, ${s.classId || s.class_id || null}, 
                            ${effectiveSchoolId}, ${s.fatherName || s.father_name || null}, ${s.fatherCnic || s.father_cnic || null}, 
                            ${s.dateOfBirth || s.date_of_birth || null}, ${s.dateOfAdmission || s.date_of_admission || null}, 
                            ${s.contactNumber || s.contact_number || null}, ${s.secondaryContactNumber || s.secondary_contact_number || null}, 
                            ${s.address || null}, 'Active', ${s.gender || "Male"}, ${s.admittedClass || s.admitted_class || null}, 
                            ${s.grNumber || s.gr_number || null}, ${s.religion || null}, ${s.caste || null}, 
                            ${s.lastSchoolAttended || s.last_school_attended || null}, ${Number(s.openingBalance || s.opening_balance) || 0}, 
                            ${s.userId || s.user_id || null}, ${JSON.stringify(s.feeStructure || s.fee_structure || [])}
                        )
                    `;
        }));
      }
      await writeServerAuditLog(
        sql,
        session,
        "Bulk Import Students",
        `Bulk imported ${students.length} students`,
        effectiveSchoolId
      );
      return res.status(200).json({ success: true, count: students.length });
    } else if (action === "issue-certificate") {
      const { studentId, details } = body;
      if (!studentId || !details) {
        return res.status(400).json({ error: "Student ID and details are required." });
      }
      const existingRows = await sql`SELECT id, school_id, name, roll_number FROM students WHERE id = ${studentId}`;
      if (existingRows.length === 0) {
        return res.status(404).json({ error: "Student not found." });
      }
      const existing = existingRows[0];
      if (session.role !== "Owner" && session.schoolId && existing.school_id !== session.schoolId) {
        return res.status(403).json({ error: "Unauthorized: Student belongs to another school." });
      }
      await sql`
                UPDATE students 
                SET 
                    status = 'Left',
                    date_of_leaving = ${details.dateOfLeaving || details.date_of_leaving || (/* @__PURE__ */ new Date()).toISOString().split("T")[0]},
                    reason_for_leaving = ${details.reasonForLeaving || details.reason_for_leaving || null},
                    conduct = ${details.conduct || null},
                    progress = ${details.progress || null},
                    place_of_birth = ${details.placeOfBirth || details.place_of_birth || null}
                WHERE id = ${studentId}
            `;
      await writeServerAuditLog(
        sql,
        session,
        "Issue Certificate",
        `Issued school leaving certificate for ${existing.name} (Roll #${existing.roll_number})`,
        existing.school_id
      );
      return res.status(200).json({ success: true });
    } else if (action === "promote-students") {
      const { graduations, promotions, schoolId } = body;
      const effectiveSchoolId = session.role === "Owner" && schoolId ? schoolId : session.schoolId;
      let updatedCount = 0;
      if (Array.isArray(graduations) && graduations.length > 0) {
        const CHUNK = 50;
        for (let i = 0; i < graduations.length; i += CHUNK) {
          const chunk = graduations.slice(i, i + CHUNK);
          await sql`
                        UPDATE students 
                        SET status = 'Graduated' 
                        WHERE id = ANY(${chunk})
                        AND (${effectiveSchoolId ? sql`school_id = ${effectiveSchoolId}` : sql`TRUE`})
                    `;
        }
        updatedCount += graduations.length;
      }
      if (promotions && typeof promotions === "object") {
        for (const [targetClassId, stdIds] of Object.entries(promotions)) {
          if (Array.isArray(stdIds) && stdIds.length > 0) {
            const CHUNK = 50;
            for (let i = 0; i < stdIds.length; i += CHUNK) {
              const chunk = stdIds.slice(i, i + CHUNK);
              await sql`
                                UPDATE students 
                                SET class_id = ${targetClassId}, status = 'Active' 
                                WHERE id = ANY(${chunk})
                                AND (${effectiveSchoolId ? sql`school_id = ${effectiveSchoolId}` : sql`TRUE`})
                            `;
            }
            updatedCount += stdIds.length;
          }
        }
      }
      await writeServerAuditLog(
        sql,
        session,
        "Promote Students",
        `Promoted/graduated ${updatedCount} students`,
        effectiveSchoolId
      );
      return res.status(200).json({ success: true, count: updatedCount });
    } else if (action === "reactivate-graduated") {
      const { studentIds, targetClassId, schoolId } = body;
      const effectiveSchoolId = session.role === "Owner" && schoolId ? schoolId : session.schoolId;
      if (!Array.isArray(studentIds) || studentIds.length === 0) {
        return res.status(400).json({ error: "studentIds array is required." });
      }
      const CHUNK = 50;
      for (let i = 0; i < studentIds.length; i += CHUNK) {
        const chunk = studentIds.slice(i, i + CHUNK);
        if (targetClassId) {
          await sql`
                        UPDATE students 
                        SET status = 'Active', class_id = ${targetClassId} 
                        WHERE id = ANY(${chunk})
                        AND (${effectiveSchoolId ? sql`school_id = ${effectiveSchoolId}` : sql`TRUE`})
                    `;
        } else {
          await sql`
                        UPDATE students 
                        SET status = 'Active' 
                        WHERE id = ANY(${chunk})
                        AND (${effectiveSchoolId ? sql`school_id = ${effectiveSchoolId}` : sql`TRUE`})
                    `;
        }
      }
      await writeServerAuditLog(
        sql,
        session,
        "Reactivate Students",
        `Reactivated ${studentIds.length} graduated student(s) to Active status`,
        effectiveSchoolId
      );
      return res.status(200).json({ success: true, count: studentIds.length });
    } else if (action === "revert-promotion") {
      const { groups, schoolId } = body;
      const effectiveSchoolId = session.role === "Owner" && schoolId ? schoolId : session.schoolId;
      if (!groups || typeof groups !== "object") {
        return res.status(400).json({ error: "Groups object is required." });
      }
      let revertedCount = 0;
      for (const [key, ids] of Object.entries(groups)) {
        const [classId, status] = key.split("__");
        const idList = ids;
        if (Array.isArray(idList) && idList.length > 0) {
          const CHUNK = 50;
          for (let i = 0; i < idList.length; i += CHUNK) {
            const chunk = idList.slice(i, i + CHUNK);
            await sql`
                            UPDATE students 
                            SET class_id = ${classId}, status = ${status} 
                            WHERE id = ANY(${chunk})
                            AND (${effectiveSchoolId ? sql`school_id = ${effectiveSchoolId}` : sql`TRUE`})
                        `;
          }
          revertedCount += idList.length;
        }
      }
      await writeServerAuditLog(
        sql,
        session,
        "Revert Promotion",
        `Reverted promotion for ${revertedCount} students`,
        effectiveSchoolId
      );
      return res.status(200).json({ success: true, count: revertedCount });
    } else {
      return res.status(400).json({ error: `Unknown action: ${action}` });
    }
  } catch (err) {
    console.error("Student API error:", err);
    return res.status(500).json({ error: err.message || "Server error processing student mutation." });
  }
}

// src/server/handlers/write/classes.ts
import crypto6 from "crypto";
async function handler15(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }
  const auth = verifySession(req, res);
  if (!auth) return;
  const { session, sql } = auth;
  if (!isAuthorized(session, ["Owner", "Admin"])) {
    return res.status(403).json({ error: "Access denied: Only Admins and Owners can manage school configuration." });
  }
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const { action } = body;
    if (action === "add-class") {
      const { name, section, teacherId, sortOrder, schoolId } = body;
      const effectiveSchoolId = session.role === "Owner" && schoolId ? schoolId : session.schoolId;
      const id = crypto6.randomUUID();
      await sql`
                INSERT INTO classes (id, name, section, teacher_id, school_id, sort_order)
                VALUES (${id}, ${name}, ${section || null}, ${teacherId || null}, ${effectiveSchoolId}, ${sortOrder || 0})
            `;
      await writeServerAuditLog(sql, session, "Add Class", `Added class: ${name} ${section || ""}`, effectiveSchoolId);
      return res.status(200).json({ success: true, id });
    } else if (action === "update-class") {
      const { id, name, section, teacherId, sortOrder } = body;
      await sql`
                UPDATE classes 
                SET name = ${name}, section = ${section || null}, teacher_id = ${teacherId || null}, sort_order = ${sortOrder || 0}
                WHERE id = ${id}
            `;
      return res.status(200).json({ success: true });
    } else if (action === "delete-class") {
      const { id } = body;
      await sql`DELETE FROM classes WHERE id = ${id}`;
      return res.status(200).json({ success: true });
    } else if (action === "bulk-add-classes") {
      const { classes, schoolId } = body;
      const effectiveSchoolId = session.role === "Owner" && schoolId ? schoolId : session.schoolId;
      for (const c of classes) {
        const id = crypto6.randomUUID();
        await sql`INSERT INTO classes (id, name, school_id) VALUES (${id}, ${c.name}, ${effectiveSchoolId})`;
      }
      return res.status(200).json({ success: true, count: classes.length });
    } else if (action === "bulk-update-order") {
      const { updates } = body;
      for (const u of updates) {
        await sql`UPDATE classes SET sort_order = ${u.sortOrder} WHERE id = ${u.id}`;
      }
      return res.status(200).json({ success: true });
    } else if (action === "add-subject") {
      const { name, schoolId } = body;
      const effectiveSchoolId = session.role === "Owner" && schoolId ? schoolId : session.schoolId;
      const id = crypto6.randomUUID();
      await sql`INSERT INTO subjects (id, name, school_id) VALUES (${id}, ${name}, ${effectiveSchoolId})`;
      return res.status(200).json({ success: true, id });
    } else if (action === "update-subject") {
      const { id, name } = body;
      await sql`UPDATE subjects SET name = ${name} WHERE id = ${id}`;
      return res.status(200).json({ success: true });
    } else if (action === "delete-subject") {
      const { id } = body;
      await sql`DELETE FROM subjects WHERE id = ${id}`;
      return res.status(200).json({ success: true });
    } else if (action === "add-exam") {
      const { name, schoolId } = body;
      const effectiveSchoolId = session.role === "Owner" && schoolId ? schoolId : session.schoolId;
      const id = crypto6.randomUUID();
      await sql`INSERT INTO exams (id, name, school_id) VALUES (${id}, ${name}, ${effectiveSchoolId})`;
      return res.status(200).json({ success: true, id });
    } else if (action === "update-exam") {
      const { id, name } = body;
      await sql`UPDATE exams SET name = ${name} WHERE id = ${id}`;
      return res.status(200).json({ success: true });
    } else if (action === "delete-exam") {
      const { id } = body;
      await sql`DELETE FROM exams WHERE id = ${id}`;
      return res.status(200).json({ success: true });
    } else if (action === "add-fee-head") {
      const { name, defaultAmount, schoolId } = body;
      const effectiveSchoolId = session.role === "Owner" && schoolId ? schoolId : session.schoolId;
      const id = crypto6.randomUUID();
      await sql`
                INSERT INTO fee_heads (id, name, default_amount, school_id)
                VALUES (${id}, ${name}, ${Number(defaultAmount) || 0}, ${effectiveSchoolId})
            `;
      await writeServerAuditLog(sql, session, "Add Fee Head", `Added fee head: ${name} (Rs. ${defaultAmount})`, effectiveSchoolId);
      return res.status(200).json({ success: true, id });
    } else if (action === "update-fee-head") {
      const { id, name, defaultAmount } = body;
      await sql`
                UPDATE fee_heads 
                SET name = ${name}, default_amount = ${Number(defaultAmount) || 0}
                WHERE id = ${id}
            `;
      return res.status(200).json({ success: true });
    } else if (action === "delete-fee-head") {
      const { id } = body;
      await sql`DELETE FROM fee_heads WHERE id = ${id}`;
      return res.status(200).json({ success: true });
    } else if (action === "add-event") {
      const { title, date, category, description, schoolId } = body;
      const effectiveSchoolId = session.role === "Owner" && schoolId ? schoolId : session.schoolId;
      const id = crypto6.randomUUID();
      await sql`
                INSERT INTO school_events (id, title, date, category, description, school_id)
                VALUES (${id}, ${title}, ${date}, ${category || "general"}, ${description || ""}, ${effectiveSchoolId})
            `;
      return res.status(200).json({ success: true, id });
    } else if (action === "update-event") {
      const { id, title, date, category, description } = body;
      await sql`
                UPDATE school_events 
                SET title = ${title}, date = ${date}, category = ${category || "general"}, description = ${description || ""}
                WHERE id = ${id}
            `;
      return res.status(200).json({ success: true });
    } else if (action === "delete-event") {
      const { id } = body;
      await sql`DELETE FROM school_events WHERE id = ${id}`;
      return res.status(200).json({ success: true });
    } else {
      return res.status(400).json({ error: `Unknown action: ${action}` });
    }
  } catch (err) {
    console.error("Classes/Config API error:", err);
    return res.status(500).json({ error: err.message || "Server error updating school configuration." });
  }
}

// src/server/handlers/write/users.ts
import crypto7 from "crypto";
import bcrypt4 from "bcryptjs";
async function handler16(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }
  const auth = verifySession(req, res);
  if (!auth) return;
  const { session, sql } = auth;
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const { action } = body;
    if (action === "add-user") {
      if (!isAuthorized(session, ["Owner", "Admin"])) {
        return res.status(403).json({ error: "Access denied: Cannot create user accounts." });
      }
      const { name, email, password, role, schoolId, avatarUrl } = body;
      if (!name || !email || !password || !role) {
        return res.status(400).json({ error: "Name, email, password, and role are required." });
      }
      const effectiveSchoolId = session.role === "Owner" && schoolId ? schoolId : session.schoolId;
      const saltRounds = 10;
      const hashedPassword = await bcrypt4.hash(password, saltRounds);
      const id = crypto7.randomUUID();
      await sql`
                INSERT INTO profiles (id, name, email, password, role, school_id, status, avatar_url)
                VALUES (${id}, ${name}, ${email.toLowerCase().trim()}, ${hashedPassword}, ${role}, ${effectiveSchoolId}, 'Active', ${avatarUrl || null})
            `;
      await writeServerAuditLog(
        sql,
        session,
        "Add User",
        `Created ${role} account for ${name} (${email})`,
        effectiveSchoolId
      );
      return res.status(200).json({ success: true, id });
    } else if (action === "update-user") {
      if (!isAuthorized(session, ["Owner", "Admin"])) {
        return res.status(403).json({ error: "Access denied: Cannot update user accounts." });
      }
      const { id, name, avatarUrl, status } = body;
      if (!id) {
        return res.status(400).json({ error: "User ID is required." });
      }
      await sql`
                UPDATE profiles 
                SET name = ${name}, avatar_url = ${avatarUrl || null}, status = ${status || "Active"}
                WHERE id = ${id}
            `;
      return res.status(200).json({ success: true });
    } else if (action === "delete-user") {
      if (!isAuthorized(session, ["Owner", "Admin"])) {
        return res.status(403).json({ error: "Access denied: Cannot deactivate user accounts." });
      }
      const { userId } = body;
      if (!userId) {
        return res.status(400).json({ error: "User ID is required." });
      }
      const targetUser = await sql`SELECT role, email FROM profiles WHERE id = ${userId}`;
      if (targetUser.length > 0 && targetUser[0].role === "Owner") {
        return res.status(400).json({ error: "Cannot deactivate an Owner account." });
      }
      await sql`UPDATE profiles SET status = 'Inactive' WHERE id = ${userId}`;
      await writeServerAuditLog(
        sql,
        session,
        "Deactivate User",
        `Deactivated account for user ID ${userId}`
      );
      return res.status(200).json({ success: true });
    } else if (action === "bulk-add-users") {
      if (!isAuthorized(session, ["Owner", "Admin"])) {
        return res.status(403).json({ error: "Access denied: Cannot bulk import user accounts." });
      }
      const { users, schoolId } = body;
      if (!Array.isArray(users) || users.length === 0) {
        return res.status(400).json({ error: "Users array is required." });
      }
      const effectiveSchoolId = session.role === "Owner" && schoolId ? schoolId : session.schoolId;
      for (const u of users) {
        const id = crypto7.randomUUID();
        const rawPass = u.password || "password123";
        const hashedPassword = await bcrypt4.hash(rawPass, 10);
        await sql`
                    INSERT INTO profiles (id, name, email, password, role, school_id, status, avatar_url)
                    VALUES (${id}, ${u.name}, ${u.email.toLowerCase().trim()}, ${hashedPassword}, ${u.role}, ${effectiveSchoolId}, 'Active', ${u.avatarUrl || u.avatar_url || null})
                `;
      }
      return res.status(200).json({ success: true, count: users.length });
    } else if (action === "add-school") {
      if (session.role !== "Owner") {
        return res.status(403).json({ error: "Only Owner can create schools." });
      }
      const { name, address, logoUrl } = body;
      const id = crypto7.randomUUID();
      await sql`INSERT INTO schools (id, name, address, logo_url) VALUES (${id}, ${name}, ${address || ""}, ${logoUrl || null})`;
      return res.status(200).json({ success: true, id });
    } else if (action === "update-school") {
      if (session.role !== "Owner") {
        return res.status(403).json({ error: "Only Owner can edit schools." });
      }
      const { id, name, address, logoUrl } = body;
      await sql`UPDATE schools SET name = ${name}, address = ${address || ""}, logo_url = ${logoUrl || null} WHERE id = ${id}`;
      return res.status(200).json({ success: true });
    } else if (action === "delete-school") {
      if (session.role !== "Owner") {
        return res.status(403).json({ error: "Only Owner can delete schools." });
      }
      const { id } = body;
      await sql`DELETE FROM schools WHERE id = ${id}`;
      return res.status(200).json({ success: true });
    } else if (action === "add-log") {
      const { actionName, details, schoolId } = body;
      const effectiveSchoolId = session.role === "Owner" && schoolId ? schoolId : session.schoolId;
      await writeServerAuditLog(sql, session, actionName || "Action", details || "", effectiveSchoolId);
      return res.status(200).json({ success: true });
    } else {
      return res.status(400).json({ error: `Unknown action: ${action}` });
    }
  } catch (err) {
    console.error("Users/Schools API error:", err);
    return res.status(500).json({ error: err.message || "Server error updating users/schools." });
  }
}

// src/server/handlers/write/restore.ts
import crypto8 from "crypto";
async function handler17(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }
  const auth = verifySession(req, res);
  if (!auth) return;
  const { session, sql } = auth;
  if (!isAuthorized(session, ["Owner", "Admin"])) {
    return res.status(403).json({ error: "Access denied: Only Admins and Owners can perform data restore." });
  }
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const { backupData, targetSchoolId } = body;
    if (!backupData || typeof backupData !== "object") {
      return res.status(400).json({ error: "Valid backupData payload is required." });
    }
    const isOwnerGlobal = session.role === "Owner" && !targetSchoolId;
    const effectiveSchoolId = session.role === "Owner" && targetSchoolId ? targetSchoolId : session.schoolId;
    if (!isOwnerGlobal && !effectiveSchoolId) {
      return res.status(400).json({ error: "A specific target school ID is required for school restore." });
    }
    await sql`BEGIN`;
    try {
      if (isOwnerGlobal) {
        await sql`DELETE FROM results`;
        await sql`DELETE FROM attendance`;
        await sql`DELETE FROM fee_challans`;
        await sql`DELETE FROM students`;
        await sql`DELETE FROM classes`;
        await sql`DELETE FROM fee_heads`;
        await sql`DELETE FROM school_events`;
        await sql`DELETE FROM subjects`;
        await sql`DELETE FROM exams`;
        if (backupData.schools?.length) {
          for (const s of backupData.schools) {
            await sql`
                            INSERT INTO schools (id, name, address, logo_url)
                            VALUES (${s.id}, ${s.name}, ${s.address || ""}, ${s.logoUrl || s.logo_url || null})
                            ON CONFLICT (id) DO UPDATE 
                            SET name = EXCLUDED.name, address = EXCLUDED.address, logo_url = EXCLUDED.logo_url
                        `;
          }
        }
      } else {
        await sql`DELETE FROM results WHERE student_id IN (SELECT id FROM students WHERE school_id = ${effectiveSchoolId})`;
        await sql`DELETE FROM attendance WHERE student_id IN (SELECT id FROM students WHERE school_id = ${effectiveSchoolId})`;
        await sql`DELETE FROM fee_challans WHERE student_id IN (SELECT id FROM students WHERE school_id = ${effectiveSchoolId})`;
        await sql`DELETE FROM students WHERE school_id = ${effectiveSchoolId}`;
        await sql`DELETE FROM classes WHERE school_id = ${effectiveSchoolId}`;
        await sql`DELETE FROM fee_heads WHERE school_id = ${effectiveSchoolId}`;
        await sql`DELETE FROM school_events WHERE school_id = ${effectiveSchoolId}`;
        await sql`DELETE FROM subjects WHERE school_id = ${effectiveSchoolId}`;
        await sql`DELETE FROM exams WHERE school_id = ${effectiveSchoolId}`;
      }
      if (Array.isArray(backupData.classes) && backupData.classes.length > 0) {
        for (const c of backupData.classes) {
          const sid = isOwnerGlobal ? c.schoolId || c.school_id : effectiveSchoolId;
          await sql`
                        INSERT INTO classes (id, name, section, teacher_id, school_id, sort_order)
                        VALUES (${c.id || crypto8.randomUUID()}, ${c.name}, ${c.section || null}, ${c.teacherId || c.teacher_id || null}, ${sid}, ${c.sortOrder || c.sort_order || 0})
                    `;
        }
      }
      if (Array.isArray(backupData.feeHeads) && backupData.feeHeads.length > 0) {
        for (const fh of backupData.feeHeads) {
          const sid = isOwnerGlobal ? fh.schoolId || fh.school_id : effectiveSchoolId;
          await sql`
                        INSERT INTO fee_heads (id, name, default_amount, school_id)
                        VALUES (${fh.id || crypto8.randomUUID()}, ${fh.name}, ${Number(fh.defaultAmount || fh.default_amount) || 0}, ${sid})
                    `;
        }
      }
      if (Array.isArray(backupData.subjects) && backupData.subjects.length > 0) {
        for (const s of backupData.subjects) {
          const sid = isOwnerGlobal ? s.schoolId || s.school_id : effectiveSchoolId;
          await sql`
                        INSERT INTO subjects (id, name, school_id)
                        VALUES (${s.id || crypto8.randomUUID()}, ${s.name}, ${sid})
                    `;
        }
      }
      if (Array.isArray(backupData.exams) && backupData.exams.length > 0) {
        for (const e of backupData.exams) {
          const sid = isOwnerGlobal ? e.schoolId || e.school_id : effectiveSchoolId;
          await sql`
                        INSERT INTO exams (id, name, school_id)
                        VALUES (${e.id || crypto8.randomUUID()}, ${e.name}, ${sid})
                    `;
        }
      }
      if (Array.isArray(backupData.events) && backupData.events.length > 0) {
        for (const ev of backupData.events) {
          const sid = isOwnerGlobal ? ev.schoolId || ev.school_id : effectiveSchoolId;
          await sql`
                        INSERT INTO school_events (id, title, date, category, description, school_id)
                        VALUES (${ev.id || crypto8.randomUUID()}, ${ev.title}, ${ev.date}, ${ev.category || "general"}, ${ev.description || ""}, ${sid})
                    `;
        }
      }
      if (Array.isArray(backupData.students) && backupData.students.length > 0) {
        for (const st of backupData.students) {
          const sid = isOwnerGlobal ? st.schoolId || st.school_id : effectiveSchoolId;
          const feeStructure = st.feeStructure || st.fee_structure || [];
          await sql`
                        INSERT INTO students (
                            id, name, roll_number, class_id, school_id, father_name, father_cnic, 
                            date_of_birth, date_of_admission, contact_number, secondary_contact_number, 
                            address, status, gender, admitted_class, gr_number, religion, caste, 
                            last_school_attended, opening_balance, user_id, fee_structure, avatar_url
                        ) VALUES (
                            ${st.id || crypto8.randomUUID()}, ${st.name}, ${st.rollNumber || st.roll_number}, 
                            ${st.classId || st.class_id || null}, ${sid}, 
                            ${st.fatherName || st.father_name || null}, ${st.fatherCnic || st.father_cnic || null}, 
                            ${st.dateOfBirth || st.date_of_birth || null}, ${st.dateOfAdmission || st.date_of_admission || null}, 
                            ${st.contactNumber || st.contact_number || null}, ${st.secondaryContactNumber || st.secondary_contact_number || null}, 
                            ${st.address || null}, ${st.status || "Active"}, ${st.gender || "Male"}, 
                            ${st.admittedClass || st.admitted_class || null}, ${st.grNumber || st.gr_number || null}, 
                            ${st.religion || null}, ${st.caste || null}, ${st.lastSchoolAttended || st.last_school_attended || null}, 
                            ${Number(st.openingBalance || st.opening_balance) || 0}, ${st.userId || st.user_id || null}, 
                            ${JSON.stringify(feeStructure)}, ${st.avatarUrl || st.avatar_url || null}
                        )
                    `;
        }
      }
      if (Array.isArray(backupData.fees) && backupData.fees.length > 0) {
        for (const f of backupData.fees) {
          let history = f.paymentHistory || f.payment_history || [];
          if (typeof history === "string") {
            try {
              history = JSON.parse(history);
            } catch {
              history = [];
            }
          }
          const feeItems = f.feeItems || f.fee_items || [];
          await sql`
                        INSERT INTO fee_challans (
                            id, challan_number, student_id, class_id, month, year, 
                            due_date, status, fee_items, previous_balance, total_amount, 
                            discount, paid_amount, fine_amount, paid_date, payment_history
                        ) VALUES (
                            ${f.id || crypto8.randomUUID()}, ${f.challanNumber || f.challan_number}, 
                            ${f.studentId || f.student_id}, ${f.classId || f.class_id || null}, 
                            ${f.month}, ${Number(f.year)}, ${f.dueDate || f.due_date || null}, 
                            ${f.status || "Unpaid"}, ${JSON.stringify(feeItems)}, 
                            ${Number(f.previousBalance || f.previous_balance) || 0}, 
                            ${Number(f.totalAmount || f.total_amount) || 0}, 
                            ${Number(f.discount) || 0}, ${Number(f.paidAmount || f.paid_amount) || 0}, 
                            ${Number(f.fineAmount || f.fine_amount) || 0}, 
                            ${f.paidDate || f.paid_date || null}, ${JSON.stringify(history)}
                        )
                    `;
        }
      }
      if (Array.isArray(backupData.attendance) && backupData.attendance.length > 0) {
        for (const a of backupData.attendance) {
          const sid = isOwnerGlobal ? a.schoolId || a.school_id : effectiveSchoolId;
          await sql`
                        INSERT INTO attendance (id, student_id, date, status, school_id)
                        VALUES (${a.id || crypto8.randomUUID()}, ${a.studentId || a.student_id}, ${a.date}, ${a.status}, ${sid || null})
                    `;
        }
      }
      if (Array.isArray(backupData.results) && backupData.results.length > 0) {
        for (const r of backupData.results) {
          const sid = isOwnerGlobal ? r.schoolId || r.school_id : effectiveSchoolId;
          await sql`
                        INSERT INTO results (id, student_id, class_id, exam, subject, marks, total_marks, school_id)
                        VALUES (
                            ${r.id || crypto8.randomUUID()}, ${r.studentId || r.student_id}, 
                            ${r.classId || r.class_id}, ${r.exam}, ${r.subject}, 
                            ${Number(r.marks) || 0}, ${Number(r.totalMarks || r.total_marks) || 100}, 
                            ${sid || null}
                        )
                    `;
        }
      }
      await sql`COMMIT`;
      await writeServerAuditLog(
        sql,
        session,
        "Restore Database",
        `Successfully restored database backup (${isOwnerGlobal ? "Full Global Restore" : `School ID: ${effectiveSchoolId}`})`,
        effectiveSchoolId
      );
      return res.status(200).json({ success: true, message: "Restore completed successfully." });
    } catch (txnError) {
      await sql`ROLLBACK`;
      console.error("Restore transaction failed, rolled back:", txnError);
      return res.status(500).json({ error: `Restore failed and was rolled back: ${txnError.message || txnError}` });
    }
  } catch (err) {
    console.error("Restore API fatal error:", err);
    return res.status(500).json({ error: err.message || "Fatal error during restore operation." });
  }
}

// src/server/handlers/notifications/index.ts
import crypto9 from "crypto";
async function handler18(req, res) {
  const session = authenticateRequest(req);
  if (!session) {
    return res.status(401).json({ error: "Unauthorized: Valid session required." });
  }
  const sql = getDb();
  if (req.method === "GET") {
    try {
      const rows = await sql`
                SELECT id, user_id as "userId", title, message, link, is_read as "isRead", timestamp
                FROM notifications
                WHERE user_id = ${session.userId}
                ORDER BY timestamp DESC
                LIMIT 50
            `;
      return res.status(200).json({ notifications: rows });
    } catch (error) {
      console.error("Error fetching notifications:", error);
      return res.status(500).json({ error: error.message || "Failed to fetch notifications" });
    }
  }
  if (req.method === "POST") {
    const body = req.body || {};
    const { action } = body;
    try {
      if (action === "mark_read") {
        const { notificationId } = body;
        if (!notificationId) {
          return res.status(400).json({ error: "Missing notificationId" });
        }
        await sql`
                    UPDATE notifications
                    SET is_read = true
                    WHERE id = ${notificationId} AND user_id = ${session.userId}
                `;
        return res.status(200).json({ success: true });
      }
      if (action === "mark_all_read") {
        await sql`
                    UPDATE notifications
                    SET is_read = true
                    WHERE user_id = ${session.userId}
                `;
        return res.status(200).json({ success: true });
      }
      if (action === "send") {
        const { userIds, title, message, link } = body;
        if (!Array.isArray(userIds) || userIds.length === 0 || !title || !message) {
          return res.status(400).json({ error: "Missing userIds, title, or message" });
        }
        const allowedRoles = ["Owner", "Admin", "Accountant", "Teacher"];
        if (!allowedRoles.includes(session.role)) {
          return res.status(403).json({ error: "Forbidden: Insufficient permissions to send notifications" });
        }
        const uniqueUserIds = Array.from(new Set(userIds));
        const CHUNK_SIZE = 25;
        for (let i = 0; i < uniqueUserIds.length; i += CHUNK_SIZE) {
          const chunk = uniqueUserIds.slice(i, i + CHUNK_SIZE);
          await Promise.all(chunk.map(
            (targetUserId) => sql`
                            INSERT INTO notifications (id, user_id, title, message, link, is_read, timestamp)
                            VALUES (${crypto9.randomUUID()}, ${targetUserId}, ${title}, ${message}, ${link || null}, false, NOW())
                        `
          ));
        }
        return res.status(200).json({ success: true, count: uniqueUserIds.length });
      }
      return res.status(400).json({ error: "Unknown action specified" });
    } catch (error) {
      console.error("Error handling notification action:", error);
      return res.status(500).json({ error: error.message || "Operation failed" });
    }
  }
  return res.status(405).json({ error: "Method not allowed" });
}

// src/server/apiRouter.ts
var apiRouter = Router();
apiRouter.all("/auth/login", (req, res) => handler(req, res));
apiRouter.all("/auth/me", (req, res) => handler2(req, res));
apiRouter.all("/auth/logout", (req, res) => handler3(req, res));
apiRouter.all("/auth/change-password", (req, res) => handler4(req, res));
apiRouter.all("/auth/register", (req, res) => handler5(req, res));
apiRouter.all("/data", (req, res) => handler6(req, res));
apiRouter.all("/data/students", (req, res) => handler7(req, res));
apiRouter.all("/data/fees", (req, res) => handler8(req, res));
apiRouter.all("/data/users", (req, res) => handler9(req, res));
apiRouter.all("/data/schools", (req, res) => handler10(req, res));
apiRouter.all("/write/payments", (req, res) => handler11(req, res));
apiRouter.all("/write/challans", (req, res) => handler12(req, res));
apiRouter.all("/write/academic", (req, res) => handler13(req, res));
apiRouter.all("/write/students", (req, res) => handler14(req, res));
apiRouter.all("/write/classes", (req, res) => handler15(req, res));
apiRouter.all("/write/users", (req, res) => handler16(req, res));
apiRouter.all("/write/restore", (req, res) => handler17(req, res));
apiRouter.all("/notifications", (req, res) => handler18(req, res));

// src/server/index.ts
var app = express();
app.use(express.json({ limit: "50mb" }));
app.use((req, res, next) => {
  if (req.originalUrl && req.url !== req.originalUrl) {
    req.url = req.originalUrl;
  }
  next();
});
app.use("/api", apiRouter);
app.use("/", apiRouter);
app.use((req, res) => {
  res.status(404).json({ error: `API route not found: ${req.method} ${req.url}` });
});
function handler19(req, res) {
  return app(req, res);
}
export {
  handler19 as default
};
