/**
 * Public landing — hero only for now.
 * Full-bleed clinic photo, brand-first, Book / Log in.
 */

import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Landing.css';

function Landing() {
  const { isAuthenticated, user } = useAuth();

  if (isAuthenticated) {
    if (user?.role === 'doctor') return <Navigate to="/doctor" replace />;
    if (user?.role === 'admin') return <Navigate to="/admin" replace />;
    if (user?.role === 'patient') return <Navigate to="/home" replace />;
  }

  return (
    <main className="land">
      <section className="land-hero" aria-label="Healio introduction">
        <div className="land-hero-media" aria-hidden="true">
          <img
            src="/landing/hero.jpg"
            alt=""
            width={1920}
            height={1080}
            className="land-hero-img"
          />
          <div className="land-hero-veil" />
        </div>

        <header className="land-nav">
          <p className="land-nav-brand">Healio</p>
          <div className="land-nav-actions">
            <Link to="/login" className="land-nav-link">
              Log in
            </Link>
            <Link to="/staff/login" className="land-nav-staff">
              Staff
            </Link>
          </div>
        </header>

        <div className="land-hero-copy">
          <p className="land-brand land-rise land-rise--1">Healio</p>
          <h1 className="land-headline land-rise land-rise--2">
            Book clinic appointments without the queue
          </h1>
          <p className="land-support land-rise land-rise--3">
            For Federal Polytechnic Ilaro students and staff at the campus
            medical clinic.
          </p>
          <div className="land-cta-row land-rise land-rise--4">
            <Link to="/register" className="land-btn land-btn--light">
              Book appointment
            </Link>
            <Link to="/login" className="land-btn land-btn--ghost">
              Log in
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

export default Landing;
