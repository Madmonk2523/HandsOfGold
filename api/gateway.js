'use strict';
// One Vercel function routes all existing APIs to their original handlers.
// Keeps checkout, pricing, custom design, staff and lead endpoints intact.
const handlers = {
  'bitcoin-card': () => require('./bitcoin-card.js'),
  'bitcoin-price': () => require('./bitcoin-price.js'),
  'bracelet': () => require('./bracelet.js'),
  'catalog-checkout': () => require('./catalog-checkout.js'),
  'catalog-payment': () => require('./catalog-payment.js'),
  'catalog': () => require('./catalog.js'),
  'chat': () => require('./chat.js'),
  'crypto-prices': () => require('./crypto-prices.js'),
  'design': () => require('./design.js'),
  'grillz-checkout': () => require('./grillz-checkout.js'),
  'leads': () => require('./leads.js'),
  'meta-feed': () => require('./meta-feed.js'),
  'nfc-verify': () => require('./nfc-verify.js'),
  'reviews': () => require('./reviews.js'),
  'signup': () => require('./signup.js'),
  'staff-auth': () => require('./staff-auth.js')
};
module.exports = async function gateway(req, res) {
  const raw = req.query?.route;
  const route = Array.isArray(raw) ? raw[0] : raw;
  const name = typeof route === 'string' ? route.replace(/\.js$/, '') : '';
  if (!/^[a-z][a-z0-9-]*$/.test(name) || (!handlers[name] && name !== 'gold-estimate' && name !== 'checkout')) {
    return res.status(404).json({ error: 'Endpoint not found' });
  }
  // Keep original path and query string semantics for handlers that inspect req.url.
  const url = new URL(req.url || '/', 'https://www.handsofgoldny.com');
  url.searchParams.delete('route');
  if (name === 'checkout') url.searchParams.set('op', 'checkout');
  req.url = '/api/' + (name === 'checkout' ? 'gold-estimate' : name) + (url.search || '');
  delete req.query.route;
  if (name === 'checkout') req.query.op = 'checkout';
  try {
    const loaded = name === 'gold-estimate' || name === 'checkout'
      ? await import('./gold-estimate.js')
      : handlers[name]();
    const handler = loaded.default || loaded;
    if (typeof handler !== 'function') throw new Error('Invalid API handler');
    return await handler(req, res);
  } catch (err) {
    console.error('API gateway error for', name, err?.message || err);
    if (!res.headersSent) return res.status(500).json({ error: 'Service temporarily unavailable' });
  }
};
