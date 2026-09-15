/**
 * Admin Dashboard — analytics, departments, doctors, and appointments.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  createAdminDepartment,
  createAdminDoctor,
  fetchAdminAnalytics,
  fetchAdminAppointments,
  fetchAdminDepartments,
  fetchAdminDoctors,
  formatAdminApptDate,
  formatAdminApptTime,
  updateAdminDepartment,
  updateAdminDoctor,
} from '../api/admin';
import './AdminDashboard.css';

const EMPTY_DOCTOR_FORM = {
  first_name: '',
  last_name: '',
  email: '',
  password: '',
  department_id: '',
  specialization: '',
  phone: '',
};

const APPT_PAGE_SIZE = 20;

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'no_show', label: 'No-show' },
];

function AdminDashboard() {
  const { user, token, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  const [analytics, setAnalytics] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Departments
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [creatingDept, setCreatingDept] = useState(false);
  const [deptFormError, setDeptFormError] = useState('');
  const [editingDeptId, setEditingDeptId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [savingDeptId, setSavingDeptId] = useState(null);

  // Doctors
  const [doctorFilter, setDoctorFilter] = useState('all'); // 'all' | department id
  const [doctorForm, setDoctorForm] = useState(EMPTY_DOCTOR_FORM);
  const [creatingDoctor, setCreatingDoctor] = useState(false);
  const [doctorFormError, setDoctorFormError] = useState('');
  const [editingDoctorId, setEditingDoctorId] = useState(null);
  const [editDoctor, setEditDoctor] = useState({
    department_id: '',
    specialization: '',
    is_active: true,
  });
  const [savingDoctorId, setSavingDoctorId] = useState(null);

  // Appointments (most recent first — matches API order)
  const [appointments, setAppointments] = useState([]);
  const [apptLoading, setApptLoading] = useState(false);
  const [apptError, setApptError] = useState('');
  const [apptPage, setApptPage] = useState(1);
  const [apptFilters, setApptFilters] = useState({
    department_id: '',
    doctor_id: '',
    date: '',
    status: '',
  });

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const [analyticsData, deptList, doctorList] = await Promise.all([
        fetchAdminAnalytics(token),
        fetchAdminDepartments(token),
        fetchAdminDoctors(token),
      ]);
      setAnalytics(analyticsData);
      setDepartments(deptList);
      setDoctors(doctorList);
    } catch (err) {
      setError(err.message || 'Could not load admin data.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  const loadAppointments = useCallback(async () => {
    if (!token) return;
    setApptLoading(true);
    setApptError('');
    try {
      const filters = {};
      if (apptFilters.department_id) {
        filters.department_id = apptFilters.department_id;
      }
      if (apptFilters.doctor_id) filters.doctor_id = apptFilters.doctor_id;
      if (apptFilters.date) filters.date = apptFilters.date;
      if (apptFilters.status) filters.status = apptFilters.status;

      const list = await fetchAdminAppointments(token, filters);
      setAppointments(list);
      setApptPage(1);
    } catch (err) {
      setAppointments([]);
      setApptError(err.message || 'Could not load appointments.');
    } finally {
      setApptLoading(false);
    }
  }, [token, apptFilters]);

  useEffect(() => {
    if (isAuthenticated && user?.role === 'admin') {
      load();
    }
  }, [isAuthenticated, user, load]);

  useEffect(() => {
    if (isAuthenticated && user?.role === 'admin' && !loading) {
      loadAppointments();
    }
  }, [isAuthenticated, user, loading, loadAppointments]);

  const filteredDoctors = useMemo(() => {
    if (doctorFilter === 'all') return doctors;
    return doctors.filter((d) => String(d.department_id) === String(doctorFilter));
  }, [doctors, doctorFilter]);

  const doctorsByDepartment = useMemo(() => {
    const groups = new Map();
    for (const doc of filteredDoctors) {
      const key = doc.department_name || 'Unassigned';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(doc);
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [filteredDoctors]);

  const apptDoctorOptions = useMemo(() => {
    if (!apptFilters.department_id) return doctors;
    return doctors.filter(
      (d) => String(d.department_id) === String(apptFilters.department_id),
    );
  }, [doctors, apptFilters.department_id]);

  const apptTotalPages = Math.max(
    1,
    Math.ceil(appointments.length / APPT_PAGE_SIZE),
  );
  const pagedAppointments = useMemo(() => {
    const start = (apptPage - 1) * APPT_PAGE_SIZE;
    return appointments.slice(start, start + APPT_PAGE_SIZE);
  }, [appointments, apptPage]);

  function setApptFilter(name, value) {
    setApptFilters((prev) => {
      const next = { ...prev, [name]: value };
      // Reset doctor if department changes and doctor no longer matches
      if (name === 'department_id' && prev.doctor_id) {
        const stillValid = doctors.some(
          (d) =>
            String(d.id) === String(prev.doctor_id) &&
            (!value || String(d.department_id) === String(value)),
        );
        if (!stillValid) next.doctor_id = '';
      }
      return next;
    });
  }

  function clearApptFilters() {
    setApptFilters({
      department_id: '',
      doctor_id: '',
      date: '',
      status: '',
    });
  }

  if (!isAuthenticated) {
    return <Navigate to="/staff/login" replace />;
  }

  if (user?.role !== 'admin') {
    if (user?.role === 'doctor') return <Navigate to="/doctor" replace />;
    return <Navigate to="/" replace />;
  }

  function handleLogout() {
    logout();
    navigate('/staff/login');
  }

  async function handleCreateDept(e) {
    e.preventDefault();
    setDeptFormError('');
    if (!newName.trim()) {
      setDeptFormError('Department name is required.');
      return;
    }
    setCreatingDept(true);
    try {
      const dept = await createAdminDepartment(token, {
        name: newName.trim(),
        description: newDescription.trim() || undefined,
      });
      setDepartments((prev) =>
        [...prev, { ...dept, doctor_count: 0 }].sort((a, b) =>
          a.name.localeCompare(b.name),
        ),
      );
      setNewName('');
      setNewDescription('');
    } catch (err) {
      setDeptFormError(err.message || 'Could not create department.');
    } finally {
      setCreatingDept(false);
    }
  }

  function startEditDept(dept) {
    setEditingDeptId(dept.id);
    setEditName(dept.name);
    setEditDescription(dept.description || '');
    setDeptFormError('');
  }

  function cancelEditDept() {
    setEditingDeptId(null);
    setEditName('');
    setEditDescription('');
  }

  async function saveEditDept(e) {
    e.preventDefault();
    if (!editName.trim()) {
      setDeptFormError('Department name is required.');
      return;
    }
    setSavingDeptId(editingDeptId);
    setDeptFormError('');
    try {
      const updated = await updateAdminDepartment(token, editingDeptId, {
        name: editName.trim(),
        description: editDescription.trim(),
      });
      setDepartments((prev) =>
        prev
          .map((d) =>
            d.id === updated.id
              ? { ...d, ...updated, doctor_count: d.doctor_count }
              : d,
          )
          .sort((a, b) => a.name.localeCompare(b.name)),
      );
      // Keep doctor list department names in sync
      setDoctors((prev) =>
        prev.map((doc) =>
          doc.department_id === updated.id
            ? { ...doc, department_name: updated.name }
            : doc,
        ),
      );
      cancelEditDept();
    } catch (err) {
      setDeptFormError(err.message || 'Could not update department.');
    } finally {
      setSavingDeptId(null);
    }
  }

  function updateDoctorFormField(name, value) {
    setDoctorForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleCreateDoctor(e) {
    e.preventDefault();
    setDoctorFormError('');

    if (
      !doctorForm.first_name.trim() ||
      !doctorForm.last_name.trim() ||
      !doctorForm.email.trim() ||
      !doctorForm.password ||
      !doctorForm.department_id
    ) {
      setDoctorFormError(
        'First name, last name, email, password, and department are required.',
      );
      return;
    }
    if (doctorForm.password.length < 8) {
      setDoctorFormError('Password must be at least 8 characters.');
      return;
    }

    setCreatingDoctor(true);
    try {
      await createAdminDoctor(token, {
        first_name: doctorForm.first_name.trim(),
        last_name: doctorForm.last_name.trim(),
        email: doctorForm.email.trim(),
        password: doctorForm.password,
        department_id: Number(doctorForm.department_id),
        specialization: doctorForm.specialization.trim() || undefined,
        phone: doctorForm.phone.trim() || undefined,
      });
      const refreshed = await fetchAdminDoctors(token);
      setDoctors(refreshed);
      setDoctorForm({
        ...EMPTY_DOCTOR_FORM,
        department_id: doctorForm.department_id,
      });
      // Refresh department doctor counts
      const depts = await fetchAdminDepartments(token);
      setDepartments(depts);
    } catch (err) {
      setDoctorFormError(err.message || 'Could not create doctor.');
    } finally {
      setCreatingDoctor(false);
    }
  }

  function startEditDoctor(doc) {
    setEditingDoctorId(doc.id);
    setEditDoctor({
      department_id: String(doc.department_id),
      specialization: doc.specialization || '',
      is_active: Boolean(doc.is_active),
    });
    setDoctorFormError('');
  }

  function cancelEditDoctor() {
    setEditingDoctorId(null);
  }

  async function saveEditDoctor(e) {
    e.preventDefault();
    setSavingDoctorId(editingDoctorId);
    setDoctorFormError('');
    try {
      const updated = await updateAdminDoctor(token, editingDoctorId, {
        department_id: Number(editDoctor.department_id),
        specialization: editDoctor.specialization.trim(),
        is_active: editDoctor.is_active,
      });
      setDoctors((prev) =>
        prev.map((d) => (d.id === updated.id ? { ...d, ...updated } : d)),
      );
      const depts = await fetchAdminDepartments(token);
      setDepartments(depts);
      cancelEditDoctor();
    } catch (err) {
      setDoctorFormError(err.message || 'Could not update doctor.');
    } finally {
      setSavingDoctorId(null);
    }
  }

  return (
    <main className="admin-page">
      <header className="admin-topbar">
        <p className="admin-brand">Healio</p>
        <div className="admin-topbar-right">
          <span className="admin-who">
            {user.first_name} {user.last_name} · Admin
          </span>
          <button type="button" className="admin-logout" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </header>

      <div className="admin-inner">
        <header className="admin-header">
          <h1 className="admin-title">Clinic admin</h1>
          <p className="admin-lead">
            Overview, departments, and doctors for the campus medical clinic.
          </p>
        </header>

        {error ? (
          <div className="admin-error" role="alert">
            {error}
          </div>
        ) : null}

        {loading ? (
          <p className="admin-muted">Loading…</p>
        ) : (
          <>
            {/* —— Analytics —— */}
            <section
              className="admin-section"
              aria-labelledby="admin-analytics-heading"
            >
              <h2 id="admin-analytics-heading" className="admin-section-title">
                Analytics
              </h2>
              <p className="admin-section-lead">
                This week’s activity (Monday through today).
              </p>

              <div className="admin-stats">
                <div className="admin-stat-card">
                  <span className="admin-stat-value">
                    {analytics?.appointments_today ?? 0}
                  </span>
                  <span className="admin-stat-label">Appointments today</span>
                </div>
                <div className="admin-stat-card">
                  <span className="admin-stat-value">
                    {analytics?.appointments_this_week ?? 0}
                  </span>
                  <span className="admin-stat-label">This week</span>
                </div>
                <div className="admin-stat-card">
                  <span className="admin-stat-value">
                    {analytics?.no_show_rate_percent ?? 0}%
                  </span>
                  <span className="admin-stat-label">No-show rate</span>
                </div>
                <div className="admin-stat-card">
                  <span className="admin-stat-value admin-stat-value--text">
                    {analytics?.busiest_doctor?.name || '—'}
                  </span>
                  <span className="admin-stat-label">
                    Busiest doctor
                    {analytics?.busiest_doctor
                      ? ` · ${analytics.busiest_doctor.appointment_count} visits`
                      : ''}
                  </span>
                </div>
              </div>

              <div className="admin-dept-breakdown">
                <h3 className="admin-subheading">Appointments by department</h3>
                {analytics?.appointments_per_department?.length ? (
                  <ul className="admin-breakdown-list">
                    {analytics.appointments_per_department.map((row) => (
                      <li key={row.id} className="admin-breakdown-row">
                        <span>{row.name}</span>
                        <span className="admin-breakdown-count">
                          {row.appointment_count}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="admin-muted">No department data yet.</p>
                )}
              </div>
            </section>

            {/* —— Departments —— */}
            <section
              className="admin-section"
              aria-labelledby="admin-depts-heading"
            >
              <h2 id="admin-depts-heading" className="admin-section-title">
                Departments
              </h2>
              <p className="admin-section-lead">
                Add or rename clinic departments patients can book into.
              </p>

              {deptFormError ? (
                <div className="admin-error" role="alert">
                  {deptFormError}
                </div>
              ) : null}

              <form className="admin-create-form" onSubmit={handleCreateDept}>
                <div className="admin-field">
                  <label htmlFor="dept-name">Name</label>
                  <input
                    id="dept-name"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Physiotherapy"
                    disabled={creatingDept}
                  />
                </div>
                <div className="admin-field">
                  <label htmlFor="dept-desc">
                    Description <span className="admin-optional">(optional)</span>
                  </label>
                  <input
                    id="dept-desc"
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder="Short note for patients"
                    disabled={creatingDept}
                  />
                </div>
                <button
                  type="submit"
                  className="admin-primary"
                  disabled={creatingDept}
                >
                  {creatingDept ? 'Adding…' : 'Add department'}
                </button>
              </form>

              {departments.length === 0 ? (
                <div className="admin-empty">
                  <p>No departments yet — add one above.</p>
                </div>
              ) : (
                <ul className="admin-dept-list">
                  {departments.map((dept) => (
                    <li key={dept.id} className="admin-dept-card">
                      {editingDeptId === dept.id ? (
                        <form className="admin-edit-form" onSubmit={saveEditDept}>
                          <div className="admin-field">
                            <label htmlFor={`edit-name-${dept.id}`}>Name</label>
                            <input
                              id={`edit-name-${dept.id}`}
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              disabled={savingDeptId === dept.id}
                            />
                          </div>
                          <div className="admin-field">
                            <label htmlFor={`edit-desc-${dept.id}`}>
                              Description
                            </label>
                            <input
                              id={`edit-desc-${dept.id}`}
                              value={editDescription}
                              onChange={(e) => setEditDescription(e.target.value)}
                              disabled={savingDeptId === dept.id}
                            />
                          </div>
                          <div className="admin-edit-actions">
                            <button
                              type="submit"
                              className="admin-primary admin-primary--compact"
                              disabled={savingDeptId === dept.id}
                            >
                              {savingDeptId === dept.id ? 'Saving…' : 'Save'}
                            </button>
                            <button
                              type="button"
                              className="admin-secondary"
                              onClick={cancelEditDept}
                              disabled={savingDeptId === dept.id}
                            >
                              Cancel
                            </button>
                          </div>
                        </form>
                      ) : (
                        <>
                          <div className="admin-dept-main">
                            <p className="admin-dept-name">{dept.name}</p>
                            {dept.description ? (
                              <p className="admin-dept-desc">{dept.description}</p>
                            ) : null}
                            <p className="admin-dept-meta">
                              {Number(dept.doctor_count) || 0} doctor
                              {Number(dept.doctor_count) === 1 ? '' : 's'}
                            </p>
                          </div>
                          <button
                            type="button"
                            className="admin-secondary"
                            onClick={() => startEditDept(dept)}
                          >
                            Edit
                          </button>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* —— Doctors —— */}
            <section
              className="admin-section"
              aria-labelledby="admin-doctors-heading"
            >
              <h2 id="admin-doctors-heading" className="admin-section-title">
                Doctors
              </h2>
              <p className="admin-section-lead">
                Create clinic doctor accounts and keep their department and
                status up to date.
              </p>

              {doctorFormError ? (
                <div className="admin-error" role="alert">
                  {doctorFormError}
                </div>
              ) : null}

              <form className="admin-create-form" onSubmit={handleCreateDoctor}>
                <h3 className="admin-subheading">Add a doctor</h3>
                <div className="admin-form-grid">
                  <div className="admin-field">
                    <label htmlFor="doc-first">First name</label>
                    <input
                      id="doc-first"
                      value={doctorForm.first_name}
                      onChange={(e) =>
                        updateDoctorFormField('first_name', e.target.value)
                      }
                      disabled={creatingDoctor}
                    />
                  </div>
                  <div className="admin-field">
                    <label htmlFor="doc-last">Last name</label>
                    <input
                      id="doc-last"
                      value={doctorForm.last_name}
                      onChange={(e) =>
                        updateDoctorFormField('last_name', e.target.value)
                      }
                      disabled={creatingDoctor}
                    />
                  </div>
                </div>
                <div className="admin-field">
                  <label htmlFor="doc-email">Email</label>
                  <input
                    id="doc-email"
                    type="email"
                    value={doctorForm.email}
                    onChange={(e) =>
                      updateDoctorFormField('email', e.target.value)
                    }
                    placeholder="doctor@healio.local"
                    disabled={creatingDoctor}
                  />
                </div>
                <div className="admin-field">
                  <label htmlFor="doc-password">Temporary password</label>
                  <input
                    id="doc-password"
                    type="password"
                    value={doctorForm.password}
                    onChange={(e) =>
                      updateDoctorFormField('password', e.target.value)
                    }
                    placeholder="At least 8 characters"
                    disabled={creatingDoctor}
                  />
                </div>
                <div className="admin-form-grid">
                  <div className="admin-field">
                    <label htmlFor="doc-dept">Department</label>
                    <select
                      id="doc-dept"
                      value={doctorForm.department_id}
                      onChange={(e) =>
                        updateDoctorFormField('department_id', e.target.value)
                      }
                      disabled={creatingDoctor || departments.length === 0}
                    >
                      <option value="">Select department</option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="admin-field">
                    <label htmlFor="doc-spec">
                      Specialization{' '}
                      <span className="admin-optional">(optional)</span>
                    </label>
                    <input
                      id="doc-spec"
                      value={doctorForm.specialization}
                      onChange={(e) =>
                        updateDoctorFormField('specialization', e.target.value)
                      }
                      placeholder="e.g. General Practice"
                      disabled={creatingDoctor}
                    />
                  </div>
                </div>
                <div className="admin-field">
                  <label htmlFor="doc-phone">
                    Phone <span className="admin-optional">(optional)</span>
                  </label>
                  <input
                    id="doc-phone"
                    type="tel"
                    value={doctorForm.phone}
                    onChange={(e) =>
                      updateDoctorFormField('phone', e.target.value)
                    }
                    disabled={creatingDoctor}
                  />
                </div>
                <button
                  type="submit"
                  className="admin-primary"
                  disabled={creatingDoctor || departments.length === 0}
                >
                  {creatingDoctor ? 'Creating…' : 'Create doctor'}
                </button>
              </form>

              <div className="admin-filter-row">
                <label htmlFor="doctor-filter">Filter by department</label>
                <select
                  id="doctor-filter"
                  value={doctorFilter}
                  onChange={(e) => setDoctorFilter(e.target.value)}
                >
                  <option value="all">All departments</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              {doctors.length === 0 ? (
                <div className="admin-empty">
                  <p>No doctors yet — create one above.</p>
                </div>
              ) : filteredDoctors.length === 0 ? (
                <div className="admin-empty">
                  <p>No doctors in this department.</p>
                </div>
              ) : (
                <div className="admin-doctor-groups">
                  {doctorsByDepartment.map(([deptName, docs]) => (
                    <div key={deptName} className="admin-doctor-group">
                      <h3 className="admin-group-title">{deptName}</h3>
                      <ul className="admin-dept-list">
                        {docs.map((doc) => (
                          <li key={doc.id} className="admin-dept-card admin-doctor-card">
                            {editingDoctorId === doc.id ? (
                              <form
                                className="admin-edit-form"
                                onSubmit={saveEditDoctor}
                              >
                                <p className="admin-dept-name">
                                  {doc.first_name} {doc.last_name}
                                </p>
                                <p className="admin-dept-desc">{doc.email}</p>
                                <div className="admin-field">
                                  <label htmlFor={`edit-doc-dept-${doc.id}`}>
                                    Department
                                  </label>
                                  <select
                                    id={`edit-doc-dept-${doc.id}`}
                                    value={editDoctor.department_id}
                                    onChange={(e) =>
                                      setEditDoctor((prev) => ({
                                        ...prev,
                                        department_id: e.target.value,
                                      }))
                                    }
                                    disabled={savingDoctorId === doc.id}
                                  >
                                    {departments.map((d) => (
                                      <option key={d.id} value={d.id}>
                                        {d.name}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <div className="admin-field">
                                  <label htmlFor={`edit-doc-spec-${doc.id}`}>
                                    Specialization
                                  </label>
                                  <input
                                    id={`edit-doc-spec-${doc.id}`}
                                    value={editDoctor.specialization}
                                    onChange={(e) =>
                                      setEditDoctor((prev) => ({
                                        ...prev,
                                        specialization: e.target.value,
                                      }))
                                    }
                                    disabled={savingDoctorId === doc.id}
                                  />
                                </div>
                                <label className="admin-toggle">
                                  <input
                                    type="checkbox"
                                    checked={editDoctor.is_active}
                                    onChange={(e) =>
                                      setEditDoctor((prev) => ({
                                        ...prev,
                                        is_active: e.target.checked,
                                      }))
                                    }
                                    disabled={savingDoctorId === doc.id}
                                  />
                                  <span>Active (can receive bookings)</span>
                                </label>
                                <div className="admin-edit-actions">
                                  <button
                                    type="submit"
                                    className="admin-primary admin-primary--compact"
                                    disabled={savingDoctorId === doc.id}
                                  >
                                    {savingDoctorId === doc.id
                                      ? 'Saving…'
                                      : 'Save'}
                                  </button>
                                  <button
                                    type="button"
                                    className="admin-secondary"
                                    onClick={cancelEditDoctor}
                                    disabled={savingDoctorId === doc.id}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </form>
                            ) : (
                              <>
                                <div className="admin-dept-main">
                                  <p className="admin-dept-name">
                                    {doc.first_name} {doc.last_name}
                                  </p>
                                  <p className="admin-dept-desc">
                                    {doc.specialization || 'No specialization set'}
                                    {' · '}
                                    {doc.department_name}
                                  </p>
                                  <p className="admin-dept-desc">{doc.email}</p>
                                  <p
                                    className={
                                      doc.is_active
                                        ? 'admin-badge admin-badge--active'
                                        : 'admin-badge admin-badge--inactive'
                                    }
                                  >
                                    {doc.is_active ? 'Active' : 'Inactive'}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  className="admin-secondary"
                                  onClick={() => startEditDoctor(doc)}
                                >
                                  Edit
                                </button>
                              </>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* —— Appointments —— */}
            <section
              className="admin-section"
              aria-labelledby="admin-appts-heading"
            >
              <h2 id="admin-appts-heading" className="admin-section-title">
                Appointments
              </h2>
              <p className="admin-section-lead">
                Clinic-wide bookings, most recent first (up to 200 matches).
              </p>

              <div className="admin-appt-filters">
                <div className="admin-field">
                  <label htmlFor="appt-dept">Department</label>
                  <select
                    id="appt-dept"
                    value={apptFilters.department_id}
                    onChange={(e) =>
                      setApptFilter('department_id', e.target.value)
                    }
                  >
                    <option value="">All departments</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="admin-field">
                  <label htmlFor="appt-doctor">Doctor</label>
                  <select
                    id="appt-doctor"
                    value={apptFilters.doctor_id}
                    onChange={(e) => setApptFilter('doctor_id', e.target.value)}
                  >
                    <option value="">All doctors</option>
                    {apptDoctorOptions.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.first_name} {d.last_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="admin-field">
                  <label htmlFor="appt-date">Date</label>
                  <input
                    id="appt-date"
                    type="date"
                    value={apptFilters.date}
                    onChange={(e) => setApptFilter('date', e.target.value)}
                  />
                </div>
                <div className="admin-field">
                  <label htmlFor="appt-status">Status</label>
                  <select
                    id="appt-status"
                    value={apptFilters.status}
                    onChange={(e) => setApptFilter('status', e.target.value)}
                  >
                    {STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value || 'all'} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="admin-appt-filter-actions">
                  <button
                    type="button"
                    className="admin-secondary"
                    onClick={clearApptFilters}
                  >
                    Clear filters
                  </button>
                </div>
              </div>

              {apptError ? (
                <div className="admin-error" role="alert">
                  {apptError}
                </div>
              ) : null}

              {apptLoading ? (
                <p className="admin-muted">Loading appointments…</p>
              ) : appointments.length === 0 ? (
                <div className="admin-empty">
                  <p>No appointments match these filters.</p>
                </div>
              ) : (
                <>
                  <p className="admin-appt-count">
                    Showing {(apptPage - 1) * APPT_PAGE_SIZE + 1}–
                    {Math.min(apptPage * APPT_PAGE_SIZE, appointments.length)} of{' '}
                    {appointments.length}
                  </p>

                  <div className="admin-table-wrap">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th scope="col">Date</th>
                          <th scope="col">Time</th>
                          <th scope="col">Patient</th>
                          <th scope="col">Doctor</th>
                          <th scope="col">Department</th>
                          <th scope="col">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pagedAppointments.map((appt) => (
                          <tr key={appt.id}>
                            <td>{formatAdminApptDate(appt.appointment_date)}</td>
                            <td>{formatAdminApptTime(appt.appointment_time)}</td>
                            <td>
                              <span className="admin-patient-cell">
                                {appt.patient_first_name}{' '}
                                {appt.patient_last_name}
                                {appt.risk_flag ? (
                                  <span
                                    className="doc-risk"
                                    title="This patient has missed clinic appointments before"
                                  >
                                    ⚠ {appt.no_show_count} past no-shows
                                  </span>
                                ) : null}
                              </span>
                            </td>
                            <td>
                              {appt.doctor_first_name} {appt.doctor_last_name}
                            </td>
                            <td>{appt.department_name}</td>
                            <td>
                              <span
                                className={`doc-status doc-status--${appt.status}`}
                              >
                                {String(appt.status).replace('_', ' ')}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <ul className="admin-appt-cards">
                    {pagedAppointments.map((appt) => (
                      <li key={`card-${appt.id}`} className="admin-appt-card">
                        <div className="admin-appt-card-top">
                          <p className="admin-appt-when">
                            {formatAdminApptDate(appt.appointment_date)} ·{' '}
                            {formatAdminApptTime(appt.appointment_time)}
                          </p>
                          <span
                            className={`doc-status doc-status--${appt.status}`}
                          >
                            {String(appt.status).replace('_', ' ')}
                          </span>
                        </div>
                        <p className="admin-appt-patient">
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
                        <p className="admin-appt-meta">
                          {appt.doctor_first_name} {appt.doctor_last_name} ·{' '}
                          {appt.department_name}
                        </p>
                      </li>
                    ))}
                  </ul>

                  {apptTotalPages > 1 ? (
                    <div className="admin-pagination">
                      <button
                        type="button"
                        className="admin-secondary"
                        disabled={apptPage <= 1}
                        onClick={() => setApptPage((p) => Math.max(1, p - 1))}
                      >
                        Previous
                      </button>
                      <span className="admin-page-indicator">
                        Page {apptPage} of {apptTotalPages}
                      </span>
                      <button
                        type="button"
                        className="admin-secondary"
                        disabled={apptPage >= apptTotalPages}
                        onClick={() =>
                          setApptPage((p) => Math.min(apptTotalPages, p + 1))
                        }
                      >
                        Next
                      </button>
                    </div>
                  ) : null}
                </>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}

export default AdminDashboard;
