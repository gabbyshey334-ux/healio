/**
 * Booking / department API helpers for the patient book flow.
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

async function getJson(path, token) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, { headers });
  return parseResponse(res);
}

async function postJson(path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  return parseResponse(res);
}

export async function fetchDepartments() {
  const data = await getJson('/api/departments');
  return data.departments || [];
}

export async function fetchDepartmentDoctors(departmentId) {
  const data = await getJson(`/api/departments/${departmentId}/doctors`);
  return {
    department: data.department,
    doctors: data.doctors || [],
  };
}

export async function fetchDoctorAvailability(doctorId, date) {
  const data = await getJson(
    `/api/doctors/${doctorId}/availability?date=${encodeURIComponent(date)}`,
  );
  return data;
}

export async function createAppointment(payload, token) {
  const data = await postJson('/api/appointments', payload, token);
  return data.appointment;
}

/** Patient joins waitlist for a department / optional doctor */
export async function joinWaitlist(payload, token) {
  const data = await postJson('/api/waitlist', payload, token);
  return data.waitlist;
}

export async function fetchMyWaitlist(token) {
  const data = await getJson('/api/waitlist/me', token);
  return data.waitlist || [];
}

export async function cancelWaitlistEntry(id, token) {
  const res = await fetch(
    `${API_BASE}/api/waitlist/${id}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ status: 'cancelled' }),
    },
  );
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
  return data.waitlist;
}

export async function convertWaitlistEntry(id, payload, token) {
  const data = await postJson(`/api/waitlist/${id}/convert`, payload || {}, token);
  return data;
}

/** Next N calendar dates as YYYY-MM-DD (local time), starting today */
export function upcomingDates(count = 14) {
  const dates = [];
  const now = new Date();
  for (let i = 0; i < count; i += 1) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    dates.push({
      value: `${yyyy}-${mm}-${dd}`,
      label: d.toLocaleDateString(undefined, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      }),
    });
  }
  return dates;
}

export function formatSlotLabel(timeHHMM) {
  const [hStr, mStr] = timeHHMM.split(':');
  const h = Number(hStr);
  const m = Number(mStr);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}
