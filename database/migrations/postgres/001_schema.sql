-- Healio Postgres schema (Neon on Vercel)

CREATE TABLE IF NOT EXISTS departments (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS patients (
  id SERIAL PRIMARY KEY,
  matric_or_staff_id VARCHAR(50) NOT NULL UNIQUE,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  phone VARCHAR(20) NULL,
  gender VARCHAR(20) NULL,
  date_of_birth DATE NULL,
  user_type VARCHAR(20) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS doctors (
  id SERIAL PRIMARY KEY,
  department_id INT NOT NULL REFERENCES departments (id) ON UPDATE CASCADE ON DELETE RESTRICT,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  phone VARCHAR(20) NULL,
  specialization VARCHAR(150) NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_doctors_department_id ON doctors (department_id);

CREATE TABLE IF NOT EXISTS admins (
  id SERIAL PRIMARY KEY,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS appointments (
  id SERIAL PRIMARY KEY,
  patient_id INT NOT NULL REFERENCES patients (id) ON UPDATE CASCADE ON DELETE RESTRICT,
  doctor_id INT NOT NULL REFERENCES doctors (id) ON UPDATE CASCADE ON DELETE RESTRICT,
  department_id INT NOT NULL REFERENCES departments (id) ON UPDATE CASCADE ON DELETE RESTRICT,
  appointment_date DATE NOT NULL,
  appointment_time TIME NOT NULL,
  duration_minutes INT NOT NULL DEFAULT 30,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  reason VARCHAR(500) NULL,
  active_slot_key VARCHAR(64) GENERATED ALWAYS AS (
    CASE
      WHEN status IN ('pending', 'confirmed')
        THEN doctor_id::text || '-' || appointment_date::text || '-' || appointment_time::text
      ELSE NULL
    END
  ) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (doctor_id, appointment_date, appointment_time)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_appointments_active_slot
  ON appointments (active_slot_key);

CREATE INDEX IF NOT EXISTS idx_appointments_patient_status
  ON appointments (patient_id, status);

CREATE INDEX IF NOT EXISTS idx_appointments_department_id
  ON appointments (department_id);

CREATE TABLE IF NOT EXISTS waitlist (
  id SERIAL PRIMARY KEY,
  patient_id INT NOT NULL REFERENCES patients (id) ON UPDATE CASCADE ON DELETE RESTRICT,
  department_id INT NOT NULL REFERENCES departments (id) ON UPDATE CASCADE ON DELETE RESTRICT,
  doctor_id INT NULL REFERENCES doctors (id) ON UPDATE CASCADE ON DELETE SET NULL,
  preferred_date DATE NULL,
  preferred_period VARCHAR(20) NOT NULL DEFAULT 'any',
  status VARCHAR(20) NOT NULL DEFAULT 'waiting',
  notes VARCHAR(500) NULL,
  notified_doctor_id INT NULL,
  notified_date DATE NULL,
  notified_time TIME NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_waitlist_patient_id ON waitlist (patient_id);
CREATE INDEX IF NOT EXISTS idx_waitlist_department_id ON waitlist (department_id);
CREATE INDEX IF NOT EXISTS idx_waitlist_doctor_id ON waitlist (doctor_id);
CREATE INDEX IF NOT EXISTS idx_waitlist_status ON waitlist (status);
CREATE INDEX IF NOT EXISTS idx_waitlist_notified_doctor_id ON waitlist (notified_doctor_id);

CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  patient_id INT NOT NULL REFERENCES patients (id) ON UPDATE CASCADE ON DELETE CASCADE,
  waitlist_id INT NULL REFERENCES waitlist (id) ON UPDATE CASCADE ON DELETE SET NULL,
  appointment_id INT NULL REFERENCES appointments (id) ON UPDATE CASCADE ON DELETE SET NULL,
  channel VARCHAR(20) NOT NULL DEFAULT 'log',
  message VARCHAR(1000) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_patient_id ON notifications (patient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_waitlist_id ON notifications (waitlist_id);
