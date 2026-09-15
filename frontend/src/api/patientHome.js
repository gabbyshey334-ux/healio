/**
 * Home-screen data helpers.
 * Departments come from GET /api/departments.
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export async function fetchDepartments() {
  const res = await fetch(`${API_BASE}/api/departments`);
  if (!res.ok) {
    throw new Error('Could not load departments');
  }
  const data = await res.json();
  return data.departments || [];
}

/**
 * Upcoming appointments for the signed-in patient.
 * Returns [] until GET /api/appointments/upcoming (or similar) exists.
 */
export async function fetchUpcomingAppointments(token) {
  if (!token) return [];

  try {
    const res = await fetch(`${API_BASE}/api/appointments/upcoming`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : data.appointments || [];
  } catch {
    return [];
  }
}
