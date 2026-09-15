/**
 * Appointment booking for patients.
 *   POST /api/appointments — create pending appointment
 *   GET  /api/appointments/upcoming — patient's upcoming visits (Home)
 */

import { Router } from 'express';
import pool from '../../../database/connection.js';
import { requireAuth } from '../middleware/auth.js';
import { notifyWaitlistOnCancel } from '../services/waitlistNotify.js';

const router = Router();

const SLOT_TAKEN_MESSAGE =
  'That slot was just taken — pick another time.';

function isValidDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function normalizeTime(value) {
  if (typeof value !== 'string') return null;
  // Accept "HH:MM" or "HH:MM:SS"
  if (/^\d{2}:\d{2}$/.test(value)) return `${value}:00`;
  if (/^\d{2}:\d{2}:\d{2}$/.test(value)) return value;
  return null;
}

/** Create appointment — patient only; race → 409, not 500 */
router.post('/', requireAuth('patient'), async (req, res) => {
  try {
    const patientId = req.user.id;
    const { doctor_id, department_id, appointment_date, appointment_time, reason } =
      req.body;

    if (!doctor_id || !department_id || !appointment_date || !appointment_time) {
      return res.status(400).json({
        error:
          'Required: doctor_id, department_id, appointment_date, appointment_time',
      });
    }

    if (!isValidDate(appointment_date)) {
      return res.status(400).json({ error: 'appointment_date must be YYYY-MM-DD' });
    }

    const timeSql = normalizeTime(appointment_time);
    if (!timeSql) {
      return res.status(400).json({ error: 'appointment_time must be HH:MM' });
    }

    const [doctors] = await pool.query(
      `SELECT id, department_id, is_active FROM doctors WHERE id = ? LIMIT 1`,
      [doctor_id],
    );

    if (doctors.length === 0) {
      return res.status(400).json({ error: 'Invalid doctor_id' });
    }

    const doctor = doctors[0];
    if (!doctor.is_active) {
      return res.status(400).json({ error: 'Doctor is not available for booking' });
    }

    if (Number(department_id) !== Number(doctor.department_id)) {
      return res.status(400).json({
        error: 'department_id does not match this doctor’s department',
      });
    }

    const durationMinutes = 30;
    const reasonValue =
      typeof reason === 'string' && reason.trim()
        ? reason.trim().slice(0, 500)
        : null;

    const [result] = await pool.query(
      `INSERT INTO appointments
        (patient_id, doctor_id, department_id, appointment_date, appointment_time,
         duration_minutes, status, reason)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`,
      [
        patientId,
        doctor_id,
        department_id,
        appointment_date,
        timeSql,
        durationMinutes,
        reasonValue,
      ],
    );

    const [rows] = await pool.query(
      `SELECT a.id, a.patient_id, a.doctor_id, a.department_id,
              a.appointment_date, a.appointment_time, a.duration_minutes,
              a.status, a.reason, a.created_at,
              d.first_name AS doctor_first_name, d.last_name AS doctor_last_name,
              d.specialization,
              dep.name AS department_name
       FROM appointments a
       JOIN doctors d ON d.id = a.doctor_id
       JOIN departments dep ON dep.id = a.department_id
       WHERE a.id = ?
       LIMIT 1`,
      [result.insertId],
    );

    return res.status(201).json({ appointment: rows[0] });
  } catch (err) {
    // Unique (doctor_id, appointment_date, appointment_time) — race or stale UI
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: SLOT_TAKEN_MESSAGE });
    }
    if (err.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(400).json({ error: 'Invalid doctor or department' });
    }
    console.error('Create appointment error:', err);
    return res.status(500).json({ error: 'Could not create appointment' });
  }
});

/** Upcoming appointments for the signed-in patient (Home) */
router.get('/upcoming', requireAuth('patient'), async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT a.id, a.appointment_date, a.appointment_time, a.status, a.reason,
              dep.name AS department_name,
              CONCAT(d.first_name, ' ', d.last_name) AS doctor_name
       FROM appointments a
       JOIN departments dep ON dep.id = a.department_id
       JOIN doctors d ON d.id = a.doctor_id
       WHERE a.patient_id = ?
         AND a.status IN ('pending', 'confirmed')
         AND a.appointment_date >= CURDATE()
       ORDER BY a.appointment_date ASC, a.appointment_time ASC
       LIMIT 10`,
      [req.user.id],
    );

    return res.status(200).json({ appointments: rows });
  } catch (err) {
    console.error('Upcoming appointments error:', err);
    return res.status(500).json({ error: 'Could not load appointments' });
  }
});

const ALLOWED_STATUSES = new Set([
  'confirmed',
  'completed',
  'cancelled',
  'no_show',
]);

/**
 * Update appointment status — assigned doctor or admin only.
 * PATCH /api/appointments/:id/status  { "status": "confirmed" }
 */
router.patch('/:id/status', requireAuth('doctor', 'admin'), async (req, res) => {
  try {
    const appointmentId = Number(req.params.id);
    if (!Number.isInteger(appointmentId) || appointmentId < 1) {
      return res.status(400).json({ error: 'Invalid appointment id' });
    }

    const { status } = req.body;
    if (!ALLOWED_STATUSES.has(status)) {
      return res.status(400).json({
        error: 'status must be confirmed, completed, cancelled, or no_show',
      });
    }

    const [rows] = await pool.query(
      `SELECT id, doctor_id, department_id, appointment_date, appointment_time, status
       FROM appointments WHERE id = ? LIMIT 1`,
      [appointmentId],
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    const appointment = rows[0];

    if (
      req.user.role === 'doctor' &&
      Number(appointment.doctor_id) !== Number(req.user.id)
    ) {
      return res.status(403).json({
        error: 'You can only update appointments assigned to you',
      });
    }

    await pool.query(
      `UPDATE appointments SET status = ? WHERE id = ?`,
      [status, appointmentId],
    );

    // Freeing a slot → notify oldest matching waitlist entry (log only for now)
    if (status === 'cancelled' && appointment.status !== 'cancelled') {
      try {
        await notifyWaitlistOnCancel({ ...appointment, status: 'cancelled' });
      } catch (notifyErr) {
        console.error('Waitlist notify error:', notifyErr);
      }
    }

    const [updated] = await pool.query(
      `SELECT a.id, a.patient_id, a.doctor_id, a.department_id,
              a.appointment_date, a.appointment_time, a.duration_minutes,
              a.status, a.reason, a.created_at, a.updated_at,
              p.first_name AS patient_first_name,
              p.last_name AS patient_last_name,
              dep.name AS department_name
       FROM appointments a
       JOIN patients p ON p.id = a.patient_id
       JOIN departments dep ON dep.id = a.department_id
       WHERE a.id = ?
       LIMIT 1`,
      [appointmentId],
    );

    return res.status(200).json({ appointment: updated[0] });
  } catch (err) {
    console.error('Update appointment status error:', err);
    return res.status(500).json({ error: 'Could not update status' });
  }
});

export default router;
