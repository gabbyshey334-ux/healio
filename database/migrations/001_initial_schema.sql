-- Healio schema migration
-- Federal Polytechnic Ilaro Medical Clinic
-- Appointments use fixed 30-minute slots (duration_minutes DEFAULT 30)

CREATE DATABASE IF NOT EXISTS healio
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE healio;

-- 1. Departments
CREATE TABLE IF NOT EXISTS departments (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  description TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_departments_name (name)
) ENGINE=InnoDB;

-- 2. Patients (self-register)
CREATE TABLE IF NOT EXISTS patients (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  matric_or_staff_id VARCHAR(50) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  phone VARCHAR(20) NULL,
  gender ENUM('male', 'female', 'other') NULL,
  date_of_birth DATE NULL,
  user_type ENUM('student', 'staff') NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_patients_matric_or_staff_id (matric_or_staff_id),
  UNIQUE KEY uq_patients_email (email)
) ENGINE=InnoDB;

-- 3. Doctors (created by admin only)
CREATE TABLE IF NOT EXISTS doctors (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  department_id INT UNSIGNED NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  phone VARCHAR(20) NULL,
  specialization VARCHAR(150) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_doctors_email (email),
  KEY idx_doctors_department_id (department_id),
  CONSTRAINT fk_doctors_department
    FOREIGN KEY (department_id) REFERENCES departments (id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
) ENGINE=InnoDB;

-- 4. Admins (not self-registered)
CREATE TABLE IF NOT EXISTS admins (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_admins_email (email)
) ENGINE=InnoDB;

-- 5. Appointments (30-minute slots by default)
CREATE TABLE IF NOT EXISTS appointments (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  patient_id INT UNSIGNED NOT NULL,
  doctor_id INT UNSIGNED NOT NULL,
  department_id INT UNSIGNED NOT NULL,
  appointment_date DATE NOT NULL,
  appointment_time TIME NOT NULL,
  duration_minutes INT UNSIGNED NOT NULL DEFAULT 30,
  status ENUM('pending', 'confirmed', 'completed', 'cancelled', 'no_show')
    NOT NULL DEFAULT 'pending',
  reason VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_appointments_doctor_slot (doctor_id, appointment_date, appointment_time),
  KEY idx_appointments_patient_status (patient_id, status),
  KEY idx_appointments_department_id (department_id),
  CONSTRAINT fk_appointments_patient
    FOREIGN KEY (patient_id) REFERENCES patients (id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT fk_appointments_doctor
    FOREIGN KEY (doctor_id) REFERENCES doctors (id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT fk_appointments_department
    FOREIGN KEY (department_id) REFERENCES departments (id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
) ENGINE=InnoDB;

-- 6. Waitlist
CREATE TABLE IF NOT EXISTS waitlist (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  patient_id INT UNSIGNED NOT NULL,
  department_id INT UNSIGNED NOT NULL,
  doctor_id INT UNSIGNED NULL,
  preferred_date DATE NULL,
  preferred_period ENUM('morning', 'afternoon', 'any') NOT NULL DEFAULT 'any',
  status ENUM('waiting', 'notified', 'booked', 'cancelled', 'expired')
    NOT NULL DEFAULT 'waiting',
  notes VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_waitlist_patient_id (patient_id),
  KEY idx_waitlist_department_id (department_id),
  KEY idx_waitlist_doctor_id (doctor_id),
  KEY idx_waitlist_status (status),
  CONSTRAINT fk_waitlist_patient
    FOREIGN KEY (patient_id) REFERENCES patients (id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT fk_waitlist_department
    FOREIGN KEY (department_id) REFERENCES departments (id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT fk_waitlist_doctor
    FOREIGN KEY (doctor_id) REFERENCES doctors (id)
    ON UPDATE CASCADE
    ON DELETE SET NULL
) ENGINE=InnoDB;
