'use strict';
const crypto = require('node:crypto');
const { command, configured } = require('./lib/redis'), security = require('./lib/request-security'), store = require('./lib/jewelry-store');
const auth = require('./lib/jewelry-owner'), mail = require('./lib/jewelry-mail');
module.exports = async (req, res) => {
  security.headers(res);
  if (!['POST', 'DELETE'].includes(req.method)) return res.status(405).json({ error: 'Method not allowed.' });
  if (!security.sameOrigin(req)) return res.status(403).json({ error: 'Open sign-in on our website.' });
  if (req.method === 'DELETE') { res.setHeader('Set-Cookie', '__Host-hog_owner=; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=0'); return res.status(200).json({ success: true }); }
  if (!configured()) return res.status(503).json({ error: 'Owner sign-in unavailable.' });
  try {
    if (!await security.rate(req, 'owner-signin', 12, 600)) return res.status(429).json({ error: 'Too many attempts. Try again in 10 minutes.' });
    let b; try { b = security.body(req); } catch (_) { return res.status(400).json({ error: 'Invalid request.' }); }
    const email = auth.email(b.email); if (!email || !/^[a-f0-9]{32}$/.test(b.id || '')) return res.status(400).json({ error: 'Enter a valid email and jewelry link.' });
    const owner = await auth.current(b.id), challengeKey = store.scope(`hog:jewelry:login:${b.id}:${auth.hash(email)}`);
    if (b.action === 'request-code') {
      const bucket = store.scope(`hog:jewelry:login-limit:${b.id}:${Math.floor(Date.now() / 600000)}`);
      const n = await command('INCR', bucket); if (n === 1) await command('EXPIRE', bucket, 1200);
      if (n <= 5 && owner?.email === email) {
        const code = crypto.randomBytes(16).toString('hex'), challenge = crypto.randomUUID();
        await command('SET', challengeKey, JSON.stringify({ hash: auth.hash(code), emailHash: owner.emailHash, version: owner.version, attempts: 0 }), 'EX', 600);
        try { await mail.login(email, code, b.id, challenge); } catch (_) { await command('DEL', challengeKey); return res.status(503).json({ error: 'The sign-in email could not be sent. Try again later.' }); }
      }
      return res.status(200).json({ success: true, preview: store.preview, message: store.preview ? 'If this email is assigned to the card, a test message is available in the signed-in staff preview inbox. No real email was sent.' : 'If this email is assigned to the card, a sign-in code has been sent.' });
    }
    if (b.action !== 'verify-code' || !/^[a-f0-9]{32}$/i.test(b.code || '') || !owner || owner.email !== email) return res.status(401).json({ error: 'The code is invalid or expired.' });
    const token = crypto.randomBytes(32).toString('hex'), now = Date.now();
    const session = { cardId: b.id, subject: owner.emailHash, version: owner.version, expiresAt: now + 1800000 };
    const result = await command('EVAL', auth.LOGIN, 3, challengeKey, auth.ownerKey(b.id), auth.sessionKey(token), auth.hash(b.code.toLowerCase()), new Date(now).toISOString(), JSON.stringify(session), 1800);
    if (result !== 1) return res.status(401).json({ error: 'The code is invalid or expired.' });
    res.setHeader('Set-Cookie', `__Host-hog_owner=${token}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=1800`);
    return res.status(200).json({ success: true });
  } catch (_) { return res.status(503).json({ error: 'Owner sign-in temporarily unavailable.' }); }
};
