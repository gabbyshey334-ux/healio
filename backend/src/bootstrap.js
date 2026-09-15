/**
 * One-time cloud bootstrap: create Postgres schema + seed demo data
 * when the departments table is empty / missing.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool, { isPostgres } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let bootstrapped = false;
let bootstrapping = null;

export async function ensureCloudBootstrap() {
  if (!isPostgres) return;
  if (bootstrapped) return;
  if (bootstrapping) return bootstrapping;

  bootstrapping = (async () => {
    try {
      let needsSchema = false;
      try {
        const [rows] = await pool.query(
          `SELECT COUNT(*)::int AS count FROM departments`,
        );
        if (rows[0]?.count > 0) {
          console.log('[bootstrap] Schema already seeded');
          bootstrapped = true;
          return;
        }
      } catch {
        needsSchema = true;
      }

      if (needsSchema) {
        const schemaPath = path.resolve(__dirname, '../sql/schema.postgres.sql');
        const sql = fs.readFileSync(schemaPath, 'utf8');
        const statements = sql
          .split(/;\s*\n/)
          .map((s) => s.trim())
          .filter((s) => s.length > 0 && !s.startsWith('--'));

        console.log(
          `[bootstrap] Applying ${statements.length} schema statements…`,
        );
        for (const stmt of statements) {
          await pool.query(stmt);
        }
      }

      const [after] = await pool.query(
        `SELECT COUNT(*)::int AS count FROM departments`,
      );
      if ((after[0]?.count || 0) === 0) {
        console.log('[bootstrap] Seeding demo data…');
        const { seedForCloud } = await import('../scripts/seed.js');
        await seedForCloud();
      } else {
        console.log('[bootstrap] Tables ready');
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
