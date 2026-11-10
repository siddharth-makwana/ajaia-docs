import express from 'express';
import cookieParser from 'cookie-parser';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import TurndownService from 'turndown';
import { requireAuth, signToken, verifyPassword, setSessionCookie, clearSessionCookie } from './auth.js';
import { createDocumentService, HttpError } from './documents.js';
import { fileToDocument, MAX_UPLOAD_BYTES } from './importers.js';

export function createApp({ db, secret, staticDir, secureCookies = false }) {
  const app = express();
  const docs = createDocumentService(db);
  const auth = requireAuth(db, secret);
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } });
  const turndown = new TurndownService({ headingStyle: 'atx', bulletListMarker: '-' });

  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  // Wrap handlers so thrown/async errors reach the error middleware.
  const h = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

  app.get('/api/health', (_req, res) => res.json({ ok: true }));

  // ---- Auth -------------------------------------------------------------
  app.post('/api/auth/login', h((req, res) => {
    const { email, password } = req.body ?? {};
    if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
      throw new HttpError(400, 'Email and password are required');
    }
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.trim());
    if (!user || !verifyPassword(password, user.password_hash)) {
      throw new HttpError(401, 'Incorrect email or password');
    }
    setSessionCookie(res, signToken(user.id, secret), secureCookies);
    res.json({ user: { id: user.id, email: user.email, name: user.name } });
  }));

  app.post('/api/auth/logout', (_req, res) => {
    clearSessionCookie(res);
    res.status(204).end();
  });

  app.get('/api/auth/me', auth, (req, res) => res.json({ user: req.user }));

  app.get('/api/users', auth, (req, res) => {
    res.json({ users: db.prepare('SELECT id, name, email FROM users WHERE id != ? ORDER BY name').all(req.user.id) });
  });

  // ---- Documents --------------------------------------------------------
  app.get('/api/documents', auth, (req, res) => res.json(docs.list(req.user.id)));

  app.post('/api/documents', auth, h((req, res) => {
    res.status(201).json({ document: docs.create(req.user.id, req.body ?? {}) });
  }));

  app.post('/api/documents/import', auth, upload.single('file'), h(async (req, res) => {
    if (!req.file) throw new HttpError(400, 'Attach a file in the "file" field');
    const parsed = await fileToDocument(req.file.originalname, req.file.buffer);
    res.status(201).json({ document: docs.create(req.user.id, parsed) });
  }));

  app.get('/api/documents/:id', auth, h((req, res) => {
    res.json({ document: docs.get(req.params.id, req.user.id) });
  }));

  app.patch('/api/documents/:id', auth, h((req, res) => {
    res.json({ document: docs.update(req.params.id, req.user.id, req.body ?? {}) });
  }));

  app.delete('/api/documents/:id', auth, h((req, res) => {
    docs.remove(req.params.id, req.user.id);
    res.status(204).end();
  }));

  app.get('/api/documents/:id/export', auth, h((req, res) => {
    const doc = docs.get(req.params.id, req.user.id);
    const format = req.query.format === 'html' ? 'html' : 'md';
    const safeName = doc.title.replace(/[^\w\- ]+/g, '').trim() || 'document';
    const body = format === 'md'
      ? `# ${doc.title}\n\n${turndown.turndown(doc.content || '')}\n`
      : `<!doctype html><meta charset="utf-8"><title>${safeName}</title>${doc.content}`;
    res.setHeader('Content-Type', format === 'md' ? 'text/markdown; charset=utf-8' : 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}.${format}"`);
    res.send(body);
  }));

  // ---- Sharing ----------------------------------------------------------
  app.get('/api/documents/:id/shares', auth, h((req, res) => {
    res.json({ shares: docs.listShares(req.params.id, req.user.id) });
  }));

  app.post('/api/documents/:id/shares', auth, h((req, res) => {
    res.json({ shares: docs.share(req.params.id, req.user.id, req.body ?? {}) });
  }));

  app.delete('/api/documents/:id/shares/:userId', auth, h((req, res) => {
    res.json({ shares: docs.unshare(req.params.id, req.user.id, req.params.userId) });
  }));

  app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

  // ---- Frontend (production build) --------------------------------------
  if (staticDir && fs.existsSync(staticDir)) {
    app.use(express.static(staticDir, { index: false }));
    app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(staticDir, 'index.html')));
  }

  // ---- Errors -----------------------------------------------------------
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err instanceof multer.MulterError) {
      const tooBig = err.code === 'LIMIT_FILE_SIZE';
      return res.status(tooBig ? 413 : 400).json({
        error: tooBig ? `File is too large (max ${MAX_UPLOAD_BYTES / 1024 / 1024} MB)` : err.message,
      });
    }
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON body' });
    if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Request is too large' });
    const status = err.status && err.status < 600 ? err.status : 500;
    if (status >= 500) console.error(err);
    res.status(status).json({ error: status >= 500 ? 'Something went wrong' : err.message, ...(err.extra ?? {}) });
  });

  return app;
}
