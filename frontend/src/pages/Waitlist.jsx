/**
 * My Waitlist — patient view of waiting / notified / booked entries.
 * Notified entries offer the freed slot directly via Convert.
 */

import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  cancelWaitlistEntry,
  convertWaitlistEntry,
  fetchMyWaitlist,
  formatSlotLabel,
} from '../api/booking';
import './Waitlist.css';

function formatPrefDate(value) {
  if (!value) return 'Any date';
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
  });
}

function doctorLabel(entry) {
  if (entry.doctor_first_name) {
    return `${entry.doctor_first_name} ${entry.doctor_last_name}`;
  }
  return `Any doctor in ${entry.department_name}`;
}

function notifiedSlotLabel(entry) {
  if (!entry.notified_date || !entry.notified_time) return null;
  const date = formatPrefDate(entry.notified_date);
  const time = formatSlotLabel(String(entry.notified_time).slice(0, 5));
  const doctor = entry.notified_doctor_first_name
    ? `${entry.notified_doctor_first_name} ${entry.notified_doctor_last_name}`
    : doctorLabel(entry);
  return { date, time, doctor };
}

function Waitlist() {
  const { isAuthenticated, logout, token, user } = useAuth();
  const navigate = useNavigate();

  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [success, setSuccess] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const list = await fetchMyWaitlist(token);
      setEntries(list);
    } catch (err) {
      setError(err.message || 'Could not load waitlist.');
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (isAuthenticated && user?.role === 'patient') {
      load();
    }
  }, [isAuthenticated, user, load]);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user?.role !== 'patient') {
    if (user?.role === 'doctor') return <Navigate to="/doctor" replace />;
    if (user?.role === 'admin') return <Navigate to="/admin" replace />;
    return <Navigate to="/" replace />;
  }

  function handleLogout() {
    logout();
    navigate('/');
  }

  async function handleCancel(id) {
    setBusyId(id);
    setError('');
    setSuccess('');
    try {
      await cancelWaitlistEntry(id, token);
      setSuccess('Removed from the waitlist.');
      await load();
    } catch (err) {
      setError(err.message || 'Could not cancel.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleBookNow(entry) {
    setBusyId(entry.id);
    setError('');
    setSuccess('');
    try {
      const payload = {};
      if (entry.notified_doctor_id) {
        payload.doctor_id = entry.notified_doctor_id;
      }
      if (entry.notified_date) {
        payload.appointment_date = String(entry.notified_date).slice(0, 10);
      }
      if (entry.notified_time) {
        payload.appointment_time = String(entry.notified_time).slice(0, 5);
      }

      const result = await convertWaitlistEntry(entry.id, payload, token);
      setSuccess(
        `Booked ${formatPrefDate(result.appointment.appointment_date)} at ${formatSlotLabel(String(result.appointment.appointment_time).slice(0, 5))}.`,
      );
      await load();
    } catch (err) {
      setError(err.message || 'Could not book that slot.');
      if (err.status === 409) {
        await load();
      }
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="wait-page">
      <header className="wait-topbar">
        <Link to="/home" className="wait-brand">
          Healio
        </Link>
        <button type="button" className="wait-logout" onClick={handleLogout}>
          Log out
        </button>
      </header>

      <div className="wait-inner">
        <button
          type="button"
          className="wait-back"
          onClick={() => navigate('/home')}
        >
          ← Home
        </button>

        <h1 className="wait-title">My waitlist</h1>
        <p className="wait-lead">
          When a matching slot opens, you’ll see Book now here with the time
          already filled in.
        </p>

        {error ? (
          <div className="wait-error" role="alert">
            {error}
          </div>
        ) : null}
        {success ? <p className="wait-success">{success}</p> : null}

        {loading ? (
          <p className="wait-muted">Loading waitlist…</p>
        ) : entries.length === 0 ? (
          <div className="wait-empty">
            <p>You’re not on any waitlists right now.</p>
            <Link to="/book" className="wait-cta">
              Book appointment
            </Link>
          </div>
        ) : (
          <ul className="wait-list">
            {entries.map((entry) => {
              const slot = notifiedSlotLabel(entry);
              const busy = busyId === entry.id;
              return (
                <li key={entry.id} className="wait-card">
                  <div className="wait-card-main">
                    <p className="wait-dept">{entry.department_name}</p>
                    <p className="wait-doctor">{doctorLabel(entry)}</p>
                    <p className="wait-pref">
                      Preferred: {formatPrefDate(entry.preferred_date)} ·{' '}
                      {entry.preferred_period === 'any'
                        ? 'Any time'
                        : entry.preferred_period}
                    </p>
                    <p className={`wait-status wait-status--${entry.status}`}>
                      {String(entry.status).replace('_', ' ')}
                    </p>

                    {entry.status === 'notified' && slot ? (
                      <div className="wait-offer">
                        <p className="wait-offer-label">Slot offered</p>
                        <p className="wait-offer-detail">
                          {slot.doctor} · {slot.date} · {slot.time}
                        </p>
                      </div>
                    ) : null}
                  </div>

                  <div className="wait-actions">
                    {entry.status === 'notified' ? (
                      <button
                        type="button"
                        className="wait-primary"
                        disabled={busy || !slot}
                        onClick={() => handleBookNow(entry)}
                      >
                        {busy ? 'Booking…' : 'Book now'}
                      </button>
                    ) : null}
                    {entry.status === 'waiting' || entry.status === 'notified' ? (
                      <button
                        type="button"
                        className="wait-secondary"
                        disabled={busy}
                        onClick={() => handleCancel(entry.id)}
                      >
                        {busy && entry.status === 'waiting'
                          ? 'Cancelling…'
                          : 'Cancel'}
                      </button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}

export default Waitlist;
