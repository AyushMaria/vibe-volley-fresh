// Signed, httpOnly session cookies for the staff and admin views.
//
// Replaces `localStorage.setItem('authenticated','true')`, which any visitor
// could set from the console, and the passcode literal that used to sit in the
// client bundle. Passcodes live in env vars and are only ever compared here.
const crypto = require('crypto');

const COOKIE_NAME = 'vv_session';
const MAX_AGE_SECONDS = 12 * 60 * 60;
const SESSION_SECRET = process.env.SESSION_SECRET || '';

const PASSCODES = {
  staff: process.env.STAFF_PASSCODE || '',
  admin: process.env.ADMIN_PASSCODE || '',
};

function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const mac = crypto.createHmac('sha256', SESSION_SECRET).update(body).digest('base64url');
  return `${body}.${mac}`;
}

function verify(token) {
  if (!token || !SESSION_SECRET) return null;
  const [body, mac] = String(token).split('.');
  if (!body || !mac) return null;
  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(body).digest('base64url');
  if (!safeEqual(mac, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (!payload.exp || Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

function parseCookies(req) {
  const out = {};
  const raw = req.headers && req.headers.cookie;
  if (!raw) return out;
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i > -1) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

/** Returns the role a passcode grants, or null. Never says which one failed. */
function roleForPasscode(passcode) {
  if (!passcode) return null;
  if (PASSCODES.admin && safeEqual(passcode, PASSCODES.admin)) return 'admin';
  if (PASSCODES.staff && safeEqual(passcode, PASSCODES.staff)) return 'staff';
  return null;
}

function issueCookie(role) {
  const token = sign({ role, exp: Date.now() + MAX_AGE_SECONDS * 1000 });
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${MAX_AGE_SECONDS}`;
}

function clearCookie() {
  return `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`;
}

function sessionFrom(req) {
  return verify(parseCookies(req)[COOKIE_NAME]);
}

/** Guard for a handler. Returns the session, or null after sending a 401. */
function requireRole(req, res, allowed) {
  if (!SESSION_SECRET) {
    res.status(500).json({ ok: false, error: 'SESSION_SECRET is not configured' });
    return null;
  }
  const session = sessionFrom(req);
  if (!session || !allowed.includes(session.role)) {
    res.status(401).json({ ok: false, error: 'Not authorised' });
    return null;
  }
  return session;
}

module.exports = {
  COOKIE_NAME, roleForPasscode, issueCookie, clearCookie,
  sessionFrom, requireRole, sign, verify,
};
