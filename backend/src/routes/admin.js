/**
 * Admin API — clinic-wide management. Admin role only (403 for others).
 *
 *   GET    /api/admin/analytics
 *   GET    /api/admin/departments
 *   POST   /api/admin/departments
 *   PATCH  /api/admin/departments/:id
 *   GET    /api/admin/doctors
 *   PATCH  /api/admin/doctors/:id
 *   GET    /api/admin/appointments
 */

import { Router } from 'express';
import pool from '../../../database/connection.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth('admin'));

function todayLocalISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function startOfWeekISO() {
  const d = new Date();
  const day = d.getDay(); // 0 Sun
  const diff = day === 0 ? -6 : 1 - day; // Monday start
  d.setDate(d.getDate() + diff);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Summary stats for the admin home */
router.get('/analytics', async (_req, res) => {
  try {
    const today = todayLocalISO();
    const weekStart = startOfWeekISO();

    const [[todayRow]] = await pool.query(
      `SELECT COUNT(*) AS count FROM appointments WHERE appointment_date = ?`,
      [today],
    );

    const [[weekRow]] = await pool.query(
      `SELECT COUNT(*) AS count FROM appointments
       WHERE appointment_date BETWEEN ? AND ?`,
      [weekStart, today],
    );

    const [[statusRow]] = await pool.query(
      `SELECT
         SUM(status = 'no_show') AS no_shows,
         SUM(status IN ('completed', 'no_show', 'cancelled')) AS closed
       FROM appointments
       WHERE appointment_date BETWEEN ? AND ?`,
      [weekStart, today],
    );

    const closed = Number(statusRow.closed) || 0;
    const noShows = Number(statusRow.no_shows) || 0;
    const noShowRate =
      closed > 0 ? Math.round((noShows / closed) * 1000) / 10 : 0;

    const [busiestRows] = await pool.query(
      `SELECT d.id, d.first_name, d.last_name, COUNT(a.id) AS appointment_count
       FROM doctors d
       LEFT JOIN appointments a
         ON a.doctor_id = d.id
        AND a.appointment_date BETWEEN ? AND ?
       GROUP BY d.id, d.first_name, d.last_name
       ORDER BY appointment_count DESC, d.last_name ASC
       LIMIT 1`,
      [weekStart, today],
    );

    const [perDepartment] = await pool.query(
      `SELECT dep.id, dep.name, COUNT(a.id) AS appointment_count
       FROM departments dep
       LEFT JOIN appointments a
         ON a.department_id = dep.id
        AND a.appointment_date BETWEEN ? AND ?
       GROUP BY dep.id, dep.name
       ORDER BY appointment_count DESC, dep.name ASC`,
      [weekStart, today],
    );

    const busiest = busiestRows[0] || null;

    return res.status(200).json({
      period: { today, week_start: weekStart },
      appointments_today: Number(todayRow.count) || 0,
      appointments_this_week: Number(weekRow.count) || 0,
      no_show_rate_percent: noShowRate,
      no_shows_this_week: noShows,
      busiest_doctor: busiest
        ? {
            id: busiest.id,
            name: `${busiest.first_name} ${busiest.last_name}`,
            appointment_count: Number(busiest.appointment_count) || 0,
          }
        : null,
      appointments_per_department: perDepartment.map((r) => ({
        id: r.id,
        name: r.name,
        appointment_count: Number(r.appointment_count) || 0,
      })),
    });
  } catch (err) {
    console.error('Admin analytics error:', err);
    return res.status(500).json({ error: 'Could not load analytics' });
  }
});

router.get('/departments', async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT d.id, d.name, d.description, d.created_at, d.updated_at,
              (SELECT COUNT(*) FROM doctors doc WHERE doc.department_id = d.id) AS doctor_count
       FROM departments d
       ORDER BY d.name ASC`,
    );
    return res.status(200).json({ departments: rows });
  } catch (err) {
    console.error('Admin list departments error:', err);
    return res.status(500).json({ error: 'Could not load departments' });
  }
});

router.post('/departments', async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'Department name is required' });
    }

    const [result] = await pool.query(
      `INSERT INTO departments (name, description) VALUES (?, ?)`,
      [String(name).trim(), description?.trim() || null],
    );

    const [rows] = await pool.query(
      `SELECT id, name, description, created_at, updated_at FROM departments WHERE id = ?`,
      [result.insertId],
    );

    return res.status(201).json({ department: rows[0] });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'A department with that name already exists' });
    }
    console.error('Admin create department error:', err);
    return res.status(500).json({ error: 'Could not create department' });
  }
});

router.patch('/departments/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ error: 'Invalid department id' });
    }

    const { name, description } = req.body;
    if (name !== undefined && !String(name).trim()) {
      return res.status(400).json({ error: 'Department name cannot be empty' });
    }

    const [existing] = await pool.query(
      `SELECT id, name, description FROM departments WHERE id = ? LIMIT 1`,
      [id],
    );
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Department not found' });
    }

    const nextName = name !== undefined ? String(name).trim() : existing[0].name;
    const nextDesc =
      description !== undefined
        ? description === null || description === ''
          ? null
          : String(description).trim()
        : existing[0].description;

    await pool.query(
      `UPDATE departments SET name = ?, description = ? WHERE id = ?`,
      [nextName, nextDesc, id],
    );

    const [rows] = await pool.query(
      `SELECT id, name, description, created_at, updated_at FROM departments WHERE id = ?`,
      [id],
    );

    return res.status(200).json({ department: rows[0] });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'A department with that name already exists' });
    }
    console.error('Admin update department error:', err);
    return res.status(500).json({ error: 'Could not update department' });
  }
});

router.get('/doctors', async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT d.id, d.department_id, d.first_name, d.last_name, d.email,
              d.phone, d.specialization, d.is_active, d.created_at, d.updated_at,
              dep.name AS department_name
       FROM doctors d
       JOIN departments dep ON dep.id = d.department_id
       ORDER BY d.is_active DESC, d.last_name ASC, d.first_name ASC`,
    );
    return res.status(200).json({ doctors: rows });
  } catch (err) {
    console.error('Admin list doctors error:', err);
    return res.status(500).json({ error: 'Could not load doctors' });
  }
});

router.patch('/doctors/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ error: 'Invalid doctor id' });
    }

    const [existing] = await pool.query(
      `SELECT * FROM doctors WHERE id = ? LIMIT 1`,
      [id],
    );
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Doctor not found' });
    }

    const current = existing[0];
    const {
      department_id,
      first_name,
      last_name,
      phone,
      specialization,
      is_active,
    } = req.body;

    if (department_id !== undefined) {
      const [deps] = await pool.query(
        `SELECT id FROM departments WHERE id = ? LIMIT 1`,
        [department_id],
      );
      if (deps.length === 0) {
        return res.status(400).json({ error: 'Invalid department_id' });
      }
    }

    const next = {
      department_id:
        department_id !== undefined ? department_id : current.department_id,
      first_name:
        first_name !== undefined ? String(first_name).trim() : current.first_name,
      last_name:
        last_name !== undefined ? String(last_name).trim() : current.last_name,
      phone: phone !== undefined ? phone?.trim() || null : current.phone,
      specialization:
        specialization !== undefined
          ? specialization?.trim() || null
          : current.specialization,
      is_active:
        is_active !== undefined ? (is_active ? 1 : 0) : current.is_active,
    };

    if (!next.first_name || !next.last_name) {
      return res.status(400).json({ error: 'First and last name are required' });
    }

    await pool.query(
      `UPDATE doctors
       SET department_id = ?, first_name = ?, last_name = ?, phone = ?,
           specialization = ?, is_active = ?
       WHERE id = ?`,
      [
        next.department_id,
        next.first_name,
        next.last_name,
        next.phone,
        next.specialization,
        next.is_active,
        id,
      ],
    );

    const [rows] = await pool.query(
      `SELECT d.id, d.department_id, d.first_name, d.last_name, d.email,
              d.phone, d.specialization, d.is_active, d.created_at, d.updated_at,
              dep.name AS department_name
       FROM doctors d
       JOIN departments dep ON dep.id = d.department_id
       WHERE d.id = ?`,
      [id],
    );

    return res.status(200).json({ doctor: rows[0] });
  } catch (err) {
    console.error('Admin update doctor error:', err);
    return res.status(500).json({ error: 'Could not update doctor' });
  }
});

router.get('/appointments', async (req, res) => {
  try {
    const { department_id, doctor_id, date, status } = req.query;
    const clauses = [];
    const params = [];

    if (department_id) {
      clauses.push('a.department_id = ?');
      params.push(Number(department_id));
    }
    if (doctor_id) {
      clauses.push('a.doctor_id = ?');
      params.push(Number(doctor_id));
    }
    if (date) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ error: 'date must be YYYY-MM-DD' });
      }
      clauses.push('a.appointment_date = ?');
      params.push(date);
    }
    if (status) {
      const allowed = new Set([
        'pending',
        'confirmed',
        'completed',
        'cancelled',
        'no_show',
      ]);
      if (!allowed.has(status)) {
        return res.status(400).json({ error: 'Invalid status filter' });
      }
      clauses.push('a.status = ?');
      params.push(status);
    }

    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

    // no_show_count / risk_flag computed from patient history (not stored)
    const [rows] = await pool.query(
      `SELECT a.id, a.patient_id, a.doctor_id, a.department_id,
              a.appointment_date, a.appointment_time, a.duration_minutes,
              a.status, a.reason, a.created_at,
              p.first_name AS patient_first_name,
              p.last_name AS patient_last_name,
              d.first_name AS doctor_first_name,
              d.last_name AS doctor_last_name,
              dep.name AS department_name,
              COALESCE(ns.no_show_count, 0) AS no_show_count,
              (COALESCE(ns.no_show_count, 0) >= 2) AS risk_flag
       FROM appointments a
       JOIN patients p ON p.id = a.patient_id
       JOIN doctors d ON d.id = a.doctor_id
       JOIN departments dep ON dep.id = a.department_id
       LEFT JOIN (
         SELECT patient_id, COUNT(*) AS no_show_count
         FROM appointments
         WHERE status = 'no_show'
         GROUP BY patient_id
       ) ns ON ns.patient_id = a.patient_id
       ${where}
       ORDER BY a.appointment_date DESC, a.appointment_time DESC
       LIMIT 200`,
      params,
    );

    const appointments = rows.map((row) => ({
      ...row,
      no_show_count: Number(row.no_show_count) || 0,
      risk_flag: Boolean(row.risk_flag),
    }));

    return res.status(200).json({ appointments });
  } catch (err) {
    console.error('Admin list appointments error:', err);
    return res.status(500).json({ error: 'Could not load appointments' });
  }
});

/** All waitlist entries clinic-wide */
router.get('/waitlist', async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT w.*,
              p.first_name AS patient_first_name,
              p.last_name AS patient_last_name,
              p.email AS patient_email,
              dep.name AS department_name,
              d.first_name AS doctor_first_name,
              d.last_name AS doctor_last_name
       FROM waitlist w
       JOIN patients p ON p.id = w.patient_id
       JOIN departments dep ON dep.id = w.department_id
       LEFT JOIN doctors d ON d.id = w.doctor_id
       ORDER BY w.created_at DESC
       LIMIT 300`,
    );
    return res.status(200).json({ waitlist: rows });
  } catch (err) {
    console.error('Admin waitlist error:', err);
    return res.status(500).json({ error: 'Could not load waitlist' });
  }
});

export default router;
