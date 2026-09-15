/**
 * Capture desktop screenshots of every Healio screen for the project write-up.
 *
 * Prerequisites:
 *   - API on http://127.0.0.1:5000
 *   - Vite on http://127.0.0.1:5173
 *   - Demo seed applied (`cd backend && npm run seed`)
 *
 * Usage (from frontend/):
 *   npm run screenshots
 *
 * Output: ../screenshots/*.png (repo root)
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, '../../screenshots');
const BASE = process.env.HEALIO_BASE_URL || 'http://127.0.0.1:5173';
const API = process.env.HEALIO_API_URL || 'http://127.0.0.1:5000';

const ACCOUNTS = {
  patient: {
    email: 'tunde.adebayo@student.fpi.edu.ng',
    password: 'Patient123!',
    path: '/api/auth/patients/login',
  },
  waitlist: {
    email: 'ifeanyi.okoro@student.fpi.edu.ng',
    password: 'Patient123!',
    path: '/api/auth/patients/login',
  },
  doctor: {
    email: 'doctor@healio.local',
    password: 'Doctor123!',
    path: '/api/auth/doctors/login',
  },
  admin: {
    email: 'admin@healio.local',
    password: 'Admin123!',
    path: '/api/auth/admins/login',
  },
};

const VIEWPORT = { width: 1440, height: 900 };

const EXPECTED = [
  '01-landing.png',
  '02-login.png',
  '03-register.png',
  '04-staff-login.png',
  '05-home.png',
  '06a-booking-department.png',
  '06b-booking-doctor.png',
  '06c-booking-slots.png',
  '06d-booking-confirm.png',
  '06e-booking-success.png',
  '07-waitlist.png',
  '08-doctor-dashboard.png',
  '09a-admin-analytics.png',
  '09b-admin-departments.png',
  '09c-admin-doctors.png',
  '09d-admin-appointments.png',
];

async function loginApi(role) {
  const account = ACCOUNTS[role];
  const res = await fetch(`${API}${account.path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: account.email,
      password: account.password,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      `Login failed for ${role} (${account.email}): ${data.error || res.status}`,
    );
  }
  if (!data.token || !data.user) {
    throw new Error(`Login response missing token/user for ${role}`);
  }
  return data;
}

async function setAuth(page, auth) {
  await page.addInitScript((payload) => {
    localStorage.setItem('healio_auth', JSON.stringify(payload));
  }, { token: auth.token, user: auth.user });
}

async function clearAuth(context) {
  await context.clearCookies();
  // New page without init script auth
}

/** Wait until no visible “Loading…” / spinner-style muted copy remains. */
async function waitUntilLoaded(page, { timeout = 20000 } = {}) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(
    () => {
      const texts = [
        'Loading',
        'Loading…',
        'Loading...',
        'Loading departments…',
        'Loading doctors…',
        'Loading open slots…',
        'Loading appointments…',
        'Loading waitlist…',
        'Confirming…',
        'Signing in…',
      ];
      const nodes = document.querySelectorAll('p, span, div, button');
      for (const el of nodes) {
        if (!el.offsetParent && el.tagName !== 'BODY') continue;
        const t = (el.textContent || '').trim();
        if (!t) continue;
        if (texts.some((x) => t === x || t.startsWith('Loading'))) {
          // Ignore tiny hidden nodes
          const style = window.getComputedStyle(el);
          if (style.display === 'none' || style.visibility === 'hidden') continue;
          if (el.getClientRects().length === 0) continue;
          return false;
        }
      }
      return true;
    },
    { timeout },
  );
  // Settle layout / fonts / late paint
  await page.waitForTimeout(500);
}

async function shot(page, name) {
  const file = path.join(OUT_DIR, name);
  await page.screenshot({ path: file, type: 'png', fullPage: false });
  const size = fs.statSync(file).size;
  console.log(`  ✓ ${name} (${size} bytes)`);
  return file;
}

async function shotSection(page, sectionSelector, name) {
  const loc = page.locator(sectionSelector).first();
  await loc.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  const file = path.join(OUT_DIR, name);
  await loc.screenshot({ path: file, type: 'png' });
  const size = fs.statSync(file).size;
  console.log(`  ✓ ${name} (${size} bytes)`);
  return file;
}

async function withFreshPage(browser, auth, fn) {
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  if (auth) {
    await setAuth(page, auth);
  }
  try {
    await fn(page);
  } finally {
    await context.close();
  }
}

async function captureBookingFlow(page) {
  await page.goto(`${BASE}/book`, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: /Choose a department/i }).waitFor({
    timeout: 15000,
  });
  await waitUntilLoaded(page);
  await page.locator('.book-select-card').first().waitFor({ state: 'visible' });
  await shot(page, '06a-booking-department.png');

  await page.locator('.book-select-card').first().click();
  await page.getByRole('heading', { name: /Choose a doctor/i }).waitFor();
  await waitUntilLoaded(page);
  await page.locator('.book-select-card').first().waitFor({ state: 'visible' });
  await shot(page, '06b-booking-doctor.png');

  await page.locator('.book-select-card').first().click();
  await page.getByRole('heading', { name: /Pick a date and time/i }).waitFor();
  await waitUntilLoaded(page);

  // Walk dates until an open slot appears (seed may fill today for some doctors)
  const dateChips = page.locator('.book-chip-row').first().locator('.book-chip');
  const dateCount = await dateChips.count();
  let foundSlot = false;
  for (let i = 0; i < dateCount; i++) {
    await dateChips.nth(i).click();
    await page.waitForTimeout(200);
    await waitUntilLoaded(page);
    const slotRow = page.locator('.book-field-block').filter({
      has: page.locator('#slot-label'),
    });
    const slots = slotRow.locator('.book-chip');
    if ((await slots.count()) > 0) {
      foundSlot = true;
      await shot(page, '06c-booking-slots.png');
      await slots.first().click();
      await page.getByRole('button', { name: /^Continue$/i }).click();
      break;
    }
  }
  if (!foundSlot) {
    throw new Error(
      'No open booking slots found across available dates — re-seed and retry',
    );
  }

  await page.getByRole('heading', { name: /Confirm booking/i }).waitFor();
  await waitUntilLoaded(page);
  await page.locator('.book-summary-card').waitFor({ state: 'visible' });
  await shot(page, '06d-booking-confirm.png');

  await page.getByRole('button', { name: /^Confirm booking$/i }).click();
  await page.getByRole('heading', { name: /Appointment confirmed/i }).waitFor({
    timeout: 20000,
  });
  await waitUntilLoaded(page);
  await shot(page, '06e-booking-success.png');
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  // Clear previous run so missing files are obvious
  for (const name of EXPECTED) {
    const p = path.join(OUT_DIR, name);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }

  console.log(`Healio screenshots → ${OUT_DIR}`);
  console.log(`Base UI: ${BASE}  API: ${API}\n`);

  // Health checks
  for (const [label, url] of [
    ['UI', BASE],
    ['API', `${API}/api/departments`],
  ]) {
    try {
      const res = await fetch(url);
      if (!res.ok && label === 'API') {
        throw new Error(`HTTP ${res.status}`);
      }
      console.log(`  ${label} reachable`);
    } catch (err) {
      throw new Error(
        `${label} not reachable at ${url}: ${err.message}. Start backend + frontend first.`,
      );
    }
  }

  const patient = await loginApi('patient');
  const waitlistUser = await loginApi('waitlist');
  const doctor = await loginApi('doctor');
  const admin = await loginApi('admin');
  console.log('  Demo logins OK\n');

  const browser = await chromium.launch({
    headless: true,
    channel: process.env.HEALIO_CHROME_CHANNEL || undefined,
  });

  try {
    // 1–4 Public auth screens (no session)
    await withFreshPage(browser, null, async (page) => {
      console.log('Public pages');
      await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
      await waitUntilLoaded(page);
      await shot(page, '01-landing.png');

      await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
      await waitUntilLoaded(page);
      // Prefer split brand panel image to settle
      await page.waitForTimeout(800);
      await shot(page, '02-login.png');

      await page.goto(`${BASE}/register`, { waitUntil: 'networkidle' });
      await waitUntilLoaded(page);
      await shot(page, '03-register.png');

      await page.goto(`${BASE}/staff/login`, { waitUntil: 'networkidle' });
      await waitUntilLoaded(page);
      await shot(page, '04-staff-login.png');
    });

    // 5 Home (patient) — route is /home (logged-in app home)
    await withFreshPage(browser, patient, async (page) => {
      console.log('Patient home');
      await page.goto(`${BASE}/home`, { waitUntil: 'networkidle' });
      await page.getByRole('heading', { name: /Hello|Welcome|Hi/i }).waitFor({
        timeout: 15000,
      }).catch(() => {});
      await waitUntilLoaded(page);
      await page.locator('.home-dept-grid, .home-empty, .home-appt-list').first().waitFor({
        state: 'visible',
        timeout: 15000,
      });
      await shot(page, '05-home.png');
    });

    // 6 Booking flow
    await withFreshPage(browser, patient, async (page) => {
      console.log('Booking flow');
      await captureBookingFlow(page);
    });

    // 7 Waitlist (notified entry)
    await withFreshPage(browser, waitlistUser, async (page) => {
      console.log('Waitlist');
      await page.goto(`${BASE}/waitlist`, { waitUntil: 'networkidle' });
      await page.getByRole('heading', { name: /My waitlist/i }).waitFor();
      await waitUntilLoaded(page);
      await page.locator('.wait-card, .wait-empty').first().waitFor({
        state: 'visible',
        timeout: 15000,
      });
      // Prefer a notified card in view
      const notified = page.locator('.wait-status--notified').first();
      if (await notified.count()) {
        await notified.scrollIntoViewIfNeeded();
        await page.waitForTimeout(300);
      } else {
        console.warn(
          '  ! No notified waitlist status found — seed may be stale',
        );
      }
      await shot(page, '07-waitlist.png');
    });

    // 8 Doctor dashboard (risk badge for Chidi)
    await withFreshPage(browser, doctor, async (page) => {
      console.log('Doctor dashboard');
      await page.goto(`${BASE}/doctor`, { waitUntil: 'networkidle' });
      await page.getByRole('heading', { name: /Today/i }).waitFor();
      await waitUntilLoaded(page);
      await page.locator('.doc-appt-card, .doc-empty').first().waitFor({
        state: 'visible',
        timeout: 15000,
      });
      const risk = page.locator('.doc-risk').first();
      if (await risk.count()) {
        await risk.scrollIntoViewIfNeeded();
        await page.waitForTimeout(300);
      } else {
        console.warn('  ! No risk badge visible — expected for Chidi Nwosu');
      }
      // Also ensure Chidi is mentioned if present
      const chidi = page.getByText(/Chidi\s+Nwosu/i).first();
      if (await chidi.count()) {
        await chidi.scrollIntoViewIfNeeded();
        await page.waitForTimeout(200);
      }
      await shot(page, '08-doctor-dashboard.png');
    });

    // 9 Admin sections
    await withFreshPage(browser, admin, async (page) => {
      console.log('Admin dashboard');
      await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' });
      await page.getByRole('heading', { name: /Clinic admin/i }).waitFor();
      await waitUntilLoaded(page);
      await page.locator('.admin-stats').waitFor({ state: 'visible' });

      await shotSection(
        page,
        'section[aria-labelledby="admin-analytics-heading"]',
        '09a-admin-analytics.png',
      );
      await shotSection(
        page,
        'section[aria-labelledby="admin-depts-heading"]',
        '09b-admin-departments.png',
      );
      await shotSection(
        page,
        'section[aria-labelledby="admin-doctors-heading"]',
        '09c-admin-doctors.png',
      );
      await waitUntilLoaded(page);
      await page.locator('.admin-table, .admin-appt-cards, .admin-empty').first().waitFor({
        state: 'visible',
        timeout: 20000,
      });
      await shotSection(
        page,
        'section[aria-labelledby="admin-appts-heading"]',
        '09d-admin-appointments.png',
      );
    });
  } finally {
    await browser.close();
  }

  console.log('\nVerifying output…');
  const missing = [];
  const ok = [];
  for (const name of EXPECTED) {
    const p = path.join(OUT_DIR, name);
    if (!fs.existsSync(p) || fs.statSync(p).size < 1000) {
      missing.push(name);
    } else {
      ok.push(name);
    }
  }

  console.log(`Captured ${ok.length}/${EXPECTED.length} screenshots.`);
  if (missing.length) {
    console.error('Missing or too small:\n  ' + missing.join('\n  '));
    process.exit(1);
  }
  console.log('All screenshots captured successfully.');
}

main().catch((err) => {
  console.error('\nScreenshot capture failed:', err.message);
  console.error(err);
  process.exit(1);
});
