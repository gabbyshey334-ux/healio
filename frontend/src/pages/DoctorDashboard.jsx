/**
 * Doctor Dashboard — today's appointments for the signed-in doctor.
 * Patients / unauthenticated users are redirected away.
 */

import { useCallback, useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  actionsForStatus,
  fetchMyAppointments,
  formatApptTime,
  updateAppointmentStatus,
} from '../api/doctor';
import './DoctorDashboard.css';

function DoctorDashboard() {
  const { user, token, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  const [date, setDate] = useState('');
  const [stats, setStats] = useState({ total: 0, pending: 0, confirmed: 0 });
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatingId, setUpdatingId] = useState(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const data = await fetchMyAppointments(token, 'today');
      setDate(data.date);
      setStats(data.stats || { total: 0, pending: 0, confirmed: 0 });
      setAppointments(data.appointments || []);
    } catch (err) {
      setError(err.message || 'Could not load appointments.');
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (isAuthenticated && user?.role === 'doctor') {
      load();
    }
  }, [isAuthenticated, user, load]);

  if (!isAuthenticated) {
    return <Navigate to="/staff/login" replace />;
  }

  if (user?.role !== 'doctor') {
    return <Navigate to="/" replace />;
  }

  function handleLogout() {
    logout();
    navigate('/staff/login');
  }

  async function handleStatus(appointmentId, status) {
    setUpdatingId(appointmentId);
    setError('');
    try {
      const updated = await updateAppointmentStatus(token, appointmentId, status);
      setAppointments((prev) => {
        const next = prev.map((a) =>
          a.id === updated.id ? { ...a, ...updated } : a,
        );
        setStats({
          total: next.length,
          pending: next.filter((r) => r.status === 'pending').length,
          confirmed: next.filter((r) => r.status === 'confirmed').length,
        });
        return next;
      });
    } catch (err) {
      setError(err.message || 'Could not update status.');
    } finally {
      setUpdatingId(null);
    }
  }

  const dateLabel = date
    ? new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      })
    : 'Today';

  return (
    <main className="doc-page">
      <header className="doc-topbar">
        <p className="doc-brand">Healio</p>
        <div className="doc-topbar-right">
          <span className="doc-who">
            Dr. {user.first_name} {user.last_name}
          </span>
          <button type="button" className="doc-logout" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </header>

      <div className="doc-inner">
        <header className="doc-header">
          <h1 className="doc-title">Today’s appointments</h1>
          <p className="doc-lead">{dateLabel}</p>
        </header>

        <div className="doc-stats" aria-label="Today’s summary">
          <div className="doc-stat-card">
            <span className="doc-stat-value">{stats.total}</span>
            <span className="doc-stat-label">Total</span>
          </div>
          <div className="doc-stat-card">
            <span className="doc-stat-value">{stats.pending}</span>
            <span className="doc-stat-label">Pending</span>
          </div>
          <div className="doc-stat-card">
            <span className="doc-stat-value">{stats.confirmed}</span>
            <span className="doc-stat-label">Confirmed</span>
          </div>
        </div>

        {error ? (
          <div className="doc-error" role="alert">
            {error}
          </div>
        ) : null}

        {loading ? (
          <p className="doc-muted">Loading appointments…</p>
        ) : appointments.length === 0 ? (
          <div className="doc-empty">
            <p>No appointments scheduled for today.</p>
          </div>
        ) : (
          <ul className="doc-appt-list">
            {appointments.map((appt) => {
              const actions = actionsForStatus(appt.status);
              const busy = updatingId === appt.id;
              return (
                <li key={appt.id} className="doc-appt-card">
                  <div className="doc-appt-main">
                    <p className="doc-appt-time">
                      {formatApptTime(appt.appointment_time)}
                    </p>
                    <p className="doc-appt-patient">
                      {appt.patient_first_name} {appt.patient_last_name}
                      {appt.risk_flag ? (
                        <span
                          className="doc-risk"
                          title="This patient has missed clinic appointments before"
                        >
                          ⚠ {appt.no_show_count} past no-shows
                        </span>
                      ) : null}
                    </p>
                    <p className="doc-appt-reason">
                      {appt.reason?.trim()
                        ? appt.reason
                        : 'No reason given'}
                    </p>
                    <p className={`doc-status doc-status--${appt.status}`}>
                      {appt.status.replace('_', ' ')}
                    </p>
                  </div>

                  {actions.length > 0 ? (
                    <div className="doc-actions">
                      {actions.map((action) => (
                        <button
                          key={action.status}
                          type="button"
                          className={
                            action.status === 'cancelled' ||
                            action.status === 'no_show'
                              ? 'doc-action doc-action--muted'
                              : 'doc-action'
                          }
                          disabled={busy}
                          onClick={() => handleStatus(appt.id, action.status)}
                        >
                          {busy ? 'Updating…' : action.label}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}

export default DoctorDashboard;
