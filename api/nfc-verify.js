'use strict';
const crypto = require('node:crypto');
const { command, configured } = require('./lib/redis');
const nfc = require('./lib/ntag424'), security = require('./lib/request-security');
const store = require('./lib/jewelry-store');
const COOKIE = '__Host-hog_nfc', AGE = 300;
const digest = s => crypto.createHash('sha256').update(s).digest('hex');
const sessionKey = token => store.scope(`hog:nfc:session:${digest(token)}`);
const consumeScript = `local raw=redis.call('GET',KEYS[1]);if not raw then return -1 end;local r=cjson.decode(raw);if r.state=='revoked' or r.state~=ARGV[1] or r.cardId~=ARGV[2] or r.envelope.auth~=ARGV[3] then return -1 end;if tonumber(ARGV[4])<=tonumber(r.lastCounter) then return -2 end;r.lastCounter=tonumber(ARGV[4]);if r.state=='pending' then r.lastTestAt=ARGV[5] end;redis.call('SET',KEYS[1],cjson.encode(r));if r.state=='active' then redis.call('SET',KEYS[2],ARGV[6],'EX',ARGV[7]);return 2 end;return 1`;
function cookie(req) { const match = String(req.headers.cookie || '').match(/(?:^|;\s*)__Host-hog_nfc=([a-f0-9]{64})(?:;|$)/); return match ? match[1] : ''; }
function clear(res) { res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`); }
module.exports = async (req, res) => {
  security.headers(res);
  if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ error: 'Method not allowed.' });
  if (!configured()) return res.status(503).json({ verified: false, error: 'Tag verification temporarily unavailable.' });
  try {
    if (!await security.rate(req, 'nfc', 80, 60)) return res.status(429).json({ verified: false, error: 'Please wait a minute before trying again.' });
    if (req.method === 'GET') {
      const cardId = req.query?.card;
      if (!nfc.hex(cardId, 32)) return res.status(400).json({ verified: false });
      const token = cookie(req); if (!token || !nfc.configured()) return res.status(200).json({ verified: false });
      const raw = await command('GET', sessionKey(token)); if (!raw) return res.status(200).json({ verified: false });
      const session = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (session.cardId !== cardId || session.expiresAt <= Date.now()) return res.status(200).json({ verified: false });
      const tagRaw = await command('GET', store.scope(`hog:nfc:tag:${session.tagId}`)), tag = typeof tagRaw === 'string' ? JSON.parse(tagRaw) : tagRaw;
      if (!tag || tag.state !== 'active' || tag.cardId !== cardId) return res.status(200).json({ verified: false });
      return res.status(200).json({ verified: true, verifiedAt: session.verifiedAt, expiresAt: new Date(session.expiresAt).toISOString() });
    }
    clear(res);
    if (!security.sameOrigin(req)) return res.status(403).json({ verified: false, error: 'Open this tap on our website.' });
    let b; try { b = security.body(req, 1024); } catch (_) { return res.status(400).json({ verified: false, error: 'Invalid tap link.' }); }
    if (!nfc.hex(b.t, 24) || !nfc.hex(b.p, 32) || !nfc.hex(b.c, 16) || Object.keys(b).sort().join(',') !== 'c,p,t') return res.status(400).json({ verified: false, error: 'Invalid tap link.' });
    if (!nfc.configured()) return res.status(503).json({ verified: false, error: 'Secure tag verification is awaiting store activation. Existing jewelry links still work.' });
    const key = store.scope(`hog:nfc:tag:${b.t.toLowerCase()}`), raw = await command('GET', key);
    const tag = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!tag || !['pending', 'active'].includes(tag.state) || tag.profile !== nfc.PROFILE) return res.status(403).json({ verified: false, error: 'Tag not verified. Contact Hands of Gold.' });
    let result; try { result = nfc.verify(b.p, b.c, nfc.open(tag.envelope, tag.tagId), tag.uid); }
    catch (_) { return res.status(403).json({ verified: false, error: 'Tag not verified. Tap the original clasp again.' }); }
    if (!await store.readCard(tag.cardId)) return res.status(403).json({ verified: false, error: 'Tag not verified. Contact Hands of Gold.' });
    const token = crypto.randomBytes(32).toString('hex'), now = Date.now();
    const session = { cardId: tag.cardId, tagId: tag.tagId, verifiedAt: new Date(now).toISOString(), expiresAt: now + AGE * 1000 };
    const used = await command('EVAL', consumeScript, 2, key, sessionKey(token), tag.state, tag.cardId, tag.envelope.auth, result.counter, session.verifiedAt, JSON.stringify(session), AGE);
    if (used < 1) return res.status(409).json({ verified: false, error: 'This tap could not be verified. Tap the original clasp again.' });
    if (used === 1) return res.status(200).json({ verified: false, testPassed: true, message: 'Chip test passed. Staff must finish activation before verified status is available.' });
    res.setHeader('Set-Cookie', `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${AGE}`);
    return res.status(200).json({ verified: true, next: `/bitcoin/?card=${tag.cardId}`, expiresAt: new Date(session.expiresAt).toISOString() });
  } catch (_) { return res.status(503).json({ verified: false, error: 'Tag verification temporarily unavailable. Please tap again later.' }); }
};
module.exports.consumeScript = consumeScript;
