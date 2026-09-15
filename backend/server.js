/**
 * Healio — Express API entry point
 * Federal Polytechnic Ilaro Medical Clinic appointment booking system
 */

import dotenv from 'dotenv';
import app from './src/app.js';

dotenv.config();

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Healio API listening on http://localhost:${PORT}`);
});
