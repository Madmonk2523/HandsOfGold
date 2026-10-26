'use strict';
const { command, configured } = require('./lib/redis');
const PAIRS = { ETH: 'XETHZUSD', SOL: 'SOLUSD', LTC: 'XLTCZUSD', DOGE: 'XDGUSD', XRP: 'XXRPZUSD' };
function parse(data) {
  if (!Array.isArray(data.error) || data.error.length || !data.result) throw new Error('Prices unavailable.');
  const prices = {};
  for (const [asset, pair] of Object.entries(PAIRS)) {
    const value = Number(data.result[pair]?.c?.[0]);
    if (!Number.isFinite(value) || value <= 0) throw new Error('Invalid price.');
    prices[asset] = value;
  }
  return { prices, quotedAt: new Date().toISOString(), source: 'Kraken' };
}
module.exports = async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed.' });
  try {
    if (configured()) {
      const raw = await command('GET', 'hog:crypto:usd-prices');
      if (raw) {
        const cached = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (Date.now() - Date.parse(cached.quotedAt) < 120000) { res.setHeader('Cache-Control', 'public, max-age=30, s-maxage=60'); return res.status(200).json(cached); }
      }
    }
    const response = await fetch('https://api.kraken.com/0/public/Ticker?pair=ETHUSD,SOLUSD,LTCUSD,XDGUSD,XRPUSD', { signal: AbortSignal.timeout(6000), headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error('Prices unavailable.');
    const quote = parse(await response.json());
    if (configured()) await command('SET', 'hog:crypto:usd-prices', JSON.stringify(quote), 'EX', 60);
    res.setHeader('Cache-Control', 'public, max-age=30, s-maxage=60'); return res.status(200).json(quote);
  } catch (_) { res.setHeader('Cache-Control', 'no-store'); return res.status(503).json({ error: 'Dollar estimates temporarily unavailable.' }); }
};
module.exports.parse = parse;
