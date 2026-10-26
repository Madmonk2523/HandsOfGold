'use strict';
/* Hands of Gold — "Sign up now" 10% coupon (Oct 2026).

   POST /api/signup   body: { name, email, phone?, consent, website (honeypot), page, utm_* }
        -> { success, code, expires, resent? }

   One code per email address. The code is created here (never in the browser),
   saved to the staff lead list (lead type welcome_offer, so staff search finds
   it by code) and emailed to the customer. Staff apply the discount in store or
   on phone/text orders and mark the lead "won" when it is used.

   Env: RESEND_API_KEY + RESEND_FROM_EMAIL (coupon email), KV_REST_API_URL/TOKEN (storage + rate limits). */

const { createHash, randomInt } = require('node:crypto');
const redis = require('./lib/redis');
const { command, configured } = redis;
const { parseBody, validate, checkRate } = require('./lib/lead-protection');

const DEFAULT_EMAIL = 'handsofgoldlongisland@gmail.com';
const PERCENT = 10;
const MAX_OFF = 100;           // dollars
const VALID_DAYS = 30;
const OFFER = `${PERCENT}% off one purchase, up to $${MAX_OFF} off`;
const TERMS = `${OFFER}. One code per customer, single use, valid ${VALID_DAYS} days from signup. ` +
  'Use it in store, or mention it when you order by phone or text. Not valid on past purchases or gift cards, ' +
  "and can't be combined with other coupons.";
const RESEND_AFTER_MS = 24 * 60 * 60 * 1000;
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I

function clean(v, max = 400) { return String(v == null ? '' : v).replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max); }
function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function hash(v) { return createHash('sha256').update(v).digest('hex'); }
function newCode() { let s = ''; for (let i = 0; i < 6; i++) s += ALPHABET[randomInt(ALPHABET.length)]; return 'HOG10-' + s; }
function nyDate(ms) { return new Date(ms).toLocaleDateString('en-US', { timeZone: 'America/New_York', month: 'long', day: 'numeric', year: 'numeric' }); }

async function emailCoupon(to, name, code, expires) {
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) return false;
  const first = esc((name.split(' ')[0]) || 'there');
  const html = `<div style="margin:0;padding:24px 12px;background:#0b0e14;font-family:Helvetica,Arial,sans-serif"><div style="max-width:560px;margin:0 auto;background:#080B12;border:1px solid rgba(199,150,56,.45);border-radius:14px;overflow:hidden"><div style="height:3px;background:linear-gradient(90deg,#0A2E73,#C79638 55%,#0A2E73)"></div><div style="padding:26px 24px">` +
    `<p style="margin:0 0 4px;color:#C79638;font-size:11px;letter-spacing:.2em;text-transform:uppercase;font-weight:700">Hands of Gold &middot; Since 1983</p>` +
    `<h1 style="margin:0 0 12px;color:#F6F3EC;font-size:24px;line-height:1.2;font-weight:700">Here's your 10% off, ${first}</h1>` +
    `<p style="margin:0 0 18px;color:rgba(246,243,236,.8);font-size:14px;line-height:1.55">Thanks for signing up. Use this code for <strong style="color:#F6F3EC">${esc(OFFER)}</strong>.</p>` +
    `<div style="margin:0 0 18px;padding:16px;border:1px dashed #C79638;border-radius:10px;text-align:center"><div style="color:#8d8778;font-size:11px;letter-spacing:.16em;text-transform:uppercase">Your code</div><div style="margin-top:6px;color:#E4C77D;font-size:28px;font-weight:700;letter-spacing:.08em">${esc(code)}</div><div style="margin-top:6px;color:#8d8778;font-size:12px">Valid through ${esc(expires)}</div></div>` +
    `<p style="margin:0 0 6px;color:#F6F3EC;font-size:14px;font-weight:700">How to use it</p>` +
    `<p style="margin:0 0 18px;color:rgba(246,243,236,.8);font-size:14px;line-height:1.55">Show this email in store at 494 Oak St, Copiague, or mention your code when you order by phone or text at <a href="tel:6312646610" style="color:#E4C77D">(631) 264-6610</a>. Shopping online? Call or text us before you check out and we'll send you a discounted payment link.</p>` +
    `<p style="margin:0 0 20px"><a href="https://www.handsofgoldny.com/index.html#featured-products" style="display:inline-block;background:#C79638;color:#071a49;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:999px">Shop in-stock pieces</a></p>` +
    `<p style="margin:0;color:#8d8778;font-size:11px;line-height:1.5">${esc(TERMS)}<br><br>You're getting this because you signed up at handsofgoldny.com. To stop emails from us, reply "unsubscribe".<br>Hands of Gold Jewelry and Repairs &middot; 494 Oak St, Copiague, NY 11726 &middot; (631) 264-6610</p>` +
    `</div></div></div>`;
  const text = `Here's your 10% off, ${name.split(' ')[0] || 'there'}\n\nYour code: ${code}\nValid through ${expires}\n${OFFER}.\n\n` +
    `How to use it: show this email in store at 494 Oak St, Copiague, or mention your code when you order by phone or text at (631) 264-6610. ` +
    `Shopping online? Call or text us before you check out and we'll send you a discounted payment link.\n\n` +
    `Shop in-stock pieces: https://www.handsofgoldny.com/index.html#featured-products\n\n${TERMS}\n\n` +
    `You're getting this because you signed up at handsofgoldny.com. To stop emails from us, reply "unsubscribe".\nHands of Gold Jewelry and Repairs, 494 Oak St, Copiague, NY 11726`;
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST', signal: AbortSignal.timeout(8000),
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.RESEND_FROM_EMAIL, to: [to], reply_to: process.env.LEAD_EMAIL || DEFAULT_EMAIL, subject: `Your 10% off code: ${code}`, html, text })
  });
  if (!r.ok) throw new Error('Resend coupon ' + r.status);
  return true;
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ success: false, error: 'Method not allowed.' }); }

  let body;
  try { body = parseBody(req); } catch (_) { return res.status(400).json({ success: false, error: 'Invalid request.' }); }
  const validationError = validate(req, body);
  if (validationError) return res.status(400).json({ success: false, error: validationError });

  const name = clean(body.name, 160), email = clean(body.email, 240).toLowerCase(), phone = clean(body.phone, 80);
  if (!email) return res.status(400).json({ success: false, error: 'Please enter your email so we can send your code.' });
  if (body.consent !== true) return res.status(400).json({ success: false, error: 'Please tick the box so we can email your code.' });
  if (!configured()) return res.status(503).json({ success: false, error: 'Sign-up is not available right now. Please call (631) 264-6610.' });

  try {
    if (!await checkRate(req, body, redis)) { res.setHeader('Retry-After', '3600'); return res.status(429).json({ success: false, error: 'Too many tries. Please try later or call (631) 264-6610.' }); }
  } catch (e) {
    console.error('[hog-signup-protection] unavailable');
    return res.status(503).json({ success: false, error: 'Sign-up is not available right now. Please call (631) 264-6610.' });
  }

  const emailKey = 'hog:coupon:email:' + hash(email);
  try {
    // Already signed up: never show the code on screen (it would hand anyone's code to
    // whoever types their address); re-email it at most once a day instead.
    const existing = await command('GET', emailKey);
    if (existing) {
      const rec = JSON.parse(existing);
      let resent = false;
      if (Date.now() - (rec.last_sent || 0) > RESEND_AFTER_MS) {
        try { resent = await emailCoupon(email, rec.name || name, rec.code, rec.expires); } catch (e) { console.error('[hog-signup-resend]', e.message); }
        if (resent) { rec.last_sent = Date.now(); await command('SET', emailKey, JSON.stringify(rec)); }
      }
      return res.status(200).json({ success: true, existing: true, resent });
    }

    const now = Date.now();
    const expires = nyDate(now + VALID_DAYS * 864e5);
    let code = newCode();
    for (let i = 0; i < 5 && await command('EXISTS', 'hog:coupon:code:' + code); i++) code = newCode();

    const leadId = `HOG-${now.toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    const iso = new Date(now).toISOString();
    const fields = {
      leadType: 'welcome_offer', name, email, phone,
      coupon_code: code, coupon_expires: expires, offer: OFFER, offer_terms: TERMS,
      request_summary: `10% SIGN-UP COUPON ${code} · valid through ${expires} · max $${MAX_OFF} off · mark this lead "won" when it's used`,
      source: 'HandsOfGoldNY.com sign-up popup', page: clean(body.page, 600), referrer: clean(body.referrer, 600),
      utm_source: clean(body.utm_source, 120), utm_campaign: clean(body.utm_campaign, 120),
      consent: 'Customer asked for the 10% coupon and agreed to receive Hands of Gold emails (and texts if a number was given); accepted Terms and Privacy Policy.',
      submitted_at: clean(body.submitted_at, 80), lead_id: leadId, received_at_utc: iso
    };
    Object.keys(fields).forEach(k => { if (!fields[k]) delete fields[k]; });
    const lead = { id: leadId, lead_type: 'welcome_offer', name, email, phone, status: 'new', created_at: iso, assigned_to: '', next_follow_up: '', notes: '', payload: fields };

    await command('SET', 'hog:coupon:code:' + code, JSON.stringify({ email, name, lead_id: leadId, created_at: iso, expires, status: 'issued' }));
    await command('LPUSH', 'hog:leads', JSON.stringify(lead));
    await command('LTRIM', 'hog:leads', '0', '1999');

    let sent = false;
    try { sent = await emailCoupon(email, name, code, expires); } catch (e) { console.error('[hog-signup-email]', leadId, e.message); }
    await command('SET', emailKey, JSON.stringify({ code, name, lead_id: leadId, expires, last_sent: sent ? now : 0 }));
    console.log('[hog-signup]', JSON.stringify({ leadId, code, emailed: sent }));
    return res.status(200).json({ success: true, code, expires, emailed: sent });
  } catch (e) {
    console.error('[hog-signup-storage]', e.message);
    return res.status(502).json({ success: false, error: "We couldn't sign you up just now. Please try again or call (631) 264-6610." });
  }
};
