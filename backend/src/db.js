/**
 * Healio MySQL pool — credentials from env only.
 *
 * Supports:
 * - Local: DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME [, DB_SOCKET]
 * - TiDB Cloud / Marketplace: TIDB_HOST, TIDB_PORT, TIDB_USER, TIDB_PASSWORD, TIDB_DATABASE
 * - URL form: DATABASE_URL=mysql://user:pass@host:port/db
 */

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') }); // backend/.env
dotenv.config({ path: path.resolve(__dirname, '../../.env') }); // repo root
dotenv.config();

function configFromDatabaseUrl(urlString) {
  const url = new URL(urlString);
  if (url.protocol !== 'mysql:' && url.protocol !== 'mysql2:') {
    throw new Error('DATABASE_URL must use mysql://');
  }
  return {
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    host: url.hostname,
    port: Number(url.port) || 3306,
    database: url.pathname.replace(/^\//, '') || undefined,
  };
}

function buildPoolConfig() {
  if (process.env.DATABASE_URL) {
    return configFromDatabaseUrl(process.env.DATABASE_URL);
  }

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

  const needsSsl =
    process.env.DB_SSL === 'true' ||
    process.env.DB_SSL === '1' ||
    Boolean(process.env.TIDB_HOST) ||
    (typeof host === 'string' &&
      (host.includes('tidbcloud.com') ||
        host.includes('psdb.cloud') ||
        host.endsWith('.railway.app')));

  if (needsSsl) {
    config.ssl = { rejectUnauthorized: true };
  }

  return config;
}

const poolConfig = buildPoolConfig();

if (!poolConfig.user || !poolConfig.database) {
  console.warn(
    '[database] Missing DB user or database name (set DB_* , TIDB_* , or DATABASE_URL)',
  );
}

const pool = mysql.createPool(poolConfig);

export default pool;
