/**
 * Run SQL migrations against the Healio MySQL database.
 * Usage: npm run migrate (from backend/)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(__dirname, '../../database/migrations');

async function migrate() {
  const { DB_HOST, DB_PORT, DB_USER, DB_PASSWORD } = process.env;

  if (!DB_USER) {
    throw new Error('DB_USER is required in backend/.env');
  }

  // Connect without DB_NAME so CREATE DATABASE can run
  const config = {
    user: DB_USER,
    password: DB_PASSWORD || '',
    multipleStatements: true,
  };

  if (process.env.DB_SOCKET) {
    config.socketPath = process.env.DB_SOCKET;
  } else {
    config.host = DB_HOST || '127.0.0.1';
    config.port = Number(DB_PORT) || 3306;
  }

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
