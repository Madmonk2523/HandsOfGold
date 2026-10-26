'use strict';
const crypto = require('node:crypto');
const { command, configured } = require('./lib/redis');
const networks = require('./lib/crypto-networks');
const staff = require('./lib/staff-auth-lib');
const security = require('./lib/request-security');
const ID = /^[a-f0-9]{32}$/;
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const key = id => `hog:btc:card:${id}`;
const UPDATE = `local raw=redis.call('GET',KEYS[1]);if not raw then return -1 end;local r=cjson.decode(raw);if r.editHash~=ARGV[1] then return -2 end;r.addresses=r.addresses or {};if r.address and not r.addresses.BTC then r.addresses.BTC={address=r.address} end;local entry=cjson.decode(ARGV[3]);r.addresses[ARGV[2]]=entry;if ARGV[2]=='BTC' then r.address=entry.address end;r.updatedAt=ARGV[4];redis.call('SET',KEYS[1],cjson.encode(r));return 1`;
async function limit(scope, maximum, seconds) {
  const bucket = Math.floor(Date.now() / (seconds * 1000)), k = `hog:btc:limit:${scope}:${bucket}`;
  const count = await command('INCR', k); if (count === 1) await command('EXPIRE', k, seconds * 2);
  return count <= maximum;
}
async function cachedBalance(asset, address) {
  const cacheKey = `hog:crypto:balance:${asset}:${address}`;
  const cached = await command('GET', cacheKey);
  if (cached) return typeof cached === 'string' ? JSON.parse(cached) : cached;
  const balance = await networks.getBalance(asset, address);
  await command('SET', cacheKey, JSON.stringify(balance), 'EX', asset === 'LTC' || asset === 'DOGE' ? 120 : 30);
  return balance;
}
module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff');
  if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ error: 'Method not allowed.' });
  if (!configured()) return res.status(503).json({ error: 'Jewelry setup is temporarily unavailable. Please contact Hands of Gold.' });
  try {
    const ip = hash(String(req.headers['x-vercel-forwarded-for'] || req.headers['x-forwarded-for'] || 'unknown').split(',')[0].trim());
    if (!await limit(ip, 120, 60)) return res.status(429).json({ error: 'Too many requests. Please try again in a minute.' });
    if (req.method === 'POST') {
      if (!security.sameOrigin(req)) return res.status(403).json({ error: 'Open this form on our website.' });
      if (!staff.requireStaff(req, res)) return;
      let body = req.body;
      if (typeof body === 'string') {
        if (Buffer.byteLength(body) > 2048) return res.status(413).json({ error: 'Request too large.' });
        try { body = JSON.parse(body); } catch (_) { return res.status(400).json({ error: 'Invalid request.' }); }
      }
      if (!body || typeof body !== 'object' || Array.isArray(body) || JSON.stringify(body).length > 2048) return res.status(400).json({ error: 'Invalid request.' });
      if (body.action === 'create') {
        if (!await limit(`create:${ip}`, 5, 3600) || !await limit('create:all', 100, 86400)) return res.status(429).json({ error: 'Jewelry link creation limit reached. Please try later.' });
        const id = crypto.randomBytes(16).toString('hex'), editCode = crypto.randomBytes(24).toString('hex');
        await command('SET', key(id), JSON.stringify({ address: null, addresses: {}, editHash: hash(editCode) }), 'NX', 'EX', 2592000);
        return res.status(201).json({ id, editCode });
      }
      if (!ID.test(body.id || '')) return res.status(400).json({ error: 'Invalid jewelry link.' });
      if (!await limit(`edit:${body.id}`, 10, 600)) return res.status(429).json({ error: 'Too many setup attempts. Try again in 10 minutes.' });
      const raw = await command('GET', key(body.id));
      if (!raw) return res.status(404).json({ error: 'Jewelry link not found or unactivated link expired. Contact Hands of Gold.' });
      const record = typeof raw === 'string' ? JSON.parse(raw) : raw;
      // Existing code hashes stay untouched. A valid staff session now authorizes edits.
      const supplied = record.editHash;
      if (!/^[a-f0-9]{64}$/.test(supplied || '')) return res.status(409).json({ error: 'This jewelry record needs store assistance.' });
      const asset = body.asset === undefined ? 'BTC' : body.asset;
      let entry; try { entry = networks.normalize(asset, body.address, body.destinationTag); } catch (e) { return res.status(400).json({ error: e.message }); }
      const result = await command('EVAL', UPDATE, 1, key(body.id), supplied, asset, JSON.stringify(entry), new Date().toISOString());
      if (result !== 1) return res.status(result === -1 ? 404 : 403).json({ error: result === -1 ? 'Jewelry link not found.' : 'The setup code is incorrect.' });
      return res.status(200).json({ id: body.id, asset, ...entry });
    }
    const id = req.query.card;
    if (typeof id !== 'string' || !ID.test(id)) return res.status(400).json({ error: 'Invalid jewelry link.' });
    const raw = await command('GET', key(id));
    if (!raw) return res.status(404).json({ error: 'Jewelry link not found or unactivated link expired. Contact Hands of Gold.' });
    const record = typeof raw === 'string' ? JSON.parse(raw) : raw, entries = networks.entries(record);
    if (req.query.portfolio === '1') {
      const assets = Object.create(null);
      await Promise.all(Object.entries(entries).map(async ([asset, entry]) => {
        // A destination tag identifies routing, not a separately queryable XRP balance.
        // Skip both cache and provider so a shared account's funds never reach the client.
        if (asset === 'XRP' && entry.destinationTag !== undefined) {
          assets[asset] = { ...entry, balanceHidden: true, balanceReason: 'tagged-xrp' };
          return;
        }
        try { assets[asset] = { ...entry, balance: await cachedBalance(asset, entry.address) }; }
        catch (_) { assets[asset] = { ...entry, error: 'Balance temporarily unavailable. Refresh to try again.' }; }
      }));
      return res.status(200).json({ id, assets, supported: networks.order });
    }
    // Keep previously installed/cached BTC clients compatible with their existing links.
    if (!entries.BTC) return res.status(200).json({ id, address: null });
    try {
      const b = await cachedBalance('BTC', entries.BTC.address);
      const numbers = Object.fromEntries(['confirmed', 'pending', 'total'].map(k => { const n = Number(b[k]); if (!Number.isSafeInteger(n)) throw new Error('Invalid balance.'); return [k, n]; }));
      return res.status(200).json({ id, address: entries.BTC.address, ...numbers, checkedAt: b.checkedAt });
    } catch (_) { return res.status(502).json({ address: entries.BTC.address, error: 'Your address is saved, but the balance service is unavailable. Please refresh later.' }); }
  } catch (_) { return res.status(503).json({ error: 'Unable to load your jewelry right now. Please try again.' }); }
};
module.exports.balances = data => Object.fromEntries(Object.entries(networks.utxoBalance(data)).map(([k, v]) => [k, Number(v)]));
module.exports.validateAddress = value => networks.normalize('BTC', value).address;
