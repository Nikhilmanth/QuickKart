import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { db } from '../db.js';
import { signToken, requireAuth, bad } from '../auth.js';
import { sendMail } from '../mailer.js';

const r = Router();
const OTP_TTL_MIN = 5;
// Dev OTP exposure is OFF by default now that real Firebase SMS is live.
// Set EXPOSE_DEV_OTP=1 in .env only if you ever need the fallback back.
const EXPOSE_DEV_OTP = process.env.EXPOSE_DEV_OTP === '1';

export function formatUser(u) {
  if (!u) return u;
  const user = { ...u };
  if (user.phone && user.phone.startsWith('email:')) {
    user.phone = '';
  }
  return user;
}

export function issueOtp(identifier) {
  const code = String(crypto.randomInt(100000, 999999));
  const hash = bcrypt.hashSync(code, 8);
  const expires = new Date(Date.now() + OTP_TTL_MIN * 60000).toISOString();
  db.prepare('INSERT INTO otp_codes (phone, code_hash, expires_at) VALUES (?,?,?)').run(identifier, hash, expires);
  console.log(`[OTP] ${identifier} -> ${code}`);
  return code;
}

r.post('/otp/send', (req, res) => {
  const phone = String(req.body?.phone || '').replace(/\D/g, '');
  if (phone.length !== 10) return bad(res, 'Enter a valid 10-digit mobile number');
  const code = issueOtp(phone);
  res.json({ success: true, message: 'OTP sent', ...(EXPOSE_DEV_OTP ? { devOtp: code } : {}) });
});

/** Shared: find-or-create the account behind an identifier (phone or email), return JWT session */
export function sessionForIdentifier(identifier, { role, name } = {}) {
  let user;
  const isEmail = identifier.includes('@');
  const cleanId = isEmail ? identifier.trim().toLowerCase() : identifier.trim();

  const adminPhone = process.env.ADMIN_PHONE || '9999999999';
  const adminEmail = (process.env.ADMIN_EMAIL || process.env.EMAIL_USER || 'admin@quickkart.com').toLowerCase();
  const isAdminIdentifier = cleanId === adminPhone || cleanId === adminEmail || cleanId.includes('admin') || role === 'ADMIN';

  if (role === 'PARTNER') {
    let partner;
    if (isEmail) {
      partner = db.prepare('SELECT * FROM partners WHERE email=? OR phone=?').get(cleanId, cleanId);
    } else {
      partner = db.prepare('SELECT * FROM partners WHERE phone=?').get(cleanId);
    }

    if (!partner) {
      // Auto-create/register partner if demo or new delivery partner logging in
      const defaultName = isEmail ? cleanId.split('@')[0] : 'Delivery Partner';
      const phoneVal = isEmail ? `p_${cleanId}` : cleanId;
      const pId = db.prepare('INSERT INTO partners (phone, name, email, vehicle) VALUES (?,?,?,?)')
        .run(phoneVal, name || defaultName, isEmail ? cleanId : '', 'Bike').lastInsertRowid;
      partner = db.prepare('SELECT * FROM partners WHERE id=?').get(pId);
    } else if (isEmail && !partner.email) {
      db.prepare('UPDATE partners SET email=? WHERE id=?').run(cleanId, partner.id);
      partner.email = cleanId;
    }

    return { token: signToken({ id: partner.id, role: 'PARTNER' }), user: partner };
  }

  if (isEmail) {
    user = db.prepare('SELECT * FROM users WHERE email=?').get(cleanId);
  } else {
    user = db.prepare('SELECT * FROM users WHERE phone=?').get(cleanId);
  }

  if (!user) {
    const assignedRole = (role === 'ADMIN' || isAdminIdentifier) ? 'ADMIN' : 'CUSTOMER';
    const phoneVal = isEmail ? `email:${cleanId}` : cleanId;
    const defaultName = isEmail ? cleanId.split('@')[0] : (assignedRole === 'ADMIN' ? 'Admin' : 'Shopper');
    const id = db.prepare('INSERT INTO users (phone, name, email, role) VALUES (?,?,?,?)')
      .run(
        phoneVal,
        name || defaultName,
        isEmail ? cleanId : '',
        assignedRole
      ).lastInsertRowid;
    user = db.prepare('SELECT * FROM users WHERE id=?').get(id);
    db.prepare('INSERT INTO carts (user_id) VALUES (?)').run(id);
  } else {
    // Elevate to ADMIN if logging in via Ops Admin or matching admin credentials
    if ((role === 'ADMIN' || isAdminIdentifier) && user.role !== 'ADMIN') {
      db.prepare('UPDATE users SET role="ADMIN" WHERE id=?').run(user.id);
      user.role = 'ADMIN';
    }
    // Backfill profile details on later logins
    if (name && !user.name) {
      db.prepare('UPDATE users SET name=? WHERE id=?').run(name, user.id);
      user.name = name;
    }
    if (isEmail && !user.email) {
      db.prepare('UPDATE users SET email=? WHERE id=?').run(cleanId, user.id);
      user.email = cleanId;
    }
    if (!isEmail && (!user.phone || user.phone.startsWith('email:'))) {
      db.prepare('UPDATE users SET phone=? WHERE id=?').run(cleanId, user.id);
      user.phone = cleanId;
    }
  }

  if (role === 'ADMIN' && user.role !== 'ADMIN') {
    return { error: 'This account does not have Admin privileges', code: 403 };
  }

  const cleanUser = formatUser(user);
  return { token: signToken({ id: user.id, role: user.role }), user: cleanUser };
}

r.post('/otp/verify', (req, res) => {
  const identifier = String(req.body?.identifier || req.body?.phone || req.body?.email || '').trim().toLowerCase();
  const code = String(req.body?.code || '');
  const name = String(req.body?.name || '').trim();
  if (!identifier || !code) return bad(res, 'Identifier and OTP required');

  const row = db.prepare(
    `SELECT * FROM otp_codes WHERE phone=? AND consumed=0 AND expires_at > datetime('now') ORDER BY id DESC LIMIT 1`
  ).get(identifier);
  if (!row || !bcrypt.compareSync(code, row.code_hash)) return bad(res, 'Invalid or expired OTP');
  db.prepare('UPDATE otp_codes SET consumed=1 WHERE id=?').run(row.id);

  const s = sessionForIdentifier(identifier, { role: req.body?.role, name });
  if (s.error) return bad(res, s.error, s.code);
  res.json(s);
});

/**
 * Firebase Phone-Auth login (real SMS OTP handled by Google).
 * Frontend signs in with firebase SDK, sends the idToken here.
 * We verify it against Google's Identity Toolkit REST API using FIREBASE_API_KEY.
 */
r.post('/firebase', async (req, res) => {
  try {
    if (!process.env.FIREBASE_API_KEY) return bad(res, 'Firebase is not configured on the server (.env)', 501);
    const { idToken, role, name } = req.body || {};
    if (!idToken) return bad(res, 'idToken required');
    const resp = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${process.env.FIREBASE_API_KEY}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken }) }
    );
    const data = await resp.json();
    const fullPhone = data?.users?.[0]?.phoneNumber;
    if (!fullPhone) return bad(res, data?.error?.message || 'Invalid Firebase token', 401);
    const digits = fullPhone.replace(/\D/g, '');
    const phone = digits.length > 10 ? digits.slice(-10) : digits; // keep last 10 (strip country code)
    const s = sessionForIdentifier(phone, { role, name });
    if (s.error) return bad(res, s.error, s.code);
    res.json(s);
  } catch (e) {
    bad(res, `Firebase verification failed: ${e.message}`, 500);
  }
});

r.get('/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT id, phone, name, email, role FROM users WHERE id=?').get(req.user.id);
  res.json({ user: formatUser(user) });
});

// ---------- Addresses ----------
r.get('/addresses', requireAuth, (req, res) => {
  res.json({ addresses: db.prepare('SELECT * FROM addresses WHERE user_id=? ORDER BY is_default DESC, id DESC').all(req.user.id) });
});
r.post('/addresses', requireAuth, (req, res) => {
  const { label = 'Home', line1, city = '', lat, lng } = req.body || {};
  if (!line1) return bad(res, 'Address line required');
  const count = db.prepare('SELECT COUNT(*) c FROM addresses WHERE user_id=?').get(req.user.id).c;
  const id = db.prepare('INSERT INTO addresses (user_id,label,line1,city,lat,lng,is_default) VALUES (?,?,?,?,?,?,?)')
    .run(req.user.id, label, line1, city, lat ?? null, lng ?? null, count === 0 ? 1 : 0).lastInsertRowid;
  res.json({ address: db.prepare('SELECT * FROM addresses WHERE id=?').get(id) });
});

export default r;
