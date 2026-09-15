/**
 * Healio DB pool — MySQL locally, Neon Postgres on Vercel.
 *
 * Uses DATABASE_URL / POSTGRES_URL when present (postgres://…).
 * Otherwise falls back to classic MySQL env vars (DB_* / TIDB_*).
 *
 * Exposes a mysql2-compatible surface: query(), getConnection(),
 * beginTransaction/commit/rollback, and insertId on INSERT results.
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

const connectionString =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_PRISMA_URL;

export const isPostgres = Boolean(
  connectionString && /^postgres(ql)?:\/\//i.test(connectionString),
);

function toPgPlaceholders(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

function wrapPgClient(client) {
  return {
    async query(sql, params = []) {
      let text = toPgPlaceholders(sql);
      const isInsert = /^\s*INSERT\s+/i.test(sql) && !/\bRETURNING\b/i.test(sql);
      if (isInsert) {
        text = `${text.replace(/\s*;?\s*$/, '')} RETURNING id`;
      }
      const result = await client.query(text, params);
      if (isInsert) {
        return [
          {
            insertId: result.rows[0]?.id,
            affectedRows: result.rowCount,
            rowCount: result.rowCount,
          },
        ];
      }
      return [result.rows];
    },
    async beginTransaction() {
      await client.query('BEGIN');
    },
    async commit() {
      await client.query('COMMIT');
    },
    async rollback() {
      await client.query('ROLLBACK');
    },
    release() {
      client.release?.();
    },
  };
}

async function createPostgresPool() {
  const { Pool, neonConfig } = await import('@neondatabase/serverless');
  const ws = (await import('ws')).default;
  neonConfig.webSocketConstructor = ws;

  const pool = new Pool({ connectionString });

  return {
    async query(sql, params = []) {
      return wrapPgClient(pool).query(sql, params);
    },
    async getConnection() {
      const client = await pool.connect();
      return wrapPgClient(client);
    },
    async end() {
      await pool.end();
    },
  };
}

function createMysqlPool() {
  // Lazy sync import via createRequire-style dynamic — keep mysql2 for local
  return import('mysql2/promise').then((mysql) => {
    const user = process.env.TIDB_USER || process.env.DB_USER;
    const password = process.env.TIDB_PASSWORD ?? process.env.DB_PASSWORD ?? '';
    const database = process.env.TIDB_DATABASE || process.env.DB_NAME;
    const host = process.env.TIDB_HOST || process.env.DB_HOST || '127.0.0.1';
    const port = Number(process.env.TIDB_PORT || process.env.DB_PORT || 3306);

    const config = {
      user,
      password,
      database,
      waitForConnections: true,
      connectionLimit: 5,
      enableKeepAlive: true,
    };

    if (process.env.DB_SOCKET && !process.env.TIDB_HOST) {
      config.socketPath = process.env.DB_SOCKET;
    } else {
      config.host = host;
      config.port = port;
    }

    if (
      process.env.DB_SSL === 'true' ||
      process.env.TIDB_HOST ||
      String(host).includes('tidbcloud.com')
    ) {
      config.ssl = { rejectUnauthorized: true };
    }

    if (!user || !database) {
      console.warn('[database] Missing DB user or database name');
    }

    return mysql.createPool(config);
  });
}

const pool = isPostgres
  ? await createPostgresPool()
  : await createMysqlPool();

if (isPostgres) {
  console.log('[database] Using Neon/Postgres');
} else {
  console.log('[database] Using MySQL');
}

export default pool;
