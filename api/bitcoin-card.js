'use strict';
const crypto = require('node:crypto');
const bitcoin = require('bitcoinjs-lib');
const { command, configured } = require('./lib/redis');
const ID = /^[a-f0-9]{32}$/;
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const key = id => `hog:btc:card:${id}`;
function address(value) {
  if (typeof value !== 'string' || value.length > 100) throw new Error('Enter a valid Bitcoin mainnet receiving address.');
  let result = value.trim();
  if (/^bc1/i.test(result) && (result === result.toUpperCase() || result === result.toLowerCase())) result = result.toLowerCase();
  bitcoin.address.toOutputScript(result, bitcoin.networks.bitcoin);
  return result;
}
async function limit(scope, maximum, seconds) {
  const bucket = Math.floor(Date.now() / (seconds * 1000));
  const k = `hog:btc:limit:${scope}:${bucket}`;
  const count = await command('INCR', k);
  if (count === 1) await command('EXPIRE', k, seconds * 2);
  return count <= maximum;
}
function balances(data) {
  const stats = name => {
    const s = data[name];
    if (!s || !['funded_txo_sum', 'spent_txo_sum'].every(k => Number.isSafeInteger(s[k]) && s[k] >= 0)) throw new Error('Invalid balance response.');
    return s.funded_txo_sum - s.spent_txo_sum;
  };
  const confirmed = stats('chain_stats'), pending = stats('mempool_stats');
  return { confirmed, pending, total: confirmed + pending };
}
module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ error: 'Method not allowed.' });
  if (!configured()) return res.status(503).json({ error: 'Card setup is temporarily unavailable. Please contact Hands of Gold.' });
  try {
    const ip = hash(String(req.headers['x-vercel-forwarded-for'] || req.headers['x-forwarded-for'] || 'unknown').split(',')[0].trim());
    if (!await limit(ip, 120, 60)) return res.status(429).json({ error: 'Too many requests. Please try again in a minute.' });
    if (req.method === 'POST') {
      if (req.headers['sec-fetch-site'] === 'cross-site') return res.status(403).json({ error: 'Open this form on our website.' });
      let body = req.body;
      if (typeof body === 'string') { if (Buffer.byteLength(body) > 2048) return res.status(413).json({ error: 'Request too large.' }); body = JSON.parse(body); }
      if (!body || typeof body !== 'object' || JSON.stringify(body).length > 2048) return res.status(400).json({ error: 'Invalid request.' });
      if (body.action === 'create') {
        if (!await limit(`create:${ip}`, 5, 3600) || !await limit('create:all', 100, 86400)) return res.status(429).json({ error: 'Card creation limit reached. Please try later.' });
        const id = crypto.randomBytes(16).toString('hex');
        const editCode = crypto.randomBytes(24).toString('hex');
        await command('SET', key(id), JSON.stringify({ address: null, editHash: hash(editCode) }), 'NX', 'EX', 2592000);
        return res.status(201).json({ id, editCode });
      }
      if (!ID.test(body.id || '')) return res.status(400).json({ error: 'Invalid card link.' });
      if (!await limit(`edit:${body.id}`, 10, 600)) return res.status(429).json({ error: 'Too many setup attempts. Try again in 10 minutes.' });
      const raw = await command('GET', key(body.id));
      if (!raw) return res.status(404).json({ error: 'Card not found or unactivated card expired. Contact Hands of Gold.' });
      const record = typeof raw === 'string' ? JSON.parse(raw) : raw;
      const supplied = hash(typeof body.editCode === 'string' ? body.editCode : '');
      if (!crypto.timingSafeEqual(Buffer.from(record.editHash, 'hex'), Buffer.from(supplied, 'hex'))) return res.status(403).json({ error: 'The setup code is incorrect.' });
      let savedAddress;
      try { savedAddress = address(body.address); } catch (_) { return res.status(400).json({ error: 'Enter a valid Bitcoin mainnet receiving address. Testnet and Lightning addresses are not supported.' }); }
      await command('SET', key(body.id), JSON.stringify({ ...record, address: savedAddress, updatedAt: new Date().toISOString() }));
      return res.status(200).json({ id: body.id, address: savedAddress });
    }
    const id = req.query.card;
    if (typeof id !== 'string' || !ID.test(id)) return res.status(400).json({ error: 'Invalid card link.' });
    const raw = await command('GET', key(id));
    if (!raw) return res.status(404).json({ error: 'Card not found or unactivated card expired. Contact Hands of Gold.' });
    const record = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!record.address) return res.status(200).json({ id, address: null });
    const cached = await command('GET', `hog:btc:balance:${record.address}`);
    if (cached) return res.status(200).json({ id, address: record.address, ...(typeof cached === 'string' ? JSON.parse(cached) : cached) });
    let balance;
    try {
      const upstream = await fetch(`https://mempool.space/api/address/${encodeURIComponent(record.address)}`, { signal: AbortSignal.timeout(8000), headers: { Accept: 'application/json' } });
      if (!upstream.ok) throw new Error('Balance service unavailable.');
      balance = { ...balances(await upstream.json()), checkedAt: new Date().toISOString() };
    } catch (_) { return res.status(502).json({ address: record.address, error: 'Your address is saved, but the balance service is unavailable. Please refresh later.' }); }
    await command('SET', `hog:btc:balance:${record.address}`, JSON.stringify(balance), 'EX', 30);
    return res.status(200).json({ id, address: record.address, ...balance });
  } catch (_) { return res.status(503).json({ error: 'Unable to load your card right now. Please try again.' }); }
};
module.exports.balances = balances;
module.exports.validateAddress = address;
