/**
 * Shared Unsplash visuals for auth split panels.
 * One patient image (Login + Register) and one staff image — fixed IDs so
 * the browser caches them and the experience stays cohesive.
 *
 * Sized via images.unsplash.com (w=1400, q=72) — enough for a ~55% panel,
 * not full-resolution originals.
 */

const PATIENT_PHOTO_ID = 'photo-1629909614456-6b1c5c94cecc';
const STAFF_PHOTO_ID = 'photo-1519494026892-80bbd2d6fd0d';

function unsplashUrl(photoId) {
  return `https://images.unsplash.com/${photoId}?auto=format&fit=crop&w=1400&q=72`;
}

export const AUTH_VISUALS = {
  patient: {
    imageUrl: unsplashUrl(PATIENT_PHOTO_ID),
    imageAlt: 'Calm clinic waiting area with natural light',
    line: 'Skip the queue. Book your clinic visit in under a minute.',
    meta: 'Federal Polytechnic Ilaro Medical Clinic',
  },
  staff: {
    imageUrl: unsplashUrl(STAFF_PHOTO_ID),
    imageAlt: 'Quiet clinic reception desk and hallway',
    line: 'Manage today’s appointments. Keep the clinic moving.',
    meta: 'Doctors and admins — campus medical clinic',
  },
};
