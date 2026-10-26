'use strict';
const { command } = require('./redis');
const namespace = process.env.HOG_JEWELRY_PREVIEW_NAMESPACE || '';
if (namespace && !/^hog:preview:[a-zA-Z0-9_-]{1,60}$/.test(namespace)) throw Error('Invalid preview namespace.');
const preview = Boolean(namespace);
const scope = key => preview ? `${namespace}:${key}` : key;
const cardKey = id => scope(`hog:btc:card:${id}`);
const parse = value => typeof value === 'string' ? JSON.parse(value) : value;
function demo(id) {
  if (!preview || !['d'.repeat(32), 'e'.repeat(32), 'f'.repeat(32)].includes(id)) return null;
  const all = require('./jewelry-preview-fixtures.json');
  const record = { address: all.BTC.address, addresses: all, editHash: '0'.repeat(64) };
  if (id !== 'f'.repeat(32)) { record.balanceMode = 'private'; record.showCoins = { btc: id === 'e'.repeat(32), eth: false, sol: false, ltc: false, doge: false, xrp: false }; }
  return record;
}
async function readCard(id) {
  const own = await command('GET', cardKey(id)); if (own) return parse(own);
  if (preview) { const fixture = demo(id); if (fixture) return fixture; return parse(await command('GET', `hog:btc:card:${id}`)); }
  return null;
}
async function ensureCard(id) {
  const record = await readCard(id); if (!record) return null;
  if (preview) await command('SET', cardKey(id), JSON.stringify(record), 'NX');
  return record;
}
module.exports = { preview, scope, cardKey, readCard, ensureCard };
