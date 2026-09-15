/**
 * Patient Home — logged-in utility screen (not a marketing landing page).
 * Goal: greet the patient, show upcoming visits, browse departments, book.
 */

import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fetchDepartments, fetchUpcomingAppointments } from '../api/patientHome';
import './Home.css';

function formatAppointmentWhen(dateStr, timeStr) {
  if (!dateStr) return '';
  try {
    const date = new Date(`${dateStr}T${timeStr || '00:00:00'}`);
    return date.toLocaleString(undefined, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: timeStr ? 'numeric' : undefined,
      minute: timeStr ? '2-digit' : undefined,
    });
  } catch {
    return `${dateStr}${timeStr ? ` · ${timeStr}` : ''}`;
  }
}

function Home() {
  const { user, isAuthenticated, logout, token } = useAuth();
  const navigate = useNavigate();

  const [departments, setDepartments] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loadingDepts, setLoadingDepts] = useState(true);
  const [loadingAppts, setLoadingAppts] = useState(true);
  const [deptError, setDeptError] = useState('');

  useEffect(() => {
    if (!isAuthenticated) return;

    let cancelled = false;

    (async () => {
      setLoadingDepts(true);
      setDeptError('');
      try {
        const list = await fetchDepartments();
        if (!cancelled) setDepartments(list);
      } catch {
        if (!cancelled) {
          setDepartments([]);
          setDeptError('Could not load departments. Try again shortly.');
        }
      } finally {
        if (!cancelled) setLoadingDepts(false);
      }
    })();

    (async () => {
      setLoadingAppts(true);
      try {
        const list = await fetchUpcomingAppointments(token);
        if (!cancelled) setAppointments(list);
      } finally {
        if (!cancelled) setLoadingAppts(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, token]);

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const firstName = user?.first_name || 'there';

  function handleLogout() {
    logout();
    navigate('/');
  }

  return (
    <main className="home-page">
      <header className="home-topbar">
        <p className="home-brand">Healio</p>
        <button type="button" className="home-logout" onClick={handleLogout}>
          Log out
        </button>
      </header>

      <div className="home-inner">
        <section className="home-welcome" aria-labelledby="home-greeting">
          <div className="home-welcome-copy">
            <h1 id="home-greeting" className="home-greeting">
              Hello, {firstName}
            </h1>
            <p className="home-welcome-text">
              Book a visit at the campus medical clinic when you need one.
            </p>
          </div>
          <div className="home-welcome-actions">
            <Link to="/book" className="home-cta">
              Book appointment
            </Link>
            <Link to="/waitlist" className="home-secondary-link">
              My waitlist
            </Link>
          </div>
        </section>

        <section
          className="home-section"
          aria-labelledby="upcoming-heading"
        >
          <h2 id="upcoming-heading" className="home-section-title">
            Upcoming appointments
          </h2>

          {loadingAppts ? (
            <p className="home-muted">Loading appointments…</p>
          ) : appointments.length === 0 ? (
            <div className="home-empty">
              <p>No upcoming appointments — book one below.</p>
            </div>
          ) : (
            <ul className="home-appt-list">
              {appointments.map((appt) => (
                <li key={appt.id} className="home-appt-card">
                  <p className="home-appt-when">
                    {formatAppointmentWhen(
                      appt.appointment_date,
                      appt.appointment_time,
                    )}
                  </p>
                  <p className="home-appt-detail">
                    {appt.department_name || 'Clinic visit'}
                    {appt.doctor_name ? ` · ${appt.doctor_name}` : ''}
                  </p>
                  <p
                    className={`home-appt-status home-appt-status--${appt.status}`}
                  >
                    {String(appt.status).replace('_', ' ')}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section
          className="home-section"
          aria-labelledby="departments-heading"
        >
          <h2 id="departments-heading" className="home-section-title">
            Browse departments
          </h2>
          <p className="home-section-lead">
            Choose a department to find a doctor and available slots.
          </p>

          {loadingDepts ? (
            <p className="home-muted">Loading departments…</p>
          ) : deptError ? (
            <div className="home-error" role="alert">
              {deptError}
            </div>
          ) : departments.length === 0 ? (
            <div className="home-empty">
              <p>No departments available yet.</p>
            </div>
          ) : (
            <ul className="home-dept-grid">
              {departments.map((dept) => (
                <li key={dept.id}>
                  <Link
                    to={`/book?department=${dept.id}`}
                    className="home-dept-card"
                  >
                    <span className="home-dept-name">{dept.name}</span>
                    {dept.description ? (
                      <span className="home-dept-desc">{dept.description}</span>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}

export default Home;
