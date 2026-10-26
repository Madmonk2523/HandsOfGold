'use strict';
const crypto = require('node:crypto');
const { command } = require('./redis');
function sameOrigin(req) {
  if (req.headers['sec-fetch-site'] === 'cross-site') return false;
  try { const origin = new URL(req.headers.origin); return origin.protocol === 'https:' && origin.host === req.headers.host && origin.origin === req.headers.origin; }
  catch (_) { return false; }
}
async function rate(req, scope, maximum, seconds) {
  const ip = String(req.headers['x-vercel-forwarded-for'] || req.headers['x-forwarded-for'] || 'unknown').split(',')[0].trim();
  const digest = crypto.createHash('sha256').update(ip).digest('hex');
  const k = `hog:security:${scope}:${digest}:${Math.floor(Date.now() / (seconds * 1000))}`;
  return await command('EVAL', "local n=redis.call('INCR',KEYS[1]);if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end;return n", 1, k, seconds * 2) <= maximum;
}
function body(req, maximum = 4096) {
  if (!String(req.headers['content-type'] || '').toLowerCase().startsWith('application/json')) throw Error('Use a JSON request.');
  const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
  if (!raw || Buffer.byteLength(raw) > maximum) throw Error('Invalid request size.');
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw Error('Invalid request.');
  return parsed;
}
function headers(res) {
  res.setHeader('Cache-Control', 'no-store'); res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
}
module.exports = { sameOrigin, rate, body, headers };
