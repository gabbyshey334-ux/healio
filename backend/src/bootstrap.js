/**
 * One-time cloud bootstrap: create Postgres schema + seed demo data
 * when demo patients are missing.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool, { isPostgres } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let bootstrapped = false;
let bootstrapping = null;

async function applySchema() {
  const schemaPath = path.resolve(__dirname, '../sql/schema.postgres.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');
  const statements = sql
    .split(/;\s*\n/)
    .map((s) =>
      s
        .split('\n')
        .filter((line) => !/^\s*--/.test(line))
        .join('\n')
        .trim(),
    )
    .filter((s) => s.length > 0);

  console.log(`[bootstrap] Applying ${statements.length} schema statements…`);
  for (const stmt of statements) {
    await pool.query(stmt);
  }
}

export async function ensureCloudBootstrap() {
  if (!isPostgres) return;
  if (bootstrapped) return;
  if (bootstrapping) return bootstrapping;

  bootstrapping = (async () => {
    try {
      // Always idempotent CREATE IF NOT EXISTS for missing tables
      await applySchema();

      let patientCount = 0;
      try {
        const [rows] = await pool.query(
          `SELECT COUNT(*)::int AS count FROM patients`,
        );
        patientCount = rows[0]?.count || 0;
      } catch {
        patientCount = 0;
      }

      if (patientCount === 0) {
        console.log('[bootstrap] Seeding demo data…');
        const { seedForCloud } = await import('../scripts/seed.js');
        await seedForCloud();
      } else {
        console.log('[bootstrap] Demo data already present');
      }
      bootstrapped = true;
    } catch (err) {
      console.error('[bootstrap] Failed:', err.message || err);
      bootstrapping = null;
      throw err;
    }
  })();

  return bootstrapping;
}
