/**
 * Admin dashboard API helpers.
 */

import { API_BASE } from './config.js';

async function parseResponse(res) {
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    const err = new Error(data?.error || 'Request failed');
    err.status = res.status;
    throw err;
  }
  return data;
}

function authHeaders(token, json = false) {
  const headers = { Authorization: `Bearer ${token}` };
  if (json) headers['Content-Type'] = 'application/json';
  return headers;
}

export async function fetchAdminAnalytics(token) {
  const res = await fetch(`${API_BASE}/api/admin/analytics`, {
    headers: authHeaders(token),
  });
  return parseResponse(res);
}

export async function fetchAdminDepartments(token) {
  const res = await fetch(`${API_BASE}/api/admin/departments`, {
    headers: authHeaders(token),
  });
  const data = await parseResponse(res);
  return data.departments || [];
}

export async function createAdminDepartment(token, payload) {
  const res = await fetch(`${API_BASE}/api/admin/departments`, {
    method: 'POST',
    headers: authHeaders(token, true),
    body: JSON.stringify(payload),
  });
  const data = await parseResponse(res);
  return data.department;
}

export async function updateAdminDepartment(token, id, payload) {
  const res = await fetch(`${API_BASE}/api/admin/departments/${id}`, {
    method: 'PATCH',
    headers: authHeaders(token, true),
    body: JSON.stringify(payload),
  });
  const data = await parseResponse(res);
  return data.department;
}

export async function fetchAdminDoctors(token) {
  const res = await fetch(`${API_BASE}/api/admin/doctors`, {
    headers: authHeaders(token),
  });
  const data = await parseResponse(res);
  return data.doctors || [];
}

export async function updateAdminDoctor(token, id, payload) {
  const res = await fetch(`${API_BASE}/api/admin/doctors/${id}`, {
    method: 'PATCH',
    headers: authHeaders(token, true),
    body: JSON.stringify(payload),
  });
  const data = await parseResponse(res);
  return data.doctor;
}

/** Existing auth endpoint — admin creates a doctor account */
export async function createAdminDoctor(token, payload) {
  const res = await fetch(`${API_BASE}/api/auth/admins/doctors`, {
    method: 'POST',
    headers: authHeaders(token, true),
    body: JSON.stringify(payload),
  });
  const data = await parseResponse(res);
  return data.doctor;
}

/**
 * Clinic-wide appointments. Filters: department_id, doctor_id, date (YYYY-MM-DD), status.
 * API returns most recent first (date DESC, time DESC), max 200 rows.
 */
export async function fetchAdminAppointments(token, filters = {}) {
  const params = new URLSearchParams();
  if (filters.department_id) params.set('department_id', filters.department_id);
  if (filters.doctor_id) params.set('doctor_id', filters.doctor_id);
  if (filters.date) params.set('date', filters.date);
  if (filters.status) params.set('status', filters.status);

  const qs = params.toString();
  const res = await fetch(
    `${API_BASE}/api/admin/appointments${qs ? `?${qs}` : ''}`,
    { headers: authHeaders(token) },
  );
  const data = await parseResponse(res);
  return data.appointments || [];
}

export function formatAdminApptDate(value) {
  if (!value) return '—';
  const raw =
    value instanceof Date
      ? value.toISOString().slice(0, 10)
      : String(value).slice(0, 10);
  const d = new Date(`${raw}T12:00:00`);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatAdminApptTime(sqlTime) {
  if (!sqlTime) return '—';
  const hhmm =
    sqlTime instanceof Date
      ? `${String(sqlTime.getHours()).padStart(2, '0')}:${String(sqlTime.getMinutes()).padStart(2, '0')}`
      : String(sqlTime).slice(0, 5);
  const [hStr, mStr] = hhmm.split(':');
  const d = new Date();
  d.setHours(Number(hStr), Number(mStr), 0, 0);
  return d.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}
