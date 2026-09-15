/**
 * Doctor dashboard API helpers.
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

export async function fetchMyAppointments(token, date = 'today') {
  const res = await fetch(
    `${API_BASE}/api/doctors/me/appointments?date=${encodeURIComponent(date)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  return parseResponse(res);
}

export async function updateAppointmentStatus(token, appointmentId, status) {
  const res = await fetch(
    `${API_BASE}/api/appointments/${appointmentId}/status`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status }),
    },
  );
  const data = await parseResponse(res);
  return data.appointment;
}

/** Actions relevant to the current status */
export function actionsForStatus(status) {
  switch (status) {
    case 'pending':
      return [
        { status: 'confirmed', label: 'Confirm' },
        { status: 'cancelled', label: 'Cancel' },
      ];
    case 'confirmed':
      return [
        { status: 'completed', label: 'Mark completed' },
        { status: 'no_show', label: 'Mark no-show' },
        { status: 'cancelled', label: 'Cancel' },
      ];
    default:
      return [];
  }
}

export function formatApptTime(sqlTime) {
  if (!sqlTime) return '';
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
