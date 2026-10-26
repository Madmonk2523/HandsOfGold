'use strict';
/* Hands of Gold — Grillz "Pay in full" checkout (Oct 2026).

   GET  /api/grillz-checkout?probe=1  -> { available, taxRate, prices, mailInShipping, kitValue }
        grillz.html only offers "Pay in full" when STRIPE_SECRET_KEY is set.
   POST /api/grillz-checkout          body: { set, metal, color, arch, fitting, email, leadId, quotedTotal }
        -> { url } (Stripe Checkout page), or { error } (409 adds { probe } when prices changed).

   Plain high-polish Top OR Bottom 6 and 8 sets only, and the mold kit is free.
   Prices come from the table below, never from the browser; the browser's
   total is only compared so the customer is never charged a number they
   didn't see. Sales tax is the flat Copiague rate (NYS 4% + Suffolk 4.375% +
   MCTD 0.375%), the same default the Monaci checkout uses.

   Env:
     STRIPE_SECRET_KEY                  required
     SALES_TAX_RATE                     optional, default 0.0875
     GRILLZ_MAIL_IN_SHIPPING            optional, flat mail-in shipping in dollars (e.g. "15").
                                        Unset = mail-in pay in full is off; the page says to use the deposit. */

const TAX_RATE = Number(process.env.SALES_TAX_RATE || 0.0875);
const MAX_BODY_BYTES = 4 * 1024;

// Cents, one arch, plain high-polish. Mirrors the price table on grillz.html.
const PRICES = {
  '.925 Sterling Silver': { 6: 67500, 8: 80000 },
  '10K Gold': { 6: 159000, 8: 188800 },
  '14K Gold': { 6: 215000, 8: 256000 },
  '18K Gold': { 6: 310000, 8: 368000 }
};
// SILVER SALE: through the end of Nov 30, 2026 in New York, then regular silver prices apply.
const SILVER_SALE = { 6: 52500, 8: 60000 };
const SILVER_SALE_ENDS = Date.parse('2026-12-01T05:00:00Z');
// What the free mold kit would otherwise cost (shown as the saving).
const KIT_VALUE = { 'In store': 2500, 'Mail-in kit': 4995 };

const SETS = { 'Top OR Bottom 6 Set': 6, 'Top OR Bottom 8 Set': 8 };
const COLORS = ['Yellow', 'White', 'Rose'];
const ARCHES = ['Top', 'Bottom'];
const FITTINGS = ['In store', 'Mail-in kit'];

function mailInShipping() {
  const raw = process.env.GRILLZ_MAIL_IN_SHIPPING;
  if (raw == null || String(raw).trim() === '') return null;
  const n = Math.round(Number(raw) * 100);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function prices(now) {
  const out = {};
  for (const k of Object.keys(PRICES)) out[k] = { ...PRICES[k] };
  if (now < SILVER_SALE_ENDS) out['.925 Sterling Silver'] = { ...SILVER_SALE };
  return out;
}

function probe() {
  return {
    available: Boolean(process.env.STRIPE_SECRET_KEY),
    taxRate: TAX_RATE,
    prices: prices(Date.now()),
    mailInShipping: mailInShipping(),
    kitValue: KIT_VALUE
  };
}

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function allowedOrigins() {
  const set = new Set(['https://www.handsofgoldny.com', 'https://handsofgoldny.com']);
  if (process.env.VERCEL_URL) set.add('https://' + process.env.VERCEL_URL);
  if (process.env.VERCEL_BRANCH_URL) set.add('https://' + process.env.VERCEL_BRANCH_URL);
  return set;
}

function parseBody(req) {
  let body = req.body;
  if (typeof body === 'string') {
    if (Buffer.byteLength(body, 'utf8') > MAX_BODY_BYTES) throw new Error('too large');
    body = JSON.parse(body);
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('invalid');
  if (Buffer.byteLength(JSON.stringify(body), 'utf8') > MAX_BODY_BYTES) throw new Error('too large');
  return body;
}

function clean(v, max) {
  return String(v == null ? '' : v).replace(/[\x00-\x1F\x7F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

function money(c) {
  return '$' + (c / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

module.exports = async function handler(req, res) {
  if (req.method === 'GET') {
    // Only the probe is public; it holds no secrets.
    return send(res, 200, probe());
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return send(res, 405, { error: 'Method not allowed.' });
  }

  const headers = req.headers || {};
  if (!/^application\/json(?:\s*;|$)/i.test(headers['content-type'] || '')) return send(res, 400, { error: 'Please use the website form.' });
  if (headers['sec-fetch-site'] === 'cross-site') return send(res, 403, { error: 'Please use the website form.' });
  const origins = allowedOrigins();
  let base = 'https://www.handsofgoldny.com';
  if (headers.origin) {
    if (!origins.has(headers.origin)) return send(res, 403, { error: 'Please use the website form.' });
    base = headers.origin;
  }

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return send(res, 503, { error: 'Online payment is not available right now. Please call (631) 264-6610.' });

  let body;
  try { body = parseBody(req); } catch (_) { return send(res, 400, { error: 'Invalid request.' }); }

  const teeth = SETS[body.set];
  const metal = clean(body.metal, 40);
  const fitting = FITTINGS.includes(body.fitting) ? body.fitting : '';
  const arch = ARCHES.includes(body.arch) ? body.arch : '';
  const gold = /Gold/.test(metal);
  const color = gold ? (COLORS.includes(body.color) ? body.color : '') : '';
  const table = prices(Date.now());
  const price = teeth && table[metal] ? table[metal][teeth] : 0;

  if (!teeth || !price) return send(res, 400, { error: 'Pay in full is for plain Top OR Bottom 6 and 8 sets in silver, 10K, 14K or 18K gold.' });
  if (!fitting) return send(res, 400, { error: 'Please choose in-store or mail-in fitting.' });
  if (!arch) return send(res, 400, { error: 'Please choose top or bottom.' });
  if (gold && !color) return send(res, 400, { error: 'Please choose your gold color.' });

  const mail = fitting === 'Mail-in kit';
  const ship = mail ? mailInShipping() : 0;
  if (mail && ship == null) return send(res, 400, { error: 'Pay in full is available for in-store fitting right now. For mail-in, please start with the $125 deposit.' });

  const tax = Math.round((price + ship) * TAX_RATE);
  const total = price + ship + tax;
  if (body.quotedTotal != null && Number(body.quotedTotal) !== total) {
    return send(res, 409, { error: 'Your total is now ' + money(total) + '. Please check it, then continue.', probe: probe() });
  }

  const metalLabel = gold ? metal.replace('Gold', color + ' Gold') : metal;
  const setLabel = arch + ' ' + teeth + '-tooth set';
  const leadId = clean(body.leadId, 120).replace(/[^A-Za-z0-9_-]/g, '');
  const email = clean(body.email, 200);
  const taxPct = Math.round(TAX_RATE * 10000) / 100;

  const p = new URLSearchParams();
  p.append('mode', 'payment');
  p.append('submit_type', 'pay');
  p.append('success_url', base + '/grillz-paid.html?session_id={CHECKOUT_SESSION_ID}&value=' + (total / 100).toFixed(2) + '&fit=' + (mail ? 'mail' : 'store'));
  p.append('cancel_url', base + '/grillz.html?checkout=cancelled#reserve');
  p.append('line_items[0][quantity]', '1');
  p.append('line_items[0][price_data][currency]', 'usd');
  p.append('line_items[0][price_data][unit_amount]', String(price));
  p.append('line_items[0][price_data][product_data][name]', 'Custom grillz · ' + setLabel + ' · ' + metalLabel);
  p.append('line_items[0][price_data][product_data][description]', 'Plain high-polish, made from your own impressions. Mold kit FREE with pay in full. Free plastic fit sample and 7-day fit guarantee.');
  p.append('line_items[1][quantity]', '1');
  p.append('line_items[1][price_data][currency]', 'usd');
  p.append('line_items[1][price_data][unit_amount]', String(tax));
  p.append('line_items[1][price_data][product_data][name]', 'NY sales tax (' + taxPct + '%)');
  if (mail) {
    p.append('shipping_address_collection[allowed_countries][0]', 'US');
    p.append('shipping_options[0][shipping_rate_data][type]', 'fixed_amount');
    p.append('shipping_options[0][shipping_rate_data][fixed_amount][amount]', String(ship));
    p.append('shipping_options[0][shipping_rate_data][fixed_amount][currency]', 'usd');
    p.append('shipping_options[0][shipping_rate_data][display_name]', 'Mail-in: free impression kit + shipping your finished set');
  }
  p.append('phone_number_collection[enabled]', 'true');
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) p.append('customer_email', email);
  if (leadId) p.append('client_reference_id', leadId.slice(0, 200));
  p.append('custom_text[submit][message]', 'Your mold kit is free with pay in full. Grillz are custom-made for you and are final sale once production begins; every set has a 7-day fit guarantee.');
  const meta = { order: 'grillz_pay_in_full', set: setLabel, metal: metalLabel, fitting: fitting, lead_id: leadId || 'not_saved', mold_kit: 'FREE (pay in full)', tax_rate: String(TAX_RATE) };
  for (const [k, v] of Object.entries(meta)) {
    p.append('metadata[' + k + ']', v);
    p.append('payment_intent_data[metadata][' + k + ']', v);
  }
  p.append('payment_intent_data[description]', 'Grillz pay in full · ' + setLabel + ' · ' + metalLabel + ' · ' + fitting);

  try {
    const r = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: p.toString()
    });
    const out = await r.json().catch(() => ({}));
    if (!r.ok || !out.url) {
      console.error('grillz-checkout: Stripe error', r.status, out && out.error && out.error.message);
      return send(res, 502, { error: 'We couldn’t open the payment page just now. Please try again or call (631) 264-6610.' });
    }
    return send(res, 200, { url: out.url });
  } catch (err) {
    console.error('grillz-checkout: request failed', err && err.message);
    return send(res, 502, { error: 'We couldn’t open the payment page just now. Please try again or call (631) 264-6610.' });
  }
};
