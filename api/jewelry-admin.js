'use strict';
const crypto = require('node:crypto');
const { command, configured } = require('./lib/redis');
const staff = require('./lib/staff-auth-lib'), security = require('./lib/request-security'), nfc = require('./lib/ntag424');
const store = require('./lib/jewelry-store');
const cardOK = v => nfc.hex(v, 32) && v === v.toLowerCase();
const tagKey = id => store.scope(`hog:nfc:tag:${id}`), cardKey = id => store.scope(`hog:nfc:card:${id}`);
const ENROLL = `if redis.call('EXISTS',KEYS[1])~=1 or redis.call('TTL',KEYS[1])>=0 then return -1 end;if redis.call('EXISTS',KEYS[2])==1 or redis.call('EXISTS',KEYS[3])==1 then return -2 end;if redis.call('SCARD',KEYS[4])>=20 then return -3 end;redis.call('SET',KEYS[2],ARGV[1]);redis.call('SET',KEYS[3],ARGV[2]);redis.call('SADD',KEYS[4],ARGV[2]);return 1`;
const TRANSITION = `local raw=redis.call('GET',KEYS[1]);if not raw then return -1 end;local r=cjson.decode(raw);if r.cardId~=ARGV[1] then return -1 end;if ARGV[2]=='activate' then if r.state~='pending' or not r.lastTestAt then return -2 end;r.state='active';r.activatedAt=ARGV[3];elseif ARGV[2]=='revoke' then r.state='revoked';r.revokedAt=ARGV[3];else return -2 end;redis.call('SET',KEYS[1],cjson.encode(r));return 1`;
function publicRecord(r) { return { tagId: r.tagId, cardId: r.cardId, uid: r.uid, profile: r.profile, state: r.state, createdAt: r.createdAt, lastTestAt: r.lastTestAt || null, activatedAt: r.activatedAt || null, revokedAt: r.revokedAt || null }; }
module.exports = async (req, res) => {
  security.headers(res);
  if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ error: 'Method not allowed.' });
  if (!staff.isStaff(req)) return res.status(req.method === 'GET' ? 200 : 401).json({ staff: false, preview: store.preview, error: req.method === 'GET' ? undefined : 'Staff sign-in required.' });
  if (req.method === 'POST' && !security.sameOrigin(req)) return res.status(403).json({ error: 'Open this form on our website.' });
  if (!configured()) return res.status(503).json({ error: 'Jewelry service temporarily unavailable.' });
  try {
    if (!await security.rate(req, 'jewelry-admin', 60, 60)) return res.status(429).json({ error: 'Please wait a minute and try again.' });
    if (req.method === 'GET') {
      if (req.query?.profile !== undefined) {
        if (!nfc.hex(req.query.profile, 24)) return res.status(400).json({ error: 'Invalid tag ID.' });
        return res.status(200).json({ settings: nfc.profile(req.query.profile) });
      }
      const card = req.query?.card;
      if (card === undefined) return res.status(200).json({ staff: true, nfcConfigured: nfc.configured(), profile: nfc.PROFILE, preview: store.preview });
      if (!cardOK(card)) return res.status(400).json({ error: 'Invalid jewelry ID.' });
      const record = await store.readCard(card); if (!record) return res.status(404).json({ error: 'Jewelry link not found.' });
      const ids = await command('SMEMBERS', cardKey(card));
      const tags = await Promise.all((ids || []).slice(0, 20).map(async id => { const rawTag = await command('GET', tagKey(id)); return rawTag ? publicRecord(typeof rawTag === 'string' ? JSON.parse(rawTag) : rawTag) : null; }));
      return res.status(200).json({ staff: true, nfcConfigured: nfc.configured(), cardId: card, linkedCoins: Object.keys(record.addresses || (record.address ? { BTC: true } : {})), tags: tags.filter(Boolean), preview: store.preview });
    }
    let b; try { b = security.body(req); } catch (_) { return res.status(400).json({ error: 'Invalid request.' }); }
    if (!cardOK(b.cardId) || !nfc.hex(b.tagId, 24) || b.tagId !== b.tagId.toLowerCase()) return res.status(400).json({ error: 'Invalid jewelry or tag ID.' });
    if (b.action === 'enroll') {
      await store.ensureCard(b.cardId);
      if (!nfc.configured()) return res.status(503).json({ error: 'Owner key setup is required before enrolling tags.' });
      if (b.profile !== nfc.PROFILE || !nfc.hex(b.uid, 14) || !b.uid.toUpperCase().startsWith('04') || !nfc.validTagKeys(b.keys)) return res.status(400).json({ error: 'Invalid tag provisioning package.' });
      const uid = b.uid.toUpperCase();
      const record = { tagId: b.tagId, cardId: b.cardId, uid, profile: nfc.PROFILE, state: 'pending', lastCounter: -1, createdAt: new Date().toISOString(), envelope: nfc.seal(b.keys, b.tagId) };
      const result = await command('EVAL', ENROLL, 4, store.cardKey(b.cardId), tagKey(b.tagId), store.scope(`hog:nfc:uid:${uid}`), cardKey(b.cardId), JSON.stringify(record), b.tagId);
      if (result !== 1) return res.status(409).json({ error: result === -1 ? 'Save a coin on this jewelry link before enrolling a tag.' : result === -3 ? 'Tag limit reached for this jewelry link.' : 'This tag or chip UID is already enrolled. Existing enrollment was preserved.' });
      return res.status(201).json({ tag: publicRecord(record), settings: nfc.profile(b.tagId) });
    }
    if (!['activate', 'revoke'].includes(b.action)) return res.status(400).json({ error: 'Unknown action.' });
    if (b.action === 'activate' && b.physicalTestConfirmed !== true) return res.status(400).json({ error: 'Confirm the physical clasp test before activation.' });
    const result = await command('EVAL', TRANSITION, 1, tagKey(b.tagId), b.cardId, b.action, new Date().toISOString());
    if (result !== 1) return res.status(409).json({ error: result === -2 ? 'A genuine physical test must pass while this tag is pending.' : 'Tag enrollment not found.' });
    return res.status(200).json({ success: true });
  } catch (_) { return res.status(503).json({ error: 'Tag administration temporarily unavailable. No wallet addresses were changed.' }); }
};
module.exports.scripts = { ENROLL, TRANSITION };
