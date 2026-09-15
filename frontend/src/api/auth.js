/**
 * Patient auth API helpers — talk to the Healio Express backend.
 */

import { API_BASE } from './config.js';

async function postJson(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    const message = data?.error || 'Something went wrong. Please try again.';
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }

  return data;
}

export function loginPatient({ email, password }) {
  return postJson('/api/auth/patients/login', { email, password });
}

export function registerPatient(payload) {
  return postJson('/api/auth/patients/register', payload);
}

export function loginDoctor({ email, password }) {
  return postJson('/api/auth/doctors/login', { email, password });
}

export function loginAdmin({ email, password }) {
  return postJson('/api/auth/admins/login', { email, password });
}
