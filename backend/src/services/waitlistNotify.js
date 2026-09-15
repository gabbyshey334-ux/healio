/**
 * Waitlist helpers — notify the oldest matching patient when a slot frees up.
 */

import pool from '../../../database/connection.js';

function periodFromTime(sqlTime) {
  let hour = 0;
  if (sqlTime instanceof Date) {
    hour = sqlTime.getHours();
  } else {
    hour = Number(String(sqlTime).slice(0, 2));
  }
  return hour < 12 ? 'morning' : 'afternoon';
}

function formatDate(value) {
  if (!value) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function formatTime(sqlTime) {
  if (sqlTime instanceof Date) {
    const h = sqlTime.getHours();
    const m = sqlTime.getMinutes();
    const s = sqlTime.getSeconds();
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  const str = String(sqlTime);
  if (/^\d{2}:\d{2}$/.test(str)) return `${str}:00`;
  return str.slice(0, 8);
}

/**
 * After an appointment is cancelled, find the oldest matching waitlist entry,
 * mark it notified (with the freed slot), and log a notification.
 */
export async function notifyWaitlistOnCancel(appointment) {
  const departmentId = appointment.department_id;
  const doctorId = appointment.doctor_id;
  const apptDate = formatDate(appointment.appointment_date);
  const apptTime = formatTime(appointment.appointment_time);
  const period = periodFromTime(appointment.appointment_time);

  const [candidates] = await pool.query(
    `SELECT w.*, p.email AS patient_email, p.first_name AS patient_first_name
     FROM waitlist w
     JOIN patients p ON p.id = w.patient_id
     WHERE w.status = 'waiting'
       AND w.department_id = ?
       AND (w.doctor_id IS NULL OR w.doctor_id = ?)
       AND (w.preferred_date IS NULL OR w.preferred_date = ?)
     ORDER BY w.created_at ASC
     LIMIT 20`,
    [departmentId, doctorId, apptDate],
  );

  const match = candidates.find((row) => {
    if (row.preferred_period === 'any') return true;
    return row.preferred_period === period;
  });

  if (!match) {
    console.log(
      `[waitlist] No matching waitlist entry for cancelled appointment #${appointment.id}`,
    );
    return null;
  }

  await pool.query(
    `UPDATE waitlist
     SET status = 'notified',
         notified_doctor_id = ?,
         notified_date = ?,
         notified_time = ?
     WHERE id = ?`,
    [doctorId, apptDate, apptTime, match.id],
  );

  const timeLabel = apptTime.slice(0, 5);
  const message =
    `A slot opened: ${apptDate} at ${timeLabel} ` +
    `(department #${departmentId}, doctor #${doctorId}). ` +
    `Open My Waitlist in Healio and tap Book now.`;

  await pool.query(
    `INSERT INTO notifications
      (patient_id, waitlist_id, appointment_id, channel, message)
     VALUES (?, ?, ?, 'log', ?)`,
    [match.patient_id, match.id, appointment.id, message],
  );

  console.log(
    `[waitlist] Notified patient #${match.patient_id} (${match.patient_email}) ` +
      `for waitlist #${match.id}: ${message}`,
  );

  return match;
}
