/**
 * Doctor routes:
 *   GET /api/doctors/me/appointments?date=YYYY-MM-DD
 *   GET /api/doctors/:id/availability?date=YYYY-MM-DD
 *
 * Clinic day: 09:00–16:00 in duration_minutes steps (default 30).
 */

import { Router } from 'express';
import pool from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

const DAY_START_MINUTES = 9 * 60; // 09:00
const DAY_END_MINUTES = 16 * 60; // 16:00 — last slot starts before this

function parseDateParam(value) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return value;
}

function todayLocalISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function minutesToTime(totalMinutes) {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
}

function timeToDisplay(sqlTime) {
  if (sqlTime instanceof Date) {
    const h = sqlTime.getHours();
    const m = sqlTime.getMinutes();
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  const str = String(sqlTime);
  return str.slice(0, 5);
}

/**
 * Logged-in doctor's appointments for a day (default: today).
 * Must be registered before /:id/availability so "me" is not treated as an id.
 */
router.get('/me/appointments', requireAuth('doctor'), async (req, res) => {
  try {
    const doctorId = req.user.id;
    const rawDate = req.query.date;
    const date =
      !rawDate || rawDate === 'today' ? todayLocalISO() : parseDateParam(rawDate);

    if (!date) {
      return res.status(400).json({ error: 'date must be YYYY-MM-DD or today' });
    }

    // no_show_count / risk_flag are computed from patient history (not stored)
    const [rows] = await pool.query(
      `SELECT a.id, a.patient_id, a.doctor_id, a.department_id,
              a.appointment_date, a.appointment_time, a.duration_minutes,
              a.status, a.reason, a.created_at, a.updated_at,
              p.first_name AS patient_first_name,
              p.last_name AS patient_last_name,
              p.phone AS patient_phone,
              dep.name AS department_name,
              COALESCE(ns.no_show_count, 0) AS no_show_count,
              (COALESCE(ns.no_show_count, 0) >= 2) AS risk_flag
       FROM appointments a
       JOIN patients p ON p.id = a.patient_id
       JOIN departments dep ON dep.id = a.department_id
       LEFT JOIN (
         SELECT patient_id, COUNT(*) AS no_show_count
         FROM appointments
         WHERE status = 'no_show'
         GROUP BY patient_id
       ) ns ON ns.patient_id = a.patient_id
       WHERE a.doctor_id = ? AND a.appointment_date = ?
       ORDER BY a.appointment_time ASC`,
      [doctorId, date],
    );

    const appointments = rows.map((row) => ({
      ...row,
      no_show_count: Number(row.no_show_count) || 0,
      risk_flag: Boolean(row.risk_flag),
    }));

    const stats = {
      total: appointments.length,
      pending: appointments.filter((r) => r.status === 'pending').length,
      confirmed: appointments.filter((r) => r.status === 'confirmed').length,
      completed: appointments.filter((r) => r.status === 'completed').length,
      cancelled: appointments.filter((r) => r.status === 'cancelled').length,
      no_show: appointments.filter((r) => r.status === 'no_show').length,
    };

    return res.status(200).json({ date, stats, appointments });
  } catch (err) {
    console.error('Doctor appointments error:', err);
    return res.status(500).json({ error: 'Could not load appointments' });
  }
});

router.get('/:id/availability', async (req, res) => {
  try {
    const doctorId = Number(req.params.id);
    if (!Number.isInteger(doctorId) || doctorId < 1) {
      return res.status(400).json({ error: 'Invalid doctor id' });
    }

    const date = parseDateParam(req.query.date);
    if (!date) {
      return res.status(400).json({ error: 'Query date=YYYY-MM-DD is required' });
    }

    const [doctors] = await pool.query(
      `SELECT id, department_id, first_name, last_name, specialization, is_active
       FROM doctors WHERE id = ? LIMIT 1`,
      [doctorId],
    );

    if (doctors.length === 0) {
      return res.status(404).json({ error: 'Doctor not found' });
    }

    const doctor = doctors[0];
    if (!doctor.is_active) {
      return res.status(400).json({ error: 'Doctor is not available for booking' });
    }

    const durationMinutes = 30;

    const [takenRows] = await pool.query(
      `SELECT appointment_time
       FROM appointments
       WHERE doctor_id = ? AND appointment_date = ? AND status <> 'cancelled'`,
      [doctorId, date],
    );

    const taken = new Set(takenRows.map((r) => timeToDisplay(r.appointment_time)));

    const slots = [];
    for (
      let mins = DAY_START_MINUTES;
      mins + durationMinutes <= DAY_END_MINUTES;
      mins += durationMinutes
    ) {
      const time = minutesToTime(mins);
      const display = time.slice(0, 5);
      if (!taken.has(display)) {
        slots.push({ time: display, duration_minutes: durationMinutes });
      }
    }

    return res.status(200).json({
      doctor: {
        id: doctor.id,
        department_id: doctor.department_id,
        first_name: doctor.first_name,
        last_name: doctor.last_name,
        specialization: doctor.specialization,
      },
      date,
      duration_minutes: durationMinutes,
      slots,
    });
  } catch (err) {
    console.error('Availability error:', err);
    return res.status(500).json({ error: 'Could not load availability' });
  }
});

export default router;
