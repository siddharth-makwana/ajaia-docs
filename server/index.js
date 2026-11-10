import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { openDb } from './db.js';
import { seed } from './seed.js';
import { createApp } from './app.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT) || 3001;
const DB_PATH = process.env.DATABASE_PATH || path.join(root, 'data', 'ajaia.db');
const isProd = process.env.NODE_ENV === 'production';

let secret = process.env.SESSION_SECRET;
if (!secret) {
  if (isProd) console.warn('SESSION_SECRET not set — using a random secret (sessions reset on restart).');
  secret = isProd ? crypto.randomBytes(32).toString('hex') : 'dev-only-secret';
}

const db = openDb(DB_PATH);
if (seed(db)) console.log('Seeded demo users (password: password123)');

const app = createApp({
  db,
  secret,
  staticDir: path.join(root, 'client', 'dist'),
  secureCookies: isProd,
});
if (isProd) app.set('trust proxy', 1);

app.listen(PORT, () => console.log(`Ajaia Docs listening on http://localhost:${PORT} (db: ${DB_PATH})`));
