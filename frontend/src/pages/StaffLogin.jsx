/**
 * Staff login — same split-screen shell as patient Login.
 * Right panel uses staff photo/copy (clinical work tone).
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthSplitLayout from '../auth/AuthSplitLayout';
import { AUTH_VISUALS } from '../auth/authVisuals';
import { loginAdmin, loginDoctor } from '../api/auth';
import { useAuth } from '../context/AuthContext';

function StaffLogin() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [role, setRole] = useState('doctor'); // 'doctor' | 'admin'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password) {
      setError('Enter your clinic email and password.');
      return;
    }

    setSubmitting(true);
    try {
      const data =
        role === 'admin'
          ? await loginAdmin({ email: email.trim(), password })
          : await loginDoctor({ email: email.trim(), password });
      login(data.token, data.user);
      navigate(role === 'admin' ? '/admin' : '/doctor');
    } catch (err) {
      const msg = (err.message || '').trim();
      if (/invalid email or password/i.test(msg) || err.status === 401) {
        setError('Incorrect email or password.');
      } else if (msg) {
        setError(msg);
      } else {
        setError('Incorrect email or password.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthSplitLayout visual={AUTH_VISUALS.staff}>
      <header className="login-header">
        <Link to="/" className="login-brand">
          Healio
        </Link>
        <h1 className="login-title">Staff login</h1>
        <p className="login-subtitle">
          For clinic doctors and admins. Patients should use the patient login.
        </p>
      </header>

      <form className="login-form" onSubmit={handleSubmit} noValidate>
        {error ? (
          <div className="login-error" role="alert">
            {error}
          </div>
        ) : null}

        <div className="login-field">
          <span className="login-label-text" id="staff-role-label">
            I am a
          </span>
          <div
            className="staff-role-toggle"
            role="group"
            aria-labelledby="staff-role-label"
          >
            <button
              type="button"
              className={
                role === 'doctor' ? 'staff-role-btn is-active' : 'staff-role-btn'
              }
              onClick={() => setRole('doctor')}
              disabled={submitting}
              aria-pressed={role === 'doctor'}
            >
              Doctor
            </button>
            <button
              type="button"
              className={
                role === 'admin' ? 'staff-role-btn is-active' : 'staff-role-btn'
              }
              onClick={() => setRole('admin')}
              disabled={submitting}
              aria-pressed={role === 'admin'}
            >
              Admin
            </button>
          </div>
        </div>

        <div className="login-field">
          <label htmlFor="staff-email">Email</label>
          <input
            id="staff-email"
            name="email"
            type="email"
            autoComplete="username"
            inputMode="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={
              role === 'admin' ? 'admin@healio.local' : 'doctor@healio.local'
            }
            disabled={submitting}
          />
        </div>

        <div className="login-field">
          <label htmlFor="staff-password">Password</label>
          <div className="login-password-wrap">
            <input
              id="staff-password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password"
              disabled={submitting}
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
        </div>

        <button type="submit" className="login-submit" disabled={submitting}>
          {submitting ? 'Signing in…' : 'Log in'}
        </button>
      </form>

      <p className="login-footer">
        Patient? <Link to="/login">Go to patient login</Link>
      </p>
    </AuthSplitLayout>
  );
}

export default StaffLogin;
