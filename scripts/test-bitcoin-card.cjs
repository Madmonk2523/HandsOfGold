const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const store = new Map();
require.cache[require.resolve('../api/lib/redis')] = { exports: {
  configured: () => true,
  command: async (op, k, value, ...args) => {
    if (op === 'GET') return store.get(k) || null;
    if (op === 'SET') { if (args.includes('NX') && store.has(k)) return null; store.set(k, value); return 'OK'; }
    if (op === 'INCR') { const n = (Number(store.get(k)) || 0) + 1; store.set(k, n); return n; }
    if (op === 'EXPIRE') return 1;
    throw new Error('Unexpected database command');
  }
} };
const handler = require('../api/bitcoin-card');
const address = '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa';
beforeEach(() => store.clear());
async function call(method, body, query = {}) {
  const res = { headers: {}, setHeader(k,v) { this.headers[k] = v; }, status(s) { this.code = s; return this; }, json(value) { this.body = value; return this; } };
  await handler({ method, body, query, headers: { 'x-vercel-forwarded-for': '192.0.2.1' } }, res);
  return res;
}
async function create() { const result = await call('POST', { action: 'create' }); assert.equal(result.code, 201); return result.body; }
test('validates Bitcoin address checksums and rejects testnet', () => {
  assert.equal(handler.validateAddress(address), address);
  for (const bad of ['1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNb', 'not-an-address', 'mipcBbFg9gMiCh81Kj8tqqdgoZub1ZJRfn']) assert.throws(() => handler.validateAddress(bad));
});
test('separates confirmed balance from pending incoming and outgoing', () => {
  assert.deepEqual(handler.balances({ chain_stats: { funded_txo_sum: 500, spent_txo_sum: 100 }, mempool_stats: { funded_txo_sum: 20, spent_txo_sum: 50 } }), { confirmed: 400, pending: -30, total: 370 });
  assert.throws(() => handler.balances({}));
});
test('card creation stores a hash, never the plain setup code', async () => {
  const card = await create(); assert.match(card.id, /^[a-f0-9]{32}$/); assert.match(card.editCode, /^[a-f0-9]{48}$/);
  assert.ok(!store.get(`hog:btc:card:${card.id}`).includes(card.editCode));
  const view = await call('GET', null, { card: card.id }); assert.deepEqual(view.body, { id: card.id, address: null });
});
test('setup code required for linking and later changes', async () => {
  const card = await create();
  assert.equal((await call('POST', { ...card, editCode: 'wrong', address })).code, 403);
  assert.equal((await call('POST', { ...card, address })).code, 200);
  assert.equal((await call('POST', { id: card.id, address })).code, 403);
});
test('rejects invalid addresses without modifying the card', async () => {
  const card = await create();
  assert.equal((await call('POST', { ...card, address: 'invalid' })).code, 400);
  assert.equal((await call('GET', null, { card: card.id })).body.address, null);
});
test('reads saved address across sessions, caches balance, hides setup hash', async () => {
  const card = await create(); await call('POST', { ...card, address });
  const original = global.fetch; let requests = 0;
  global.fetch = async () => { requests++; return { ok: true, json: async () => ({ chain_stats: { funded_txo_sum: 100, spent_txo_sum: 25 }, mempool_stats: { funded_txo_sum: 20, spent_txo_sum: 0 } }) }; };
  try {
    const first = await call('GET', null, { card: card.id });
    const second = await call('GET', null, { card: card.id });
    assert.equal(first.body.confirmed, 75); assert.equal(second.body.total, 95); assert.equal(requests, 1);
    assert.equal(first.body.editHash, undefined); assert.equal(first.body.address, address);
  } finally { global.fetch = original; }
});
test('provider failure returns an error instead of a misleading zero balance', async () => {
  const card = await create(); await call('POST', { ...card, address });
  const original = global.fetch; global.fetch = async () => { throw new Error('timeout'); };
  try { const result = await call('GET', null, { card: card.id }); assert.equal(result.code, 502); assert.equal(result.body.confirmed, undefined); assert.equal(result.body.address, address); }
  finally { global.fetch = original; }
});
test('limits creation and rejects invalid or missing cards', async () => {
  for (let i=0; i<5; i++) await create();
  assert.equal((await call('POST', { action: 'create' })).code, 429);
  assert.equal((await call('GET', null, { card: '../../leads' })).code, 400);
  assert.equal((await call('GET', null, { card: 'a'.repeat(32) })).code, 404);
});
