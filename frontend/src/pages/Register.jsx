/**
 * Patient Register — same split-screen auth shell as Login.
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthSplitLayout from '../auth/AuthSplitLayout';
import { AUTH_VISUALS } from '../auth/authVisuals';
import { registerPatient } from '../api/auth';
import { useAuth } from '../context/AuthContext';

const EMPTY_FORM = {
  matric_or_staff_id: '',
  first_name: '',
  last_name: '',
  email: '',
  password: '',
  user_type: 'student',
  phone: '',
};

function validate(form) {
  const fieldErrors = {};

  if (!form.matric_or_staff_id.trim()) {
    fieldErrors.matric_or_staff_id = 'Matric/Staff ID is required.';
  }

  if (!form.first_name.trim()) {
    fieldErrors.first_name = 'First name is required.';
  }

  if (!form.last_name.trim()) {
    fieldErrors.last_name = 'Last name is required.';
  }

  if (!form.email.trim()) {
    fieldErrors.email = 'Email is required.';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
    fieldErrors.email = 'Enter a valid email address.';
  }

  if (!form.password) {
    fieldErrors.password = 'Password is required.';
  } else if (form.password.length < 8) {
    fieldErrors.password = 'Password must be at least 8 characters.';
  }

  if (!['student', 'staff'].includes(form.user_type)) {
    fieldErrors.user_type = 'Choose student or staff.';
  }

  return fieldErrors;
}

function Register() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [form, setForm] = useState(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  function updateField(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError('');

    const nextErrors = validate(form);
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setFormError('Check the highlighted fields and try again.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        matric_or_staff_id: form.matric_or_staff_id.trim(),
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        email: form.email.trim(),
        password: form.password,
        user_type: form.user_type,
      };
      if (form.phone.trim()) {
        payload.phone = form.phone.trim();
      }

      const data = await registerPatient(payload);
      login(data.token, data.user);
      navigate('/home');
    } catch (err) {
      setFormError(err.message || 'Registration failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthSplitLayout visual={AUTH_VISUALS.patient} formWide>
      <header className="login-header">
        <Link to="/" className="login-brand">
          Healio
        </Link>
        <h1 className="login-title">Create your account</h1>
        <p className="login-subtitle">
          Register once, then book clinic appointments without joining the queue
          in person.
        </p>
      </header>

      <form className="login-form" onSubmit={handleSubmit} noValidate>
        {formError ? (
          <div className="login-error" role="alert">
            {formError}
          </div>
        ) : null}

        <div className="login-field">
          <label htmlFor="register-matric">Matric / Staff ID</label>
          <input
            id="register-matric"
            name="matric_or_staff_id"
            type="text"
            autoComplete="username"
            value={form.matric_or_staff_id}
            onChange={(e) => updateField('matric_or_staff_id', e.target.value)}
            placeholder="e.g. HND/CS/2021/001"
            disabled={submitting}
            aria-invalid={Boolean(fieldErrors.matric_or_staff_id)}
            aria-describedby={
              fieldErrors.matric_or_staff_id ? 'err-matric' : undefined
            }
          />
          {fieldErrors.matric_or_staff_id ? (
            <p id="err-matric" className="login-field-error">
              {fieldErrors.matric_or_staff_id}
            </p>
          ) : null}
        </div>

        <div className="login-row">
          <div className="login-field">
            <label htmlFor="register-first-name">First name</label>
            <input
              id="register-first-name"
              name="first_name"
              type="text"
              autoComplete="given-name"
              value={form.first_name}
              onChange={(e) => updateField('first_name', e.target.value)}
              placeholder="First name"
              disabled={submitting}
              aria-invalid={Boolean(fieldErrors.first_name)}
              aria-describedby={
                fieldErrors.first_name ? 'err-first-name' : undefined
              }
            />
            {fieldErrors.first_name ? (
              <p id="err-first-name" className="login-field-error">
                {fieldErrors.first_name}
              </p>
            ) : null}
          </div>

          <div className="login-field">
            <label htmlFor="register-last-name">Last name</label>
            <input
              id="register-last-name"
              name="last_name"
              type="text"
              autoComplete="family-name"
              value={form.last_name}
              onChange={(e) => updateField('last_name', e.target.value)}
              placeholder="Last name"
              disabled={submitting}
              aria-invalid={Boolean(fieldErrors.last_name)}
              aria-describedby={
                fieldErrors.last_name ? 'err-last-name' : undefined
              }
            />
            {fieldErrors.last_name ? (
              <p id="err-last-name" className="login-field-error">
                {fieldErrors.last_name}
              </p>
            ) : null}
          </div>
        </div>

        <div className="login-field">
          <label htmlFor="register-email">Email</label>
          <input
            id="register-email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={form.email}
            onChange={(e) => updateField('email', e.target.value)}
            placeholder="you@student.fpi.edu.ng"
            disabled={submitting}
            aria-invalid={Boolean(fieldErrors.email)}
            aria-describedby={fieldErrors.email ? 'err-email' : undefined}
          />
          {fieldErrors.email ? (
            <p id="err-email" className="login-field-error">
              {fieldErrors.email}
            </p>
          ) : null}
        </div>

        <div className="login-field">
          <label htmlFor="register-password">Password</label>
          <div className="login-password-wrap">
            <input
              id="register-password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={form.password}
              onChange={(e) => updateField('password', e.target.value)}
              placeholder="At least 8 characters"
              disabled={submitting}
              aria-invalid={Boolean(fieldErrors.password)}
              aria-describedby={
                fieldErrors.password ? 'err-password' : undefined
              }
            />
            <button
              type="button"
              className="login-password-toggle"
              onClick={() => setShowPassword((v) => !v)}
              disabled={submitting}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-pressed={showPassword}
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
          {fieldErrors.password ? (
            <p id="err-password" className="login-field-error">
              {fieldErrors.password}
            </p>
          ) : null}
        </div>

        <div className="login-field">
          <span className="login-label-text" id="user-type-label">
            I am a
          </span>
          <div
            className="register-toggle"
            role="group"
            aria-labelledby="user-type-label"
          >
            <button
              type="button"
              className={
                form.user_type === 'student'
                  ? 'register-toggle-btn is-active'
                  : 'register-toggle-btn'
              }
              onClick={() => updateField('user_type', 'student')}
              disabled={submitting}
              aria-pressed={form.user_type === 'student'}
            >
              Student
            </button>
            <button
              type="button"
              className={
                form.user_type === 'staff'
                  ? 'register-toggle-btn is-active'
                  : 'register-toggle-btn'
              }
              onClick={() => updateField('user_type', 'staff')}
              disabled={submitting}
              aria-pressed={form.user_type === 'staff'}
            >
              Staff
            </button>
          </div>
          {fieldErrors.user_type ? (
            <p className="login-field-error">{fieldErrors.user_type}</p>
          ) : null}
        </div>

        <div className="login-field">
          <label htmlFor="register-phone">
            Phone <span className="login-optional">(optional)</span>
          </label>
          <input
            id="register-phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            value={form.phone}
            onChange={(e) => updateField('phone', e.target.value)}
            placeholder="08012345678"
            disabled={submitting}
          />
        </div>

        <button type="submit" className="login-submit" disabled={submitting}>
          {submitting ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      <p className="login-footer">
        Already registered? <Link to="/login">Log in</Link>
      </p>
    </AuthSplitLayout>
  );
}

export default Register;
