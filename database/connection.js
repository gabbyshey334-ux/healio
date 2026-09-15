/**
 * Healio — MySQL connection config
 * Credentials come from environment variables only (never hardcode).
 *
 * Load a .env file before requiring this module (backend does via dotenv).
 * Expected variables: DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME
 * Optional: DB_SOCKET (Unix socket path — preferred when set)
 */

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Prefer backend/.env when this module is used from the API server
dotenv.config({ path: path.resolve(__dirname, '../backend/.env') });
dotenv.config(); // also allow a local database/.env if present

const required = ['DB_USER', 'DB_NAME'];
for (const key of required) {
  if (!process.env[key]) {
    console.warn(`[database] Missing env var: ${key}`);
  }
}

const poolConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
};

if (process.env.DB_SOCKET) {
  poolConfig.socketPath = process.env.DB_SOCKET;
} else {
  poolConfig.host = process.env.DB_HOST || 'localhost';
  poolConfig.port = Number(process.env.DB_PORT) || 3306;
}

/** Shared connection pool — import this from the backend when you add queries */
const pool = mysql.createPool(poolConfig);

export default pool;
