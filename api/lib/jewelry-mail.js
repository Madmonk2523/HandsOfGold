'use strict';
const crypto = require('node:crypto');
const { command } = require('./redis'), store = require('./jewelry-store');
const mailKey = id => store.scope(`hog:jewelry:mail:${id}`), queueKey = store.scope('hog:jewelry:mail-queue');
async function send(message, id) {
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) throw Error('Email is not configured.');
  const r = await fetch('https://api.resend.com/emails', { method: 'POST', signal: AbortSignal.timeout(10000), headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': `hog-jewelry-${id}` }, body: JSON.stringify({ from: process.env.RESEND_FROM_EMAIL, to: [message.to], subject: message.subject, text: message.text }) });
  const data = await r.json(); if (!r.ok || !data.id) throw Error('Email service unavailable.'); return data.id;
}
async function login(to, code, cardId, challenge) {
  const message = { to, cardId, type: 'owner-login', subject: 'Your Hands of Gold jewelry sign-in code', text: `Your one-time sign-in code is:\n\n${code}\n\nIt expires in 10 minutes. Enter it on the Hands of Gold jewelry owner screen. If you did not request this code, ignore it. Never share it with a caller or in a chat.` };
  if (store.preview) { await command('SET', mailKey(challenge), JSON.stringify({ ...message, status: 'preview', createdAt: new Date().toISOString() }), 'EX', 600); await command('LPUSH', store.scope(`hog:jewelry:preview-mail:${cardId}`), challenge); return; }
  await send(message, challenge);
}
async function deliver(id) {
  const raw = await command('GET', mailKey(id)); if (!raw) return 'missing'; const item = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (['sent', 'preview'].includes(item.status)) return item.status;
  if (store.preview) { item.status = 'preview'; await command('SET', mailKey(id), JSON.stringify(item)); await command('ZREM', queueKey, id); await command('LPUSH', store.scope(`hog:jewelry:preview-mail:${item.cardId}`), id); return 'preview'; }
  const lock = mailKey(id) + ':lock'; if (!await command('SET', lock, crypto.randomBytes(16).toString('hex'), 'NX', 'EX', 30)) return 'queued';
  try { item.providerId = await send(item, id); item.status = 'sent'; item.sentAt = new Date().toISOString(); await command('SET', mailKey(id), JSON.stringify(item)); await command('ZREM', queueKey, id); return 'sent'; }
  catch (_) { item.status = 'queued'; item.lastAttemptAt = new Date().toISOString(); await command('SET', mailKey(id), JSON.stringify(item)); return 'queued'; }
  finally { await command('DEL', lock); }
}
async function retry(cardId) {
  const ids = await command('ZRANGE', queueKey, 0, 49); let processed = 0;
  for (const id of ids || []) { const raw = await command('GET', mailKey(id)); const m = typeof raw === 'string' ? JSON.parse(raw) : raw; if (m?.cardId === cardId) { await deliver(id); processed++; } }
  return processed;
}
module.exports = { mailKey, queueKey, login, deliver, retry };
