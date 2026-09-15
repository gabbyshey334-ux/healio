/**
 * Auth routes:
 *   POST /api/auth/patients/register
 *   POST /api/auth/patients/login
 *   POST /api/auth/doctors/login
 *   POST /api/auth/admins/login
 *   POST /api/auth/admins/doctors  (admin creates doctor accounts)
 */

import { Router } from 'express';
import bcrypt from 'bcryptjs';
import pool from '../../../database/connection.js';
import { signToken } from '../utils/jwt.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
const SALT_ROUNDS = 10;

function publicUser(row, role) {
  return {
    id: row.id,
    first_name: row.first_name,
    last_name: row.last_name,
    email: row.email,
    role,
  };
}

/** Patient self-registration */
router.post('/patients/register', async (req, res) => {
  try {
    const {
      matric_or_staff_id,
      first_name,
      last_name,
      email,
      password,
      phone,
      gender,
      date_of_birth,
      user_type,
    } = req.body;

    if (!matric_or_staff_id || !first_name || !last_name || !email || !password || !user_type) {
      return res.status(400).json({
        error: 'Required: matric_or_staff_id, first_name, last_name, email, password, user_type',
      });
    }

    if (!['student', 'staff'].includes(user_type)) {
      return res.status(400).json({ error: 'user_type must be student or staff' });
    }

    if (String(password).length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

    const [result] = await pool.query(
      `INSERT INTO patients
        (matric_or_staff_id, first_name, last_name, email, password_hash, phone, gender, date_of_birth, user_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        matric_or_staff_id,
        first_name,
        last_name,
        email.toLowerCase().trim(),
        password_hash,
        phone || null,
        gender || null,
        date_of_birth || null,
        user_type,
      ],
    );

    const user = {
      id: result.insertId,
      first_name,
      last_name,
      email: email.toLowerCase().trim(),
      role: 'patient',
    };
    const token = signToken({ id: user.id, role: 'patient', email: user.email });

    return res.status(201).json({ token, user });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Email or matric/staff ID already registered' });
    }
    console.error('Patient register error:', err);
    return res.status(500).json({ error: 'Registration failed' });
  }
});

/** Shared login helper for patients / doctors / admins */
async function loginFromTable(table, role, email, password, res) {
  const allowedTables = { patients: true, doctors: true, admins: true };
  if (!allowedTables[table]) {
    return res.status(500).json({ error: 'Login misconfigured' });
  }

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const [rows] = await pool.query(
    `SELECT * FROM ${table} WHERE email = ? LIMIT 1`,
    [email.toLowerCase().trim()],
  );

  if (rows.length === 0) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const row = rows[0];

  if (role === 'doctor' && row.is_active === 0) {
    return res.status(403).json({ error: 'Doctor account is inactive' });
  }

  const match = await bcrypt.compare(password, row.password_hash);
  if (!match) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const user = publicUser(row, role);
  const token = signToken({ id: user.id, role, email: user.email });
  return res.status(200).json({ token, user });
}

router.post('/patients/login', async (req, res) => {
  try {
    return await loginFromTable('patients', 'patient', req.body.email, req.body.password, res);
  } catch (err) {
    console.error('Patient login error:', err);
    return res.status(500).json({ error: 'Login failed' });
  }
});

router.post('/doctors/login', async (req, res) => {
  try {
    return await loginFromTable('doctors', 'doctor', req.body.email, req.body.password, res);
  } catch (err) {
    console.error('Doctor login error:', err);
    return res.status(500).json({ error: 'Login failed' });
  }
});

router.post('/admins/login', async (req, res) => {
  try {
    return await loginFromTable('admins', 'admin', req.body.email, req.body.password, res);
  } catch (err) {
    console.error('Admin login error:', err);
    return res.status(500).json({ error: 'Login failed' });
  }
});

/**
 * Admin creates a doctor account (no public doctor registration).
 * POST /api/auth/admins/doctors
 */
router.post('/admins/doctors', requireAuth('admin'), async (req, res) => {
  try {
    const {
      department_id,
      first_name,
      last_name,
      email,
      password,
      phone,
      specialization,
    } = req.body;

    if (!department_id || !first_name || !last_name || !email || !password) {
      return res.status(400).json({
        error: 'Required: department_id, first_name, last_name, email, password',
      });
    }

    if (String(password).length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

    const [result] = await pool.query(
      `INSERT INTO doctors
        (department_id, first_name, last_name, email, password_hash, phone, specialization)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        department_id,
        first_name,
        last_name,
        email.toLowerCase().trim(),
        password_hash,
        phone || null,
        specialization || null,
      ],
    );

    return res.status(201).json({
      doctor: {
        id: result.insertId,
        department_id,
        first_name,
        last_name,
        email: email.toLowerCase().trim(),
        specialization: specialization || null,
        role: 'doctor',
      },
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Doctor email already exists' });
    }
    if (err.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(400).json({ error: 'Invalid department_id' });
    }
    console.error('Create doctor error:', err);
    return res.status(500).json({ error: 'Could not create doctor account' });
  }
});

/** Who am I — validates token */
router.get('/me', requireAuth(), (req, res) => {
  return res.status(200).json({ user: req.user });
});

export default router;
