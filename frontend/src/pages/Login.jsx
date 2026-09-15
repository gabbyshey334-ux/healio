/**
 * Patient Login — split-screen auth (shared AuthSplitLayout).
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthSplitLayout from '../auth/AuthSplitLayout';
import { AUTH_VISUALS } from '../auth/authVisuals';
import { loginPatient } from '../api/auth';
import { useAuth } from '../context/AuthContext';

function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password) {
      setError('Enter your email and password to continue.');
      return;
    }

    setSubmitting(true);
    try {
      const data = await loginPatient({
        email: email.trim(),
        password,
      });
      login(data.token, data.user);
      navigate('/home');
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
    <AuthSplitLayout visual={AUTH_VISUALS.patient}>
      <header className="login-header">
        <Link to="/" className="login-brand">
          Healio
        </Link>
        <h1 className="login-title">Log in to book</h1>
        <p className="login-subtitle">
          Sign in with your student or staff account for the campus medical
          clinic.
        </p>
      </header>

      <form className="login-form" onSubmit={handleSubmit} noValidate>
        {error ? (
          <div className="login-error" role="alert">
            {error}
          </div>
        ) : null}

        <div className="login-field">
          <label htmlFor="login-email">Email</label>
          <input
            id="login-email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@student.fpi.edu.ng"
            disabled={submitting}
          />
        </div>

        <div className="login-field">
          <label htmlFor="login-password">Password</label>
          <div className="login-password-wrap">
            <input
              id="login-password"
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
        New patient? <Link to="/register">Create an account</Link>
      </p>
    </AuthSplitLayout>
  );
}

export default Login;
