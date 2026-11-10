import crypto from 'node:crypto';
import { hashPassword } from './auth.js';
import { transaction } from './db.js';

export const DEMO_PASSWORD = 'password123';
export const DEMO_USERS = [
  { email: 'alice@ajaia.dev', name: 'Alice Chen' },
  { email: 'bob@ajaia.dev', name: 'Bob Patel' },
  { email: 'carol@ajaia.dev', name: 'Carol Diaz' },
];

const WELCOME = `
<h1>Welcome to Ajaia Docs</h1>
<p>This document is owned by <strong>Alice</strong> and shared with <em>Bob</em> as an editor.</p>
<h2>Try these</h2>
<ul>
  <li>Format text with <strong>bold</strong>, <em>italic</em> and <u>underline</u></li>
  <li>Pick a heading from the <strong>Normal text</strong> menu in the toolbar</li>
  <li>Click <strong>Share</strong> to give Carol view-only access</li>
</ul>
<ol><li>Edits autosave after you stop typing</li><li>Refresh the page — everything is still here</li></ol>`;

/** Idempotent: only seeds when there are no users yet. */
export function seed(db) {
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM users').get();
  if (n > 0) return false;
  const insertUser = db.prepare('INSERT INTO users (id, email, name, password_hash) VALUES (?, ?, ?, ?)');
  const ids = {};
  transaction(db, () => {
    for (const u of DEMO_USERS) {
      ids[u.email] = crypto.randomUUID();
      insertUser.run(ids[u.email], u.email, u.name, hashPassword(DEMO_PASSWORD));
    }
    const docId = crypto.randomUUID();
    db.prepare('INSERT INTO documents (id, owner_id, title, content) VALUES (?, ?, ?, ?)')
      .run(docId, ids['alice@ajaia.dev'], 'Welcome to Ajaia Docs', WELCOME.trim());
    db.prepare('INSERT INTO document_shares (document_id, user_id, role) VALUES (?, ?, ?)')
      .run(docId, ids['bob@ajaia.dev'], 'editor');
    db.prepare('INSERT INTO documents (id, owner_id, title, content) VALUES (?, ?, ?, ?)')
      .run(crypto.randomUUID(), ids['bob@ajaia.dev'], "Bob's private notes", '<p>Only Bob can see this until he shares it.</p>');
  });
  return true;
}
