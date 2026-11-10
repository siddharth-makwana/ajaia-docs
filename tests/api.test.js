import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { openDb } from '../server/db.js';
import { seed, DEMO_PASSWORD } from '../server/seed.js';
import { createApp } from '../server/app.js';

let app;

async function login(email) {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/login').send({ email, password: DEMO_PASSWORD });
  expect(res.status).toBe(200);
  return agent;
}

beforeEach(() => {
  const db = openDb(':memory:');
  seed(db);
  app = createApp({ db, secret: 'test-secret' });
});

describe('auth', () => {
  it('rejects bad credentials and unauthenticated requests', async () => {
    const bad = await request(app).post('/api/auth/login').send({ email: 'alice@ajaia.dev', password: 'nope' });
    expect(bad.status).toBe(401);
    expect((await request(app).get('/api/documents')).status).toBe(401);
  });

  it('rejects a tampered session cookie', async () => {
    const res = await request(app).get('/api/documents').set('Cookie', 'sid=someone.9999999999999.forged');
    expect(res.status).toBe(401);
  });
});

describe('documents', () => {
  it('creates, renames, edits and reopens a document with formatting preserved', async () => {
    const alice = await login('alice@ajaia.dev');
    const created = await alice.post('/api/documents').send({ title: 'Plan' });
    expect(created.status).toBe(201);
    const { id, version } = created.body.document;

    const html = '<h2>Goals</h2><p><strong>Ship</strong> <em>it</em> <u>now</u></p><ul><li>one</li></ul><ol><li>two</li></ol>';
    const saved = await alice.patch(`/api/documents/${id}`).send({ title: 'Q3 Plan', content: html, version });
    expect(saved.status).toBe(200);
    expect(saved.body.document.version).toBe(version + 1);

    const reopened = await alice.get(`/api/documents/${id}`);
    expect(reopened.body.document.title).toBe('Q3 Plan');
    expect(reopened.body.document.content).toBe(html);
  });

  it('strips script and event-handler HTML before saving', async () => {
    const alice = await login('alice@ajaia.dev');
    const { body } = await alice.post('/api/documents').send({
      title: 'XSS', content: '<p onclick="steal()">hi</p><script>alert(1)</script><img src=x onerror=alert(1)>',
    });
    expect(body.document.content).toBe('<p>hi</p>');
  });

  it('validates titles', async () => {
    const alice = await login('alice@ajaia.dev');
    expect((await alice.post('/api/documents').send({ title: '   ' })).status).toBe(400);
    expect((await alice.post('/api/documents').send({ title: 'x'.repeat(201) })).status).toBe(400);
  });

  it('rejects a stale save with 409 instead of overwriting newer work', async () => {
    const alice = await login('alice@ajaia.dev');
    const { body } = await alice.post('/api/documents').send({ title: 'Race' });
    const { id, version } = body.document;
    await alice.patch(`/api/documents/${id}`).send({ content: '<p>first</p>', version });
    const stale = await alice.patch(`/api/documents/${id}`).send({ content: '<p>second</p>', version });
    expect(stale.status).toBe(409);
    expect(stale.body.document.content).toBe('<p>first</p>');
  });
});

describe('sharing and access control', () => {
  it('separates owned and shared documents and enforces roles', async () => {
    const alice = await login('alice@ajaia.dev');
    const carol = await login('carol@ajaia.dev');

    const { body } = await alice.post('/api/documents').send({ title: 'Secret roadmap' });
    const { id } = body.document;

    // Not shared yet: Carol cannot see it, and it is not leaked as 403.
    expect((await carol.get(`/api/documents/${id}`)).status).toBe(404);

    // Share as viewer.
    const shared = await alice.post(`/api/documents/${id}/shares`).send({ email: 'carol@ajaia.dev', role: 'viewer' });
    expect(shared.status).toBe(200);

    const carolList = (await carol.get('/api/documents')).body;
    expect(carolList.owned.map((d) => d.title)).not.toContain('Secret roadmap');
    expect(carolList.shared).toEqual(
      expect.arrayContaining([expect.objectContaining({ id, role: 'viewer', owner_name: 'Alice Chen' })]),
    );

    const doc = (await carol.get(`/api/documents/${id}`)).body.document;
    expect(doc.role).toBe('viewer');
    expect((await carol.patch(`/api/documents/${id}`).send({ content: '<p>x</p>', version: doc.version })).status).toBe(403);
    // Viewers cannot re-share or delete.
    expect((await carol.post(`/api/documents/${id}/shares`).send({ email: 'bob@ajaia.dev' })).status).toBe(403);
    expect((await carol.delete(`/api/documents/${id}`)).status).toBe(403);

    // Upgrade to editor: now Carol can save.
    await alice.post(`/api/documents/${id}/shares`).send({ email: 'carol@ajaia.dev', role: 'editor' });
    expect((await carol.patch(`/api/documents/${id}`).send({ content: '<p>edit</p>', version: doc.version })).status).toBe(200);

    // Revoke: access disappears.
    const carolId = (await carol.get('/api/auth/me')).body.user.id;
    await alice.delete(`/api/documents/${id}/shares/${carolId}`);
    expect((await carol.get(`/api/documents/${id}`)).status).toBe(404);
  });

  it('returns a clear error when sharing with an unknown email', async () => {
    const alice = await login('alice@ajaia.dev');
    const { body } = await alice.post('/api/documents').send({ title: 'Doc' });
    const res = await alice.post(`/api/documents/${body.document.id}/shares`).send({ email: 'nobody@x.com' });
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/No user/);
  });
});

describe('file import', () => {
  it('turns a markdown file into a new editable document', async () => {
    const alice = await login('alice@ajaia.dev');
    const res = await alice
      .post('/api/documents/import')
      .attach('file', Buffer.from('# Notes\n\nSome **bold** text\n\n- a\n- b\n'), 'meeting-notes.md');
    expect(res.status).toBe(201);
    expect(res.body.document.title).toBe('meeting-notes');
    expect(res.body.document.content).toContain('<h1>Notes</h1>');
    expect(res.body.document.content).toContain('<strong>bold</strong>');
    expect(res.body.document.content).toContain('<li>a</li>');
  });

  it('escapes HTML in plain-text uploads', async () => {
    const alice = await login('alice@ajaia.dev');
    const res = await alice.post('/api/documents/import').attach('file', Buffer.from('a <b>c\n\nnext'), 'x.txt');
    expect(res.body.document.content).toBe('<p>a &lt;b&gt;c</p><p>next</p>');
  });

  it('rejects unsupported file types', async () => {
    const alice = await login('alice@ajaia.dev');
    const res = await alice.post('/api/documents/import').attach('file', Buffer.from('%PDF'), 'report.pdf');
    expect(res.status).toBe(415);
    expect(res.body.error).toMatch(/Supported/);
  });
});

describe('docx import', () => {
  it('converts a Word document, keeping headings, bold and lists', async () => {
    const fs = await import('node:fs');
    const alice = await login('alice@ajaia.dev');
    const res = await alice.post('/api/documents/import')
      .attach('file', fs.readFileSync(new URL('./fixtures/sample.docx', import.meta.url)), 'Quarterly Review.docx');
    expect(res.status).toBe(201);
    expect(res.body.document.title).toBe('Quarterly Review');
    expect(res.body.document.content).toContain('<h1>Quarterly Review</h1>');
    expect(res.body.document.content).toContain('<strong>12%</strong>');
    expect(res.body.document.content).toContain('<li>Hire two engineers</li>');
  });
});
