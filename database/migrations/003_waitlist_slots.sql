-- Waitlist offered-slot columns + active appointment slot uniqueness
-- Safe to re-run (idempotent checks).
USE healio;

-- Nullable virtual key: only pending/confirmed occupy a slot (cancelled do not block rebooking)
SET @has_col := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = 'healio'
    AND table_name = 'appointments'
    AND column_name = 'active_slot_key'
);
SET @sql := IF(
  @has_col = 0,
  'ALTER TABLE appointments ADD COLUMN active_slot_key VARCHAR(64) AS (
      IF(status IN (''pending'',''confirmed''),
         CONCAT(doctor_id, ''-'', appointment_date, ''-'', appointment_time),
         NULL)
    ) VIRTUAL',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_uq := (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = 'healio'
    AND table_name = 'appointments'
    AND index_name = 'uq_appointments_active_slot'
);
SET @sql := IF(
  @has_uq = 0,
  'ALTER TABLE appointments ADD UNIQUE KEY uq_appointments_active_slot (active_slot_key)',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Offered slot stored when a waitlist entry is notified
SET @has_col := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = 'healio'
    AND table_name = 'waitlist'
    AND column_name = 'notified_doctor_id'
);
SET @sql := IF(
  @has_col = 0,
  'ALTER TABLE waitlist
     ADD COLUMN notified_doctor_id INT UNSIGNED NULL AFTER notes,
     ADD COLUMN notified_date DATE NULL AFTER notified_doctor_id,
     ADD COLUMN notified_time TIME NULL AFTER notified_date,
     ADD KEY idx_waitlist_notified_doctor_id (notified_doctor_id)',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
