-- Notifications log for waitlist alerts (no email/SMS yet)
USE healio;

CREATE TABLE IF NOT EXISTS notifications (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  patient_id INT UNSIGNED NOT NULL,
  waitlist_id INT UNSIGNED NULL,
  appointment_id INT UNSIGNED NULL,
  channel ENUM('log', 'email', 'sms') NOT NULL DEFAULT 'log',
  message VARCHAR(1000) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_notifications_patient_id (patient_id),
  KEY idx_notifications_waitlist_id (waitlist_id),
  CONSTRAINT fk_notifications_patient
    FOREIGN KEY (patient_id) REFERENCES patients (id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,
  CONSTRAINT fk_notifications_waitlist
    FOREIGN KEY (waitlist_id) REFERENCES waitlist (id)
    ON UPDATE CASCADE
    ON DELETE SET NULL,
  CONSTRAINT fk_notifications_appointment
    FOREIGN KEY (appointment_id) REFERENCES appointments (id)
    ON UPDATE CASCADE
    ON DELETE SET NULL
) ENGINE=InnoDB;
