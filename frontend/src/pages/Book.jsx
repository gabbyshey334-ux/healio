/**
 * Book flow — full path:
 *   1 Department → 2 Doctor → 3 Date/slot → 4 Confirm → 5 Success
 */

import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  createAppointment,
  fetchDepartmentDoctors,
  fetchDepartments,
  fetchDoctorAvailability,
  formatSlotLabel,
  joinWaitlist,
  upcomingDates,
} from '../api/booking';
import './Book.css';

function Book() {
  const { isAuthenticated, logout, token } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const departmentParam = searchParams.get('department');
  const initialDeptId = departmentParam ? Number(departmentParam) : null;

  const [step, setStep] = useState(initialDeptId ? 2 : 1);
  const [departments, setDepartments] = useState([]);
  const [selectedDepartment, setSelectedDepartment] = useState(null);
  const [doctors, setDoctors] = useState([]);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [slots, setSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [reason, setReason] = useState('');
  const [bookedAppointment, setBookedAppointment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [waitlistPeriod, setWaitlistPeriod] = useState('any');
  const [waitlistSubmitting, setWaitlistSubmitting] = useState(false);
  const [waitlistSuccess, setWaitlistSuccess] = useState('');

  const dateOptions = useMemo(() => upcomingDates(14), []);

  // Step 1: load departments
  useEffect(() => {
    if (!isAuthenticated || step !== 1) return;

    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const list = await fetchDepartments();
        if (!cancelled) setDepartments(list);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Could not load departments.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, step]);

  // Step 2: load doctors
  useEffect(() => {
    if (!isAuthenticated || step !== 2) return;

    const deptId = selectedDepartment?.id || initialDeptId;
    if (!deptId) {
      setStep(1);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const { department, doctors: list } = await fetchDepartmentDoctors(deptId);
        if (cancelled) return;
        setSelectedDepartment(department);
        setDoctors(list);
        if (String(searchParams.get('department')) !== String(department.id)) {
          setSearchParams({ department: String(department.id) }, { replace: true });
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Could not load doctors.');
          setDoctors([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, step, selectedDepartment?.id, initialDeptId]);

  // Step 3: load slots when date changes
  useEffect(() => {
    if (!isAuthenticated || step !== 3 || !selectedDoctor || !selectedDate) {
      return;
    }

    let cancelled = false;
    (async () => {
      setSlotsLoading(true);
      setError('');
      try {
        const data = await fetchDoctorAvailability(selectedDoctor.id, selectedDate);
        if (!cancelled) {
          setSlots(data.slots || []);
          // Clear slot if it’s no longer open for this date
          setSelectedSlot((prev) => {
            if (!prev) return null;
            const stillOpen = (data.slots || []).some((s) => s.time === prev);
            return stillOpen ? prev : null;
          });
        }
      } catch (err) {
        if (!cancelled) {
          setSlots([]);
          setError(err.message || 'Could not load available times.');
        }
      } finally {
        if (!cancelled) setSlotsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, step, selectedDoctor, selectedDate]);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  function handleLogout() {
    logout();
    navigate('/');
  }

  function chooseDepartment(dept) {
    setSelectedDepartment(dept);
    setSelectedDoctor(null);
    setSelectedDate('');
    setSelectedSlot(null);
    setSearchParams({ department: String(dept.id) });
    setStep(2);
  }

  function goBackToDepartments() {
    setSelectedDepartment(null);
    setSelectedDoctor(null);
    setSelectedDate('');
    setSelectedSlot(null);
    setDoctors([]);
    setSearchParams({});
    setError('');
    setStep(1);
  }

  function chooseDoctor(doctor) {
    setSelectedDoctor(doctor);
    setSelectedDate(dateOptions[0]?.value || '');
    setSelectedSlot(null);
    setWaitlistSuccess('');
    setWaitlistPeriod('any');
    setError('');
    setStep(3);
  }

  function goBackToDoctors() {
    setSelectedDate('');
    setSelectedSlot(null);
    setSlots([]);
    setWaitlistSuccess('');
    setError('');
    setStep(2);
  }

  function chooseSlot(time) {
    setSelectedSlot(time);
    setError('');
  }

  function goToConfirm() {
    if (!selectedSlot) {
      setError('Pick a time slot to continue.');
      return;
    }
    setError('');
    setStep(4);
  }

  function goBackToSlots() {
    setError('');
    setStep(3);
  }

  async function confirmBooking() {
    setSubmitting(true);
    setError('');
    try {
      const appointment = await createAppointment(
        {
          doctor_id: selectedDoctor.id,
          department_id: selectedDepartment.id,
          appointment_date: selectedDate,
          appointment_time: selectedSlot,
          reason: reason.trim() || undefined,
        },
        token,
      );
      setBookedAppointment(appointment);
      setStep(5);
    } catch (err) {
      setError(err.message || 'Could not confirm booking.');
      if (err.status === 409) {
        setSelectedSlot(null);
        setStep(3);
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleJoinWaitlist() {
    if (!selectedDoctor || !selectedDepartment) return;
    setWaitlistSubmitting(true);
    setError('');
    setWaitlistSuccess('');
    try {
      await joinWaitlist(
        {
          department_id: selectedDepartment.id,
          doctor_id: selectedDoctor.id,
          preferred_date: selectedDate || undefined,
          preferred_period: waitlistPeriod,
        },
        token,
      );
      setWaitlistSuccess(
        'You’re on the waitlist. Check My waitlist on Home when a slot opens.',
      );
    } catch (err) {
      setError(err.message || 'Could not join the waitlist.');
    } finally {
      setWaitlistSubmitting(false);
    }
  }

  const doctorFullName = selectedDoctor
    ? `${selectedDoctor.first_name} ${selectedDoctor.last_name}`
    : '';

  const dateLabel =
    dateOptions.find((d) => d.value === selectedDate)?.label || selectedDate;

  return (
    <main className="book-page">
      <header className="book-topbar">
        <Link to="/home" className="book-brand">
          Healio
        </Link>
        <button type="button" className="book-logout" onClick={handleLogout}>
          Log out
        </button>
      </header>

      <div className="book-inner">
        {step < 5 ? (
          <p className="book-steps" aria-label="Booking progress">
            <span className={step === 1 ? 'is-current' : ''}>1. Department</span>
            <span className="book-steps-sep" aria-hidden="true">
              ·
            </span>
            <span className={step === 2 ? 'is-current' : ''}>2. Doctor</span>
            <span className="book-steps-sep" aria-hidden="true">
              ·
            </span>
            <span className={step === 3 ? 'is-current' : ''}>3. Time</span>
            <span className="book-steps-sep" aria-hidden="true">
              ·
            </span>
            <span className={step === 4 ? 'is-current' : ''}>4. Confirm</span>
          </p>
        ) : null}

        {/* —— Step 1 —— */}
        {step === 1 ? (
          <section aria-labelledby="book-dept-heading">
            <h1 id="book-dept-heading" className="book-title">
              Choose a department
            </h1>
            <p className="book-lead">
              Pick where you need care, then choose a doctor.
            </p>

            {error ? (
              <div className="book-error" role="alert">
                {error}
              </div>
            ) : null}

            {loading ? (
              <p className="book-muted">Loading departments…</p>
            ) : departments.length === 0 ? (
              <p className="book-muted">No departments available yet.</p>
            ) : (
              <ul className="book-card-list">
                {departments.map((dept) => (
                  <li key={dept.id}>
                    <button
                      type="button"
                      className="book-select-card"
                      onClick={() => chooseDepartment(dept)}
                    >
                      <span className="book-card-title">{dept.name}</span>
                      {dept.description ? (
                        <span className="book-card-meta">{dept.description}</span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}

        {/* —— Step 2 —— */}
        {step === 2 ? (
          <section aria-labelledby="book-doc-heading">
            <button
              type="button"
              className="book-back"
              onClick={goBackToDepartments}
            >
              ← All departments
            </button>

            <h1 id="book-doc-heading" className="book-title">
              Choose a doctor
            </h1>
            <p className="book-lead">
              {selectedDepartment
                ? `${selectedDepartment.name} — pick who you’d like to see.`
                : 'Pick who you’d like to see.'}
            </p>

            {error ? (
              <div className="book-error" role="alert">
                {error}
              </div>
            ) : null}

            {loading ? (
              <p className="book-muted">Loading doctors…</p>
            ) : doctors.length === 0 ? (
              <div className="book-empty">
                <p>No doctors available in this department right now.</p>
              </div>
            ) : (
              <ul className="book-card-list">
                {doctors.map((doc) => (
                  <li key={doc.id}>
                    <button
                      type="button"
                      className={
                        selectedDoctor?.id === doc.id
                          ? 'book-select-card is-selected'
                          : 'book-select-card'
                      }
                      onClick={() => chooseDoctor(doc)}
                    >
                      <span className="book-card-title">
                        {doc.first_name} {doc.last_name}
                      </span>
                      <span className="book-card-meta">
                        {doc.specialization || 'Clinic doctor'}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}

        {/* —— Step 3 —— */}
        {step === 3 ? (
          <section aria-labelledby="book-slot-heading">
            <button type="button" className="book-back" onClick={goBackToDoctors}>
              ← Doctors
            </button>

            <h1 id="book-slot-heading" className="book-title">
              Pick a date and time
            </h1>
            <p className="book-lead">
              {doctorFullName}
              {selectedDoctor?.specialization
                ? ` · ${selectedDoctor.specialization}`
                : ''}
            </p>

            {error ? (
              <div className="book-error" role="alert">
                {error}
              </div>
            ) : null}

            <div className="book-field-block">
              <p className="book-label" id="date-label">
                Date
              </p>
              <div
                className="book-chip-row"
                role="group"
                aria-labelledby="date-label"
              >
                {dateOptions.map((d) => (
                  <button
                    key={d.value}
                    type="button"
                    className={
                      selectedDate === d.value
                        ? 'book-chip is-selected'
                        : 'book-chip'
                    }
                    onClick={() => {
                      setSelectedDate(d.value);
                      setSelectedSlot(null);
                      setWaitlistSuccess('');
                    }}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="book-field-block">
              <p className="book-label" id="slot-label">
                Available times
              </p>

              {!selectedDate ? (
                <p className="book-muted">Choose a date to see open slots.</p>
              ) : slotsLoading ? (
                <p className="book-muted">Loading open slots…</p>
              ) : slots.length === 0 ? (
                <div className="book-empty book-empty--waitlist">
                  <p>
                    No open slots on {dateLabel}. Try another date above, or join
                    the waitlist for {doctorFullName}.
                  </p>

                  {waitlistSuccess ? (
                    <p className="book-notice">{waitlistSuccess}</p>
                  ) : (
                    <div className="book-waitlist-form">
                      <label
                        className="book-label"
                        htmlFor="waitlist-period"
                      >
                        Preferred time of day
                      </label>
                      <select
                        id="waitlist-period"
                        className="book-select"
                        value={waitlistPeriod}
                        onChange={(e) => setWaitlistPeriod(e.target.value)}
                        disabled={waitlistSubmitting}
                      >
                        <option value="any">Any time</option>
                        <option value="morning">Morning</option>
                        <option value="afternoon">Afternoon</option>
                      </select>
                      <button
                        type="button"
                        className="book-primary book-primary--secondary-action"
                        disabled={waitlistSubmitting}
                        onClick={handleJoinWaitlist}
                      >
                        {waitlistSubmitting
                          ? 'Joining…'
                          : 'Join waitlist for this doctor'}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div
                  className="book-chip-row"
                  role="group"
                  aria-labelledby="slot-label"
                >
                  {slots.map((slot) => (
                    <button
                      key={slot.time}
                      type="button"
                      className={
                        selectedSlot === slot.time
                          ? 'book-chip is-selected'
                          : 'book-chip'
                      }
                      onClick={() => chooseSlot(slot.time)}
                    >
                      {formatSlotLabel(slot.time)}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              className="book-primary"
              disabled={!selectedSlot}
              onClick={goToConfirm}
            >
              Continue
            </button>
          </section>
        ) : null}

        {/* —— Step 4 —— */}
        {step === 4 ? (
          <section aria-labelledby="book-confirm-heading">
            <button type="button" className="book-back" onClick={goBackToSlots}>
              ← Change time
            </button>

            <h1 id="book-confirm-heading" className="book-title">
              Confirm booking
            </h1>
            <p className="book-lead">
              Check the details, then confirm your appointment.
            </p>

            {error ? (
              <div className="book-error" role="alert">
                {error}
              </div>
            ) : null}

            <div className="book-summary-card">
              <p className="book-summary-row">
                <span className="book-summary-label">Doctor</span>
                <span className="book-summary-value">{doctorFullName}</span>
              </p>
              <p className="book-summary-row">
                <span className="book-summary-label">Department</span>
                <span className="book-summary-value">
                  {selectedDepartment?.name}
                </span>
              </p>
              {selectedDoctor?.specialization ? (
                <p className="book-summary-row">
                  <span className="book-summary-label">Specialization</span>
                  <span className="book-summary-value">
                    {selectedDoctor.specialization}
                  </span>
                </p>
              ) : null}
              <p className="book-summary-row">
                <span className="book-summary-label">When</span>
                <span className="book-summary-value">
                  {dateLabel} · {formatSlotLabel(selectedSlot)}
                </span>
              </p>
            </div>

            <div className="book-field">
              <label htmlFor="book-reason">
                Reason for visit{' '}
                <span className="book-optional">(optional)</span>
              </label>
              <textarea
                id="book-reason"
                rows={3}
                maxLength={500}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Headache for two days"
                disabled={submitting}
              />
            </div>

            <button
              type="button"
              className="book-primary"
              disabled={submitting}
              onClick={confirmBooking}
            >
              {submitting ? 'Confirming…' : 'Confirm booking'}
            </button>
          </section>
        ) : null}

        {/* —— Step 5 —— */}
        {step === 5 ? (
          <section aria-labelledby="book-success-heading" className="book-success">
            <p className="book-success-eyebrow">You’re booked</p>
            <h1 id="book-success-heading" className="book-title">
              Appointment confirmed
            </h1>
            <p className="book-lead">
              {doctorFullName} · {dateLabel} ·{' '}
              {formatSlotLabel(
                selectedSlot ||
                  String(bookedAppointment?.appointment_time || '').slice(0, 5),
              )}
            </p>
            <p className="book-muted">
              Status: pending — the clinic will see your booking. Arrive a few
              minutes early.
            </p>
            <Link to="/home" className="book-primary book-primary-link">
              Back to Home
            </Link>
          </section>
        ) : null}
      </div>
    </main>
  );
}

export default Book;
