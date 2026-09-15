/**
 * Run SQL migrations against the Healio MySQL database.
 * Usage: npm run migrate (from backend/)
 *
 * Works with local MySQL, TiDB Cloud (TIDB_*), or DATABASE_URL=mysql://...
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(__dirname, '../../database/migrations');

function connectionConfig() {
  if (process.env.DATABASE_URL) {
    const url = new URL(process.env.DATABASE_URL);
    return {
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      host: url.hostname,
      port: Number(url.port) || 3306,
      multipleStatements: true,
      ssl: { rejectUnauthorized: true },
    };
  }

  const user = process.env.TIDB_USER || process.env.DB_USER;
  const password = process.env.TIDB_PASSWORD ?? process.env.DB_PASSWORD ?? '';
  const host = process.env.TIDB_HOST || process.env.DB_HOST || '127.0.0.1';
  const port = Number(process.env.TIDB_PORT || process.env.DB_PORT || 3306);

  if (!user) {
    throw new Error('DB_USER or TIDB_USER (or DATABASE_URL) is required');
  }

  const config = {
    user,
    password,
    multipleStatements: true,
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

  return config;
}

async function migrate() {
  const config = connectionConfig();
  const connection = await mysql.createConnection(config);

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    console.log('No migration files found.');
    await connection.end();
    return;
  }

  for (const file of files) {
    const fullPath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(fullPath, 'utf8');
    console.log(`Running ${file}...`);
    await connection.query(sql);
    console.log(`  OK — ${file}`);
  }

  await connection.end();
  console.log('Migrations complete.');
}

migrate().catch((err) => {
  console.error('Migration failed:', err.message || err);
  if (err.code) console.error('Code:', err.code);
  process.exit(1);
});
