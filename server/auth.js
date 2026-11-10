import crypto from 'node:crypto';

const COOKIE = 'sid';
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 32).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  const [salt, hash] = String(stored).split(':');
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, 32);
  const expected = Buffer.from(hash, 'hex');
  return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
}

/** Stateless session token: userId.expiresAt.hmac */
export function signToken(userId, secret, now = Date.now()) {
  const payload = `${userId}.${now + MAX_AGE_MS}`;
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifyToken(token, secret, now = Date.now()) {
  if (typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [userId, exp, sig] = parts;
  const expected = crypto.createHmac('sha256', secret).update(`${userId}.${exp}`).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  if (Number(exp) < now) return null;
  return userId;
}

export function setSessionCookie(res, token, secure) {
  res.cookie(COOKIE, token, { httpOnly: true, sameSite: 'lax', secure, maxAge: MAX_AGE_MS, path: '/' });
}

export function clearSessionCookie(res) {
  res.clearCookie(COOKIE, { path: '/' });
}

export function requireAuth(db, secret) {
  const findUser = db.prepare('SELECT id, email, name FROM users WHERE id = ?');
  return (req, res, next) => {
    const userId = verifyToken(req.cookies?.[COOKIE], secret);
    const user = userId && findUser.get(userId);
    if (!user) return res.status(401).json({ error: 'Not signed in' });
    req.user = user;
    next();
  };
}
