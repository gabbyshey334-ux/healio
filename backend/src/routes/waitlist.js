/**
 * Patient waitlist routes:
 *   POST   /api/waitlist
 *   GET    /api/waitlist/me
 *   PATCH  /api/waitlist/:id          — cancel own entry
 *   POST   /api/waitlist/:id/convert  — book the notified slot
 */

import { Router } from 'express';
import pool from '../../../database/connection.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

const PERIODS = new Set(['morning', 'afternoon', 'any']);
const SLOT_TAKEN_MESSAGE =
  'That slot was just taken — pick another time.';

function isValidDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function normalizeTime(value) {
  if (typeof value !== 'string') return null;
  if (/^\d{2}:\d{2}$/.test(value)) return `${value}:00`;
  if (/^\d{2}:\d{2}:\d{2}$/.test(value)) return value;
  return null;
}

function formatTimeDisplay(sqlTime) {
  if (sqlTime instanceof Date) {
    return `${String(sqlTime.getHours()).padStart(2, '0')}:${String(sqlTime.getMinutes()).padStart(2, '0')}`;
  }
  return String(sqlTime).slice(0, 5);
}

async function fetchWaitlistRow(id) {
  const [rows] = await pool.query(
    `SELECT w.*, dep.name AS department_name,
            d.first_name AS doctor_first_name,
            d.last_name AS doctor_last_name,
            d.specialization AS doctor_specialization,
            nd.first_name AS notified_doctor_first_name,
            nd.last_name AS notified_doctor_last_name,
            nd.specialization AS notified_doctor_specialization,
            nd.department_id AS notified_doctor_department_id
     FROM waitlist w
     JOIN departments dep ON dep.id = w.department_id
     LEFT JOIN doctors d ON d.id = w.doctor_id
     LEFT JOIN doctors nd ON nd.id = w.notified_doctor_id
     WHERE w.id = ?
     LIMIT 1`,
    [id],
  );
  return rows[0] || null;
}

/** Join waitlist — patient only */
router.post('/', requireAuth('patient'), async (req, res) => {
  try {
    const patientId = req.user.id;
    const {
      department_id,
      doctor_id,
      preferred_date,
      preferred_period = 'any',
      notes,
    } = req.body;

    if (!department_id) {
      return res.status(400).json({ error: 'department_id is required' });
    }

    if (!PERIODS.has(preferred_period)) {
      return res.status(400).json({
        error: 'preferred_period must be morning, afternoon, or any',
      });
    }

    if (preferred_date && !isValidDate(preferred_date)) {
      return res.status(400).json({ error: 'preferred_date must be YYYY-MM-DD' });
    }

    const [deps] = await pool.query(
      `SELECT id FROM departments WHERE id = ? LIMIT 1`,
      [department_id],
    );
    if (deps.length === 0) {
      return res.status(400).json({ error: 'Invalid department_id' });
    }

    let doctorId = null;
    if (doctor_id !== undefined && doctor_id !== null && doctor_id !== '') {
      const [docs] = await pool.query(
        `SELECT id, department_id, is_active FROM doctors WHERE id = ? LIMIT 1`,
        [doctor_id],
      );
      if (docs.length === 0) {
        return res.status(400).json({ error: 'Invalid doctor_id' });
      }
      if (Number(docs[0].department_id) !== Number(department_id)) {
        return res.status(400).json({
          error: 'doctor_id does not belong to this department',
        });
      }
      doctorId = docs[0].id;
    }

    const [dupes] = await pool.query(
      `SELECT id FROM waitlist
       WHERE patient_id = ?
         AND department_id = ?
         AND status = 'waiting'
         AND ((? IS NULL AND doctor_id IS NULL) OR doctor_id = ?)
         AND ((? IS NULL AND preferred_date IS NULL) OR preferred_date = ?)
       LIMIT 1`,
      [
        patientId,
        department_id,
        doctorId,
        doctorId,
        preferred_date || null,
        preferred_date || null,
      ],
    );

    if (dupes.length > 0) {
      return res.status(409).json({
        error: 'You are already on the waitlist for this preference',
      });
    }

    const [result] = await pool.query(
      `INSERT INTO waitlist
        (patient_id, department_id, doctor_id, preferred_date, preferred_period, notes, status)
       VALUES (?, ?, ?, ?, ?, ?, 'waiting')`,
      [
        patientId,
        department_id,
        doctorId,
        preferred_date || null,
        preferred_period,
        typeof notes === 'string' && notes.trim()
          ? notes.trim().slice(0, 500)
          : null,
      ],
    );

    const row = await fetchWaitlistRow(result.insertId);
    return res.status(201).json({ waitlist: row });
  } catch (err) {
    console.error('Join waitlist error:', err);
    return res.status(500).json({ error: 'Could not join waitlist' });
  }
});

/** Patient's own waitlist entries */
router.get('/me', requireAuth('patient'), async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT w.*, dep.name AS department_name,
              d.first_name AS doctor_first_name,
              d.last_name AS doctor_last_name,
              d.specialization AS doctor_specialization,
              nd.first_name AS notified_doctor_first_name,
              nd.last_name AS notified_doctor_last_name,
              nd.specialization AS notified_doctor_specialization
       FROM waitlist w
       JOIN departments dep ON dep.id = w.department_id
       LEFT JOIN doctors d ON d.id = w.doctor_id
       LEFT JOIN doctors nd ON nd.id = w.notified_doctor_id
       WHERE w.patient_id = ?
       ORDER BY
         FIELD(w.status, 'notified', 'waiting', 'booked', 'cancelled', 'expired'),
         w.created_at DESC`,
      [req.user.id],
    );

    return res.status(200).json({ waitlist: rows });
  } catch (err) {
    console.error('My waitlist error:', err);
    return res.status(500).json({ error: 'Could not load waitlist' });
  }
});

/**
 * Cancel own waitlist entry.
 * PATCH /api/waitlist/:id  { "status": "cancelled" }
 */
router.patch('/:id', requireAuth('patient'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ error: 'Invalid waitlist id' });
    }

    if (req.body.status !== 'cancelled') {
      return res.status(400).json({ error: 'Only status "cancelled" is allowed here' });
    }

    const [rows] = await pool.query(
      `SELECT id, patient_id, status FROM waitlist WHERE id = ? LIMIT 1`,
      [id],
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Waitlist entry not found' });
    }
    if (Number(rows[0].patient_id) !== Number(req.user.id)) {
      return res.status(403).json({ error: 'You can only update your own waitlist entries' });
    }
    if (!['waiting', 'notified'].includes(rows[0].status)) {
      return res.status(400).json({
        error: 'Only waiting or notified entries can be cancelled',
      });
    }

    await pool.query(`UPDATE waitlist SET status = 'cancelled' WHERE id = ?`, [id]);
    const row = await fetchWaitlistRow(id);
    return res.status(200).json({ waitlist: row });
  } catch (err) {
    console.error('Cancel waitlist error:', err);
    return res.status(500).json({ error: 'Could not cancel waitlist entry' });
  }
});

/**
 * Convert a notified waitlist entry into a pending appointment for the freed slot.
 * POST /api/waitlist/:id/convert
 * Body optional overrides: doctor_id, appointment_date, appointment_time
 * Defaults to notified_* values stored when the slot opened.
 */
router.post('/:id/convert', requireAuth('patient'), async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ error: 'Invalid waitlist id' });
    }

    await connection.beginTransaction();

    const [rows] = await connection.query(
      `SELECT * FROM waitlist WHERE id = ? LIMIT 1 FOR UPDATE`,
      [id],
    );
    if (rows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Waitlist entry not found' });
    }

    const entry = rows[0];
    if (Number(entry.patient_id) !== Number(req.user.id)) {
      await connection.rollback();
      return res.status(403).json({ error: 'You can only convert your own waitlist entries' });
    }
    if (entry.status !== 'notified') {
      await connection.rollback();
      return res.status(400).json({
        error: 'Only notified waitlist entries can be converted to a booking',
      });
    }

    const doctorId = Number(
      req.body.doctor_id ?? entry.notified_doctor_id ?? entry.doctor_id,
    );
    const appointmentDate =
      req.body.appointment_date ||
      (entry.notified_date
        ? formatDateValue(entry.notified_date)
        : null);
    const timeRaw =
      req.body.appointment_time ||
      (entry.notified_time ? formatTimeDisplay(entry.notified_time) : null);
    const timeSql = normalizeTime(timeRaw);

    if (!doctorId || !appointmentDate || !timeSql) {
      await connection.rollback();
      return res.status(400).json({
        error:
          'A freed slot is required (doctor_id, appointment_date, appointment_time). Re-check My Waitlist.',
      });
    }

    if (!isValidDate(appointmentDate)) {
      await connection.rollback();
      return res.status(400).json({ error: 'appointment_date must be YYYY-MM-DD' });
    }

    const [doctors] = await connection.query(
      `SELECT id, department_id, is_active FROM doctors WHERE id = ? LIMIT 1`,
      [doctorId],
    );
    if (doctors.length === 0 || !doctors[0].is_active) {
      await connection.rollback();
      return res.status(400).json({ error: 'Doctor is not available for booking' });
    }

    const departmentId = doctors[0].department_id;

    try {
      const [result] = await connection.query(
        `INSERT INTO appointments
          (patient_id, doctor_id, department_id, appointment_date, appointment_time,
           duration_minutes, status, reason)
         VALUES (?, ?, ?, ?, ?, 30, 'pending', ?)`,
        [
          req.user.id,
          doctorId,
          departmentId,
          appointmentDate,
          timeSql,
          'Booked from waitlist',
        ],
      );

      await connection.query(
        `UPDATE waitlist SET status = 'booked' WHERE id = ?`,
        [id],
      );

      await connection.commit();

      const [apptRows] = await pool.query(
        `SELECT a.*, 
                d.first_name AS doctor_first_name, d.last_name AS doctor_last_name,
                dep.name AS department_name
         FROM appointments a
         JOIN doctors d ON d.id = a.doctor_id
         JOIN departments dep ON dep.id = a.department_id
         WHERE a.id = ?
         LIMIT 1`,
        [result.insertId],
      );

      const waitlist = await fetchWaitlistRow(id);

      return res.status(201).json({
        appointment: apptRows[0],
        waitlist,
      });
    } catch (insertErr) {
      await connection.rollback();
      if (insertErr.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ error: SLOT_TAKEN_MESSAGE });
      }
      throw insertErr;
    }
  } catch (err) {
    try {
      await connection.rollback();
    } catch {
      /* ignore */
    }
    console.error('Convert waitlist error:', err);
    return res.status(500).json({ error: 'Could not convert waitlist entry' });
  } finally {
    connection.release();
  }
});

function formatDateValue(value) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

export default router;
