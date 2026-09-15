/**
 * Critical-path integration tests for Healio.
 *
 * Covers:
 *   1. Booking a free slot
 *   2. Double-booking prevention (409)
 *   3. Waitlist notify-on-cancel
 *   4. No-show risk flag (count >= 2)
 *
 * Requires a running MySQL with migrations applied.
 * Starts its own Express server on an ephemeral port.
 *
 *   npm test
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import pool from '../../database/connection.js';
import app from '../src/app.js';

dotenv.config();

let server;
let baseUrl;
let doctorId;
let departmentId;

function isoDaysFromToday(offset) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function json(res) {
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

async function registerPatient(suffix) {
  const email = `test.${suffix}.${Date.now()}@student.fpi.edu.ng`;
  const res = await fetch(`${baseUrl}/api/auth/patients/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      matric_or_staff_id: `TEST/${suffix}/${Date.now()}`,
      first_name: 'Test',
      last_name: suffix,
      email,
      password: 'Patient123!',
      user_type: 'student',
    }),
  });
  const data = await json(res);
  assert.equal(data.status, 201, `register failed: ${JSON.stringify(data.body)}`);
  return {
    token: data.body.token,
    id: data.body.user?.id || data.body.patient?.id,
    email,
  };
}

async function loginDoctor() {
  const email = process.env.SEED_DOCTOR_EMAIL || 'doctor@healio.local';
  const password = process.env.SEED_DOCTOR_PASSWORD || 'Doctor123!';
  const res = await fetch(`${baseUrl}/api/auth/doctors/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await json(res);
  assert.equal(data.status, 200, `doctor login failed: ${JSON.stringify(data.body)}`);
  return data.body.token;
}

before(async () => {
  // Ensure a known active doctor exists for tests
  const email = process.env.SEED_DOCTOR_EMAIL || 'doctor@healio.local';
  const password = process.env.SEED_DOCTOR_PASSWORD || 'Doctor123!';
  const hash = await bcrypt.hash(password, 10);

  await pool.query(
    `INSERT INTO departments (id, name, description)
     VALUES (1, 'General Outpatient', 'General consultations')
     ON DUPLICATE KEY UPDATE name = VALUES(name)`,
  );

  await pool.query(
    `INSERT INTO doctors
      (department_id, first_name, last_name, email, password_hash, specialization, is_active)
     VALUES (1, 'Ada', 'Okoro', ?, ?, 'General Practice', 1)
     ON DUPLICATE KEY UPDATE
       password_hash = VALUES(password_hash),
       is_active = 1,
       department_id = 1`,
    [email, hash],
  );

  const [docs] = await pool.query(
    'SELECT id, department_id FROM doctors WHERE email = ? LIMIT 1',
    [email],
  );
  doctorId = docs[0].id;
  departmentId = docs[0].department_id;

  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

after(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await pool.end();
});

describe('Booking a slot', () => {
  it('creates a pending appointment for a free slot', async () => {
    const patient = await registerPatient('book');
    const date = isoDaysFromToday(3);
    const time = '15:00';

    const res = await fetch(`${baseUrl}/api/appointments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${patient.token}`,
      },
      body: JSON.stringify({
        doctor_id: doctorId,
        department_id: departmentId,
        appointment_date: date,
        appointment_time: time,
        reason: 'Test booking',
      }),
    });
    const data = await json(res);

    assert.equal(data.status, 201);
    assert.equal(data.body.appointment.status, 'pending');
    assert.equal(Number(data.body.appointment.doctor_id), doctorId);
  });
});

describe('Double-booking prevention', () => {
  it('returns 409 when a second patient takes the same slot', async () => {
    const date = isoDaysFromToday(4);
    const time = '15:30';

    const first = await registerPatient('dup1');
    const second = await registerPatient('dup2');

    const firstBook = await fetch(`${baseUrl}/api/appointments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${first.token}`,
      },
      body: JSON.stringify({
        doctor_id: doctorId,
        department_id: departmentId,
        appointment_date: date,
        appointment_time: time,
      }),
    });
    assert.equal((await json(firstBook)).status, 201);

    const race = await fetch(`${baseUrl}/api/appointments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${second.token}`,
      },
      body: JSON.stringify({
        doctor_id: doctorId,
        department_id: departmentId,
        appointment_date: date,
        appointment_time: time,
      }),
    });
    const data = await json(race);

    assert.equal(data.status, 409);
    assert.match(String(data.body.error || ''), /taken|slot/i);
  });
});

describe('Waitlist notify-on-cancel', () => {
  it('marks the oldest matching waitlist entry as notified when a slot frees', async () => {
    const date = isoDaysFromToday(5);
    const time = '14:00';

    // Isolate from any leftover waiting entries for this department
    await pool.query(
      `UPDATE waitlist SET status = 'expired'
       WHERE status = 'waiting' AND department_id = ?`,
      [departmentId],
    );

    const waiter = await registerPatient('waiter');
    const booker = await registerPatient('booker');

    const join = await fetch(`${baseUrl}/api/waitlist`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${waiter.token}`,
      },
      body: JSON.stringify({
        department_id: departmentId,
        doctor_id: doctorId,
        preferred_date: date,
        preferred_period: 'any',
      }),
    });
    const joined = await json(join);
    assert.equal(joined.status, 201, JSON.stringify(joined.body));
    const waitlistId = joined.body.waitlist.id;

    const booked = await fetch(`${baseUrl}/api/appointments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${booker.token}`,
      },
      body: JSON.stringify({
        doctor_id: doctorId,
        department_id: departmentId,
        appointment_date: date,
        appointment_time: time,
        reason: 'Will cancel',
      }),
    });
    const appt = await json(booked);
    assert.equal(appt.status, 201, JSON.stringify(appt.body));

    const doctorToken = await loginDoctor();
    const cancel = await fetch(
      `${baseUrl}/api/appointments/${appt.body.appointment.id}/status`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${doctorToken}`,
        },
        body: JSON.stringify({ status: 'cancelled' }),
      },
    );
    assert.equal((await json(cancel)).status, 200);

    const me = await fetch(`${baseUrl}/api/waitlist/me`, {
      headers: { Authorization: `Bearer ${waiter.token}` },
    });
    const list = await json(me);
    assert.equal(list.status, 200);
    const entry = list.body.waitlist.find((w) => w.id === waitlistId);
    assert.ok(entry, 'waitlist entry missing');
    assert.equal(entry.status, 'notified');
    assert.equal(Number(entry.notified_doctor_id), doctorId);
    assert.ok(entry.notified_date);
    assert.ok(entry.notified_time);
  });
});

describe('No-show risk flag', () => {
  it('sets risk_flag true when the patient has 2+ past no-shows', async () => {
    const patient = await registerPatient('risk');
    const date = isoDaysFromToday(20);
    const time = '15:00';

    // Two historical no-shows for this patient
    await pool.query(
      `INSERT INTO appointments
        (patient_id, doctor_id, department_id, appointment_date, appointment_time, status, reason)
       VALUES
         (?, ?, ?, ?, '09:00:00', 'no_show', 'miss 1'),
         (?, ?, ?, ?, '10:00:00', 'no_show', 'miss 2')`,
      [
        patient.id,
        doctorId,
        departmentId,
        isoDaysFromToday(-10),
        patient.id,
        doctorId,
        departmentId,
        isoDaysFromToday(-7),
      ],
    );

    // Appointment on a quiet future day (avoids clashes with demo seed)
    const book = await fetch(`${baseUrl}/api/appointments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${patient.token}`,
      },
      body: JSON.stringify({
        doctor_id: doctorId,
        department_id: departmentId,
        appointment_date: date,
        appointment_time: time,
        reason: 'Risk flag check',
      }),
    });
    assert.equal((await json(book)).status, 201);

    const doctorToken = await loginDoctor();
    const mine = await fetch(
      `${baseUrl}/api/doctors/me/appointments?date=${date}`,
      { headers: { Authorization: `Bearer ${doctorToken}` } },
    );
    const data = await json(mine);
    assert.equal(data.status, 200);

    const row = data.body.appointments.find(
      (a) => Number(a.patient_id) === Number(patient.id),
    );
    assert.ok(row, 'appointment not returned for doctor');
    assert.equal(Number(row.no_show_count), 2);
    assert.equal(row.risk_flag, true);
  });

  it('keeps risk_flag false when the patient has fewer than 2 no-shows', async () => {
    const patient = await registerPatient('safe');
    const date = isoDaysFromToday(21);
    const time = '15:00';

    await pool.query(
      `INSERT INTO appointments
        (patient_id, doctor_id, department_id, appointment_date, appointment_time, status, reason)
       VALUES (?, ?, ?, ?, '11:00:00', 'no_show', 'only one miss')`,
      [patient.id, doctorId, departmentId, isoDaysFromToday(-4)],
    );

    const book = await fetch(`${baseUrl}/api/appointments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${patient.token}`,
      },
      body: JSON.stringify({
        doctor_id: doctorId,
        department_id: departmentId,
        appointment_date: date,
        appointment_time: time,
      }),
    });
    assert.equal((await json(book)).status, 201);

    const doctorToken = await loginDoctor();
    const mine = await fetch(
      `${baseUrl}/api/doctors/me/appointments?date=${date}`,
      { headers: { Authorization: `Bearer ${doctorToken}` } },
    );
    const data = await json(mine);
    const row = data.body.appointments.find(
      (a) => Number(a.patient_id) === Number(patient.id),
    );
    assert.ok(row);
    assert.equal(Number(row.no_show_count), 1);
    assert.equal(row.risk_flag, false);
  });
});
