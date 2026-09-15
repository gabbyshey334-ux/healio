/**
 * Defense demo seed for Healio.
 *
 * Creates realistic clinic data:
 *   - 4 departments
 *   - 8 doctors (2 inactive)
 *   - 18 patients with mixed histories
 *   - Past + upcoming appointments (completed / cancelled / no_show / pending)
 *   - Waitlist entries (waiting / notified / booked)
 *
 * Usage (from backend/):
 *   npm run seed              # wipe patients/appointments/waitlist, reseed demo
 *   npm run seed -- --keep    # upsert staff only; keep existing patient data
 */

import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import pool from '../../database/connection.js';

dotenv.config();

const PATIENT_PASSWORD = 'Patient123!';
const DOCTOR_PASSWORD = 'Doctor123!';
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || 'admin@healio.local';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'Admin123!';

const DEPARTMENTS = [
  {
    id: 1,
    name: 'General Outpatient',
    description: 'General consultations and common illnesses',
  },
  {
    id: 2,
    name: 'Dental',
    description: 'Dental checks, pain, and extractions',
  },
  {
    id: 3,
    name: 'Eye Clinic',
    description: 'Vision checks and eye complaints',
  },
  {
    id: 4,
    name: 'Laboratory',
    description: 'Lab tests referred by a clinician',
  },
];

/** Doctors keyed by email so seed is idempotent */
const DOCTORS = [
  {
    email: process.env.SEED_DOCTOR_EMAIL || 'doctor@healio.local',
    first_name: 'Ada',
    last_name: 'Okoro',
    department_id: 1,
    specialization: 'General Practice',
    phone: '08031110001',
    is_active: 1,
  },
  {
    email: 'chidi.eze@healio.local',
    first_name: 'Chidi',
    last_name: 'Eze',
    department_id: 1,
    specialization: 'Family Medicine',
    phone: '08031110002',
    is_active: 1,
  },
  {
    email: 'funmi.adebayo@healio.local',
    first_name: 'Funmi',
    last_name: 'Adebayo',
    department_id: 1,
    specialization: 'General Practice',
    phone: '08031110003',
    is_active: 0, // inactive — should not appear in booking
  },
  {
    email: 'bola.adeyemi@healio.local',
    first_name: 'Bola',
    last_name: 'Adeyemi',
    department_id: 2,
    specialization: 'Dentistry',
    phone: '08031110004',
    is_active: 1,
  },
  {
    email: 'tunde.bakare@healio.local',
    first_name: 'Tunde',
    last_name: 'Bakare',
    department_id: 2,
    specialization: 'Oral Surgery',
    phone: '08031110005',
    is_active: 0, // inactive
  },
  {
    email: 'ngozi.ibe@healio.local',
    first_name: 'Ngozi',
    last_name: 'Ibe',
    department_id: 3,
    specialization: 'Optometry',
    phone: '08031110006',
    is_active: 1,
  },
  {
    email: 'kemi.yusuf@healio.local',
    first_name: 'Kemi',
    last_name: 'Yusuf',
    department_id: 3,
    specialization: 'Ophthalmology',
    phone: '08031110007',
    is_active: 1,
  },
  {
    email: 'ibrahim.musa@healio.local',
    first_name: 'Ibrahim',
    last_name: 'Musa',
    department_id: 4,
    specialization: 'Clinical Lab',
    phone: '08031110008',
    is_active: 1,
  },
];

function isoDaysFromToday(offset) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

async function upsertDepartment(dept) {
  await pool.query(
    `INSERT INTO departments (id, name, description)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE
       name = VALUES(name),
       description = VALUES(description)`,
    [dept.id, dept.name, dept.description],
  );
}

async function upsertAdmin(passwordHash) {
  await pool.query(
    `INSERT INTO admins (first_name, last_name, email, password_hash)
     VALUES ('Clinic', 'Admin', ?, ?)
     ON DUPLICATE KEY UPDATE
       first_name = VALUES(first_name),
       last_name = VALUES(last_name),
       password_hash = VALUES(password_hash)`,
    [ADMIN_EMAIL, passwordHash],
  );
}

async function upsertDoctor(doc, passwordHash) {
  await pool.query(
    `INSERT INTO doctors
      (department_id, first_name, last_name, email, password_hash, phone, specialization, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       department_id = VALUES(department_id),
       first_name = VALUES(first_name),
       last_name = VALUES(last_name),
       password_hash = VALUES(password_hash),
       phone = VALUES(phone),
       specialization = VALUES(specialization),
       is_active = VALUES(is_active)`,
    [
      doc.department_id,
      doc.first_name,
      doc.last_name,
      doc.email,
      passwordHash,
      doc.phone,
      doc.specialization,
      doc.is_active,
    ],
  );
}

async function clearPatientData() {
  // FK-safe wipe of demo transactional data
  await pool.query('DELETE FROM notifications');
  await pool.query('DELETE FROM waitlist');
  await pool.query('DELETE FROM appointments');
  await pool.query('DELETE FROM patients');
}

async function insertPatient(p, passwordHash) {
  const [result] = await pool.query(
    `INSERT INTO patients
      (matric_or_staff_id, first_name, last_name, email, password_hash, phone, user_type)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      p.matric,
      p.first_name,
      p.last_name,
      p.email,
      passwordHash,
      p.phone || null,
      p.user_type,
    ],
  );
  return result.insertId;
}

async function seed() {
  const keepExisting = process.argv.includes('--keep');

  console.log('Seeding Healio demo data…');

  for (const dept of DEPARTMENTS) {
    await upsertDepartment(dept);
  }
  console.log(`  ✓ ${DEPARTMENTS.length} departments`);

  const adminHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  await upsertAdmin(adminHash);
  console.log(`  ✓ admin ${ADMIN_EMAIL}`);

  const doctorHash = await bcrypt.hash(DOCTOR_PASSWORD, 10);
  const doctorIdsByEmail = {};
  for (const doc of DOCTORS) {
    await upsertDoctor(doc, doctorHash);
    const [rows] = await pool.query(
      'SELECT id FROM doctors WHERE email = ? LIMIT 1',
      [doc.email],
    );
    doctorIdsByEmail[doc.email] = rows[0].id;
  }
  console.log(
    `  ✓ ${DOCTORS.length} doctors (${DOCTORS.filter((d) => !d.is_active).length} inactive)`,
  );

  if (keepExisting) {
    console.log('  · skipped patients/appointments (--keep)');
    await pool.end();
    printCredentials();
    return;
  }

  await clearPatientData();

  const patientHash = await bcrypt.hash(PATIENT_PASSWORD, 10);

  const patientDefs = [
    // Risk-flag patients (2+ no-shows)
    {
      key: 'risk1',
      matric: 'HND/CS/2020/101',
      first_name: 'Chidi',
      last_name: 'Nwosu',
      email: 'chidi.nwosu@student.fpi.edu.ng',
      phone: '08040001001',
      user_type: 'student',
    },
    {
      key: 'risk2',
      matric: 'HND/BA/2019/044',
      first_name: 'Blessing',
      last_name: 'Okeke',
      email: 'blessing.okeke@student.fpi.edu.ng',
      phone: '08040001002',
      user_type: 'student',
    },
    // Upcoming appointments
    {
      key: 'up1',
      matric: 'ND/EE/2022/210',
      first_name: 'Tolu',
      last_name: 'Adeyemi',
      email: 'tolu.adeyemi@student.fpi.edu.ng',
      phone: '08040001003',
      user_type: 'student',
    },
    {
      key: 'up2',
      matric: 'STAFF/REG/012',
      first_name: 'Amaka',
      last_name: 'Okafor',
      email: 'amaka.okafor@fpi.edu.ng',
      phone: '08040001004',
      user_type: 'staff',
    },
    {
      key: 'up3',
      matric: 'HND/ACCT/2021/088',
      first_name: 'Yusuf',
      last_name: 'Bello',
      email: 'yusuf.bello@student.fpi.edu.ng',
      phone: '08040001005',
      user_type: 'student',
    },
    // Waitlist users
    {
      key: 'wl_wait',
      matric: 'ND/CS/2023/055',
      first_name: 'Sade',
      last_name: 'Ogunleye',
      email: 'sade.ogunleye@student.fpi.edu.ng',
      phone: '08040001006',
      user_type: 'student',
    },
    {
      key: 'wl_note',
      matric: 'HND/STAT/2020/033',
      first_name: 'Ifeanyi',
      last_name: 'Okoro',
      email: 'ifeanyi.okoro@student.fpi.edu.ng',
      phone: '08040001007',
      user_type: 'student',
    },
    {
      key: 'wl_book',
      matric: 'STAFF/LIB/007',
      first_name: 'Ngozi',
      last_name: 'Eze',
      email: 'ngozi.eze@fpi.edu.ng',
      phone: '08040001008',
      user_type: 'staff',
    },
    // Regular history patients
    {
      key: 'h1',
      matric: 'HND/CS/2021/001',
      first_name: 'Tunde',
      last_name: 'Adebayo',
      email: 'tunde.adebayo@student.fpi.edu.ng',
      phone: '08040001009',
      user_type: 'student',
    },
    {
      key: 'h2',
      matric: 'ND/MECH/2022/077',
      first_name: 'Fatima',
      last_name: 'Abdullahi',
      email: 'fatima.abdullahi@student.fpi.edu.ng',
      phone: '08040001010',
      user_type: 'student',
    },
    {
      key: 'h3',
      matric: 'HND/BAM/2020/019',
      first_name: 'Emeka',
      last_name: 'Ibe',
      email: 'emeka.ibe@student.fpi.edu.ng',
      phone: '08040001011',
      user_type: 'student',
    },
    {
      key: 'h4',
      matric: 'STAFF/ICT/003',
      first_name: 'Ronke',
      last_name: 'Salami',
      email: 'ronke.salami@fpi.edu.ng',
      phone: '08040001012',
      user_type: 'staff',
    },
    {
      key: 'h5',
      matric: 'ND/CS/2024/112',
      first_name: 'Hassan',
      last_name: 'Garba',
      email: 'hassan.garba@student.fpi.edu.ng',
      phone: '08040001013',
      user_type: 'student',
    },
    {
      key: 'h6',
      matric: 'HND/EE/2019/066',
      first_name: 'Chioma',
      last_name: 'Uche',
      email: 'chioma.uche@student.fpi.edu.ng',
      phone: '08040001014',
      user_type: 'student',
    },
    {
      key: 'h7',
      matric: 'ND/FOOD/2023/028',
      first_name: 'Aisha',
      last_name: 'Mohammed',
      email: 'aisha.mohammed@student.fpi.edu.ng',
      phone: '08040001015',
      user_type: 'student',
    },
    {
      key: 'h8',
      matric: 'HND/CS/2022/150',
      first_name: 'David',
      last_name: 'Ojo',
      email: 'david.ojo@student.fpi.edu.ng',
      phone: '08040001016',
      user_type: 'student',
    },
    {
      key: 'h9',
      matric: 'STAFF/WORKS/015',
      first_name: 'Grace',
      last_name: 'Fashola',
      email: 'grace.fashola@fpi.edu.ng',
      phone: '08040001017',
      user_type: 'staff',
    },
    {
      key: 'h10',
      matric: 'ND/CS/2021/099',
      first_name: 'Segun',
      last_name: 'Ajayi',
      email: 'segun.ajayi@student.fpi.edu.ng',
      phone: '08040001018',
      user_type: 'student',
    },
  ];

  const ids = {};
  for (const p of patientDefs) {
    ids[p.key] = await insertPatient(p, patientHash);
  }
  console.log(`  ✓ ${patientDefs.length} patients`);

  const primaryDoctorEmail =
    process.env.SEED_DOCTOR_EMAIL || 'doctor@healio.local';
  const ada = doctorIdsByEmail[primaryDoctorEmail];
  const chidi = doctorIdsByEmail['chidi.eze@healio.local'];
  const bola = doctorIdsByEmail['bola.adeyemi@healio.local'];
  const ngozi = doctorIdsByEmail['ngozi.ibe@healio.local'];
  const kemi = doctorIdsByEmail['kemi.yusuf@healio.local'];
  const ibrahim = doctorIdsByEmail['ibrahim.musa@healio.local'];

  if (!ada || !chidi || !bola || !ngozi || !kemi || !ibrahim) {
    throw new Error('Missing doctor ids after upsert — check department FKs');
  }
  const today = isoDaysFromToday(0);
  const tomorrow = isoDaysFromToday(1);
  const d = (n) => isoDaysFromToday(n);

  /**
   * Appointments: [patientKey, doctorId, deptId, dateOffset, time, status, reason]
   * Past week fills analytics; today/tomorrow show dashboards.
   */
  const appointments = [
    // —— Risk patient 1: 2 no-shows + upcoming today (badge shows)
    ['risk1', ada, 1, -12, '09:00:00', 'no_show', 'Missed follow-up'],
    ['risk1', ada, 1, -5, '10:00:00', 'no_show', 'Fever check'],
    ['risk1', ada, 1, 0, '11:00:00', 'pending', 'Cough and cold'],

    // —— Risk patient 2: 3 no-shows + confirmed tomorrow
    ['risk2', chidi, 1, -14, '09:30:00', 'no_show', 'Malaria symptoms'],
    ['risk2', bola, 2, -9, '10:30:00', 'no_show', 'Toothache'],
    ['risk2', ada, 1, -3, '14:00:00', 'no_show', 'Review'],
    ['risk2', ada, 1, 1, '09:00:00', 'confirmed', 'General check'],

    // —— Upcoming today for doctor Ada
    ['up1', ada, 1, 0, '09:00:00', 'confirmed', 'Sore throat'],
    ['up2', ada, 1, 0, '09:30:00', 'pending', 'Blood pressure review'],
    ['up3', chidi, 1, 0, '10:00:00', 'confirmed', 'Headache'],

    // —— Dental / Eye / Lab mix
    ['h1', bola, 2, 0, '11:00:00', 'pending', 'Tooth sensitivity'],
    ['h2', ngozi, 3, 1, '09:00:00', 'confirmed', 'Blurred vision'],
    ['h3', ibrahim, 4, 1, '10:00:00', 'pending', 'Lab referral — FBC'],

    // —— Past completed (analytics)
    ['h1', ada, 1, -1, '09:00:00', 'completed', 'Malaria test follow-up'],
    ['h2', ada, 1, -1, '10:00:00', 'completed', 'Allergy'],
    ['h3', chidi, 1, -2, '09:00:00', 'completed', 'Stomach pain'],
    ['h4', bola, 2, -2, '11:00:00', 'completed', 'Cleaning'],
    ['h5', ngozi, 3, -3, '09:30:00', 'completed', 'Eye strain'],
    ['h6', ada, 1, -3, '14:00:00', 'completed', 'Skin rash'],
    ['h7', chidi, 1, -4, '09:00:00', 'completed', 'Chest cold'],
    ['h8', bola, 2, -4, '10:00:00', 'completed', 'Filling'],
    ['h9', kemi, 3, -5, '11:00:00', 'completed', 'Vision screening'],
    ['h10', ibrahim, 4, -5, '09:00:00', 'completed', 'Urinalysis'],
    ['h4', ada, 1, -6, '09:30:00', 'completed', 'Hypertension review'],
    ['h5', ada, 1, -7, '10:30:00', 'completed', 'Back pain'],

    // —— Past cancelled / no_show (non-risk patients)
    ['h6', ada, 1, -8, '09:00:00', 'cancelled', 'Rescheduled by patient'],
    ['h7', chidi, 1, -8, '11:00:00', 'cancelled', 'Doctor leave'],
    ['h8', bola, 2, -9, '09:00:00', 'cancelled', 'No longer needed'],
    ['h9', ada, 1, -10, '14:30:00', 'no_show', 'Missed once'],
    ['h10', ngozi, 3, -11, '10:00:00', 'cancelled', 'Exam clash'],
    ['up1', ada, 1, -6, '15:00:00', 'completed', 'Earlier visit'],
    ['up2', chidi, 1, -4, '15:00:00', 'completed', 'Staff medical'],
    ['wl_book', ada, 1, -2, '15:30:00', 'completed', 'Resolved via waitlist'],
  ];

  for (const [pKey, doctorId, deptId, offset, time, status, reason] of appointments) {
    await pool.query(
      `INSERT INTO appointments
        (patient_id, doctor_id, department_id, appointment_date, appointment_time,
         duration_minutes, status, reason)
       VALUES (?, ?, ?, ?, ?, 30, ?, ?)`,
      [ids[pKey], doctorId, deptId, d(offset), time, status, reason],
    );
  }
  console.log(`  ✓ ${appointments.length} appointments`);

  // Waitlist: waiting / notified / booked
  await pool.query(
    `INSERT INTO waitlist
      (patient_id, department_id, doctor_id, preferred_date, preferred_period, status, notes)
     VALUES
      (?, 1, ?, ?, 'morning', 'waiting', 'Wants earliest morning slot'),
      (?, 2, NULL, NULL, 'any', 'waiting', 'Any dental doctor'),
      (?, 1, ?, ?, 'afternoon', 'notified', 'Slot offered after a cancel'),
      (?, 1, ?, ?, 'any', 'booked', 'Converted earlier this week')`,
    [
      ids.wl_wait,
      ada,
      tomorrow,
      ids.h5,
      ids.wl_note,
      ada,
      today,
      ids.wl_book,
      ada,
      d(-2),
    ],
  );

  // Attach offered slot on the notified entry (requires migration 003)
  const [colCheck] = await pool.query(
    `SHOW COLUMNS FROM waitlist LIKE 'notified_doctor_id'`,
  );
  if (colCheck.length > 0) {
    const [notifiedRows] = await pool.query(
      `SELECT id FROM waitlist WHERE patient_id = ? AND status = 'notified' LIMIT 1`,
      [ids.wl_note],
    );
    if (notifiedRows[0]) {
      await pool.query(
        `UPDATE waitlist
         SET notified_doctor_id = ?, notified_date = ?, notified_time = '13:00:00'
         WHERE id = ?`,
        [ada, today, notifiedRows[0].id],
      );
    }
  } else {
    console.warn(
      '  ! waitlist.notified_* columns missing — run migration 003 for Book now slots',
    );
  }

  console.log('  ✓ waitlist (waiting / notified / booked)');

  await pool.end();
  printCredentials();
}

function printCredentials() {
  console.log('\nSeed complete. Demo logins:\n');
  console.log(`  Admin    ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  console.log(
    `  Doctor   ${process.env.SEED_DOCTOR_EMAIL || 'doctor@healio.local'} / ${DOCTOR_PASSWORD}`,
  );
  console.log(`  Patient  tunde.adebayo@student.fpi.edu.ng / ${PATIENT_PASSWORD}`);
  console.log(`  Risk     chidi.nwosu@student.fpi.edu.ng / ${PATIENT_PASSWORD}`);
  console.log(`           (2 past no-shows — shows risk badge on staff dashboards)`);
  console.log(`  Waitlist ifeanyi.okoro@student.fpi.edu.ng / ${PATIENT_PASSWORD}`);
  console.log(`           (notified — Book now on My waitlist)\n`);
}

seed().catch(async (err) => {
  console.error('Seed failed:', err.message);
  console.error(err);
  try {
    await pool.end();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
