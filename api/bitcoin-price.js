'use strict';
const { command, configured } = require('./lib/redis');
function quote(data, now = Date.now()) {
  if (!Number.isFinite(data.USD) || data.USD <= 0 || !Number.isSafeInteger(data.time) || data.time * 1000 > now + 60000 || now - data.time * 1000 > 900000) throw new Error('Price unavailable or outdated.');
  return { usd: data.USD, quotedAt: new Date(data.time * 1000).toISOString(), source: 'mempool.space' };
}
module.exports = async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed.' });
  try {
    if (configured()) {
      const cached = await command('GET', 'hog:btc:usd-price');
      if (cached) {
        const data = typeof cached === 'string' ? JSON.parse(cached) : cached;
        if (Date.now() - Date.parse(data.quotedAt) < 900000) {
          res.setHeader('Cache-Control', 'public, max-age=30, s-maxage=60');
          return res.status(200).json(data);
        }
      }
    }
    const response = await fetch('https://mempool.space/api/v1/prices', { signal: AbortSignal.timeout(5000), headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error('Price unavailable.');
    const data = quote(await response.json());
    if (configured()) await command('SET', 'hog:btc:usd-price', JSON.stringify(data), 'EX', 60);
    res.setHeader('Cache-Control', 'public, max-age=30, s-maxage=60');
    return res.status(200).json(data);
  } catch (_) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(503).json({ error: 'Dollar estimate temporarily unavailable.' });
  }
};
module.exports.quote = quote;
