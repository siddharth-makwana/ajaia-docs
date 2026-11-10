import crypto from 'node:crypto';
import { sanitizeContent } from './sanitize.js';

export class HttpError extends Error {
  constructor(status, message, extra) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

export const TITLE_MAX = 200;
export const CONTENT_MAX = 500_000; // ~500 KB of HTML
const ROLES = ['viewer', 'editor'];

function validateTitle(title) {
  if (typeof title !== 'string') throw new HttpError(400, 'Title must be a string');
  const t = title.trim();
  if (!t) throw new HttpError(400, 'Title cannot be empty');
  if (t.length > TITLE_MAX) throw new HttpError(400, `Title must be at most ${TITLE_MAX} characters`);
  return t;
}

function validateContent(content) {
  if (typeof content !== 'string') throw new HttpError(400, 'Content must be a string');
  if (content.length > CONTENT_MAX) throw new HttpError(413, 'Document is too large');
  return sanitizeContent(content);
}

/**
 * All document + sharing rules live here so they are testable without HTTP
 * and every route goes through the same access check.
 */
export function createDocumentService(db) {
  const q = {
    access: db.prepare(`
      SELECT d.*, u.name AS owner_name, u.email AS owner_email,
             CASE WHEN d.owner_id = @userId THEN 'owner' ELSE s.role END AS role
      FROM documents d
      JOIN users u ON u.id = d.owner_id
      LEFT JOIN document_shares s ON s.document_id = d.id AND s.user_id = @userId
      WHERE d.id = @docId AND (d.owner_id = @userId OR s.user_id IS NOT NULL)`),
    owned: db.prepare(`
      SELECT d.id, d.title, d.updated_at, d.created_at,
             (SELECT COUNT(*) FROM document_shares s WHERE s.document_id = d.id) AS share_count
      FROM documents d WHERE d.owner_id = ? ORDER BY d.updated_at DESC`),
    shared: db.prepare(`
      SELECT d.id, d.title, d.updated_at, d.created_at, s.role, u.name AS owner_name, u.email AS owner_email
      FROM document_shares s
      JOIN documents d ON d.id = s.document_id
      JOIN users u ON u.id = d.owner_id
      WHERE s.user_id = ? ORDER BY d.updated_at DESC`),
    insert: db.prepare(`INSERT INTO documents (id, owner_id, title, content) VALUES (?, ?, ?, ?)`),
    update: db.prepare(`
      UPDATE documents SET title = ?, content = ?, version = version + 1, updated_at = datetime('now')
      WHERE id = ? AND version = ?`),
    remove: db.prepare('DELETE FROM documents WHERE id = ?'),
    shares: db.prepare(`
      SELECT u.id AS user_id, u.name, u.email, s.role, s.created_at
      FROM document_shares s JOIN users u ON u.id = s.user_id
      WHERE s.document_id = ? ORDER BY u.name`),
    userByEmail: db.prepare('SELECT id, name, email FROM users WHERE email = ?'),
    upsertShare: db.prepare(`
      INSERT INTO document_shares (document_id, user_id, role) VALUES (?, ?, ?)
      ON CONFLICT (document_id, user_id) DO UPDATE SET role = excluded.role`),
    deleteShare: db.prepare('DELETE FROM document_shares WHERE document_id = ? AND user_id = ?'),
  };

  /** Returns the document with the caller's role, or throws 404 (never reveals existence). */
  function requireAccess(docId, userId, needed = 'viewer') {
    const doc = q.access.get({ docId, userId });
    if (!doc) throw new HttpError(404, 'Document not found');
    const rank = { viewer: 1, editor: 2, owner: 3 };
    if (rank[doc.role] < rank[needed]) {
      throw new HttpError(403, needed === 'owner'
        ? 'Only the owner can do this'
        : 'You have view-only access to this document');
    }
    return doc;
  }

  function serialize(doc) {
    return {
      id: doc.id,
      title: doc.title,
      content: doc.content,
      version: doc.version,
      role: doc.role,
      owner: { id: doc.owner_id, name: doc.owner_name, email: doc.owner_email },
      createdAt: doc.created_at,
      updatedAt: doc.updated_at,
    };
  }

  return {
    list(userId) {
      return { owned: q.owned.all(userId), shared: q.shared.all(userId) };
    },

    get(docId, userId) {
      return serialize(requireAccess(docId, userId));
    },

    create(userId, { title = 'Untitled document', content = '' } = {}) {
      const id = crypto.randomUUID();
      q.insert.run(id, userId, validateTitle(title), validateContent(content));
      return this.get(id, userId);
    },

    /** Optimistic concurrency: caller must send the version it last saw. */
    update(docId, userId, { title, content, version }) {
      const doc = requireAccess(docId, userId, 'editor');
      if (!Number.isInteger(version)) throw new HttpError(400, 'version is required');
      if (title === undefined && content === undefined) throw new HttpError(400, 'Nothing to update');
      const nextTitle = title === undefined ? doc.title : validateTitle(title);
      const nextContent = content === undefined ? doc.content : validateContent(content);
      const result = q.update.run(nextTitle, nextContent, docId, version);
      if (result.changes === 0) {
        throw new HttpError(409, 'This document was changed by someone else.', {
          document: this.get(docId, userId),
        });
      }
      return this.get(docId, userId);
    },

    remove(docId, userId) {
      requireAccess(docId, userId, 'owner');
      q.remove.run(docId);
    },

    listShares(docId, userId) {
      requireAccess(docId, userId);
      return q.shares.all(docId);
    },

    share(docId, userId, { email, role = 'viewer' }) {
      requireAccess(docId, userId, 'owner');
      if (typeof email !== 'string' || !email.trim()) throw new HttpError(400, 'Email is required');
      if (!ROLES.includes(role)) throw new HttpError(400, 'Role must be "viewer" or "editor"');
      const target = q.userByEmail.get(email.trim());
      if (!target) throw new HttpError(404, `No user with email ${email.trim()}`);
      if (target.id === userId) throw new HttpError(400, 'You already own this document');
      q.upsertShare.run(docId, target.id, role);
      return q.shares.all(docId);
    },

    unshare(docId, userId, targetUserId) {
      requireAccess(docId, userId, 'owner');
      q.deleteShare.run(docId, targetUserId);
      return q.shares.all(docId);
    },
  };
}
