'use strict';
const crypto = require('node:crypto');
const PROFILE = 'hog424-aes-picc-v1';
const hex = (value, length) => typeof value === 'string' && new RegExp(`^[0-9a-fA-F]{${length}}$`).test(value);
function block(key, input) {
  const cipher = crypto.createCipheriv('aes-128-ecb', key, null); cipher.setAutoPadding(false);
  return Buffer.concat([cipher.update(input), cipher.final()]);
}
function xor(a, b) { return Buffer.from(a.map((v, i) => v ^ b[i])); }
function double(input) {
  const out = Buffer.alloc(16); let carry = 0;
  for (let i = 15; i >= 0; i--) { out[i] = (input[i] << 1) | carry; carry = input[i] >>> 7; }
  if (carry) out[15] ^= 0x87; return out;
}
// NIST SP 800-38B CMAC, using the platform AES primitive (no third-party runtime).
function cmac(key, message) {
  if (key.length !== 16) throw Error('Invalid AES key.');
  const k1 = double(block(key, Buffer.alloc(16))), k2 = double(k1);
  const n = Math.max(1, Math.ceil(message.length / 16)), complete = message.length > 0 && message.length % 16 === 0;
  let last = Buffer.alloc(16); message.copy(last, 0, (n - 1) * 16);
  if (!complete) last[message.length % 16] = 0x80;
  last = xor(last, complete ? k1 : k2); let state = Buffer.alloc(16);
  for (let i = 0; i < n - 1; i++) state = block(key, xor(state, message.subarray(i * 16, i * 16 + 16)));
  return block(key, xor(state, last));
}
function sessionKey(fileKey, uid, counterBytes) { return cmac(fileKey, Buffer.concat([Buffer.from('3CC300010080', 'hex'), uid, counterBytes])); }
function mac(fileKey, uid, counterBytes, input = Buffer.alloc(0)) { return Buffer.from(cmac(sessionKey(fileKey, uid, counterBytes), input).filter((_, i) => i % 2 === 1)); }
function verify(picc, suppliedMac, keys, expectedUid) {
  if (!hex(picc, 32) || !hex(suppliedMac, 16) || !hex(expectedUid, 14)) throw Error('Invalid tap.');
  const decipher = crypto.createDecipheriv('aes-128-cbc', Buffer.from(keys.meta, 'hex'), Buffer.alloc(16)); decipher.setAutoPadding(false);
  const plain = Buffer.concat([decipher.update(Buffer.from(picc, 'hex')), decipher.final()]);
  if (plain[0] !== 0xC7) throw Error('Unsupported tag configuration.');
  const uid = plain.subarray(1, 8), counterBytes = plain.subarray(8, 11);
  const actual = mac(Buffer.from(keys.file, 'hex'), uid, counterBytes);
  if (!crypto.timingSafeEqual(uid, Buffer.from(expectedUid, 'hex')) || !crypto.timingSafeEqual(actual, Buffer.from(suppliedMac, 'hex'))) throw Error('Invalid tap.');
  return { uid: uid.toString('hex').toUpperCase(), counter: counterBytes.readUIntLE(0, 3) };
}
function keyring() {
  const ring = JSON.parse(process.env.NFC_KEYRING_JSON || '{}');
  if (!/^[A-Za-z0-9_-]{1,30}$/.test(ring.active || '') || !ring.keys || !Object.hasOwn(ring.keys, ring.active) || !hex(ring.keys[ring.active], 64)) throw Error('Owner key setup required.');
  for (const [id, key] of Object.entries(ring.keys)) if (!/^[A-Za-z0-9_-]{1,30}$/.test(id) || !hex(key, 64) || /^0+$/.test(key)) throw Error('Invalid key configuration.');
  return ring;
}
function configured() { try { keyring(); return true; } catch (_) { return false; } }
function validTagKeys(keys) {
  return keys && Object.keys(keys).length === 3 && ['admin', 'meta', 'file'].every(k => hex(keys[k], 32) && !/^0+$/.test(keys[k])) && new Set(Object.values(keys).map(v => v.toUpperCase())).size === 3;
}
function seal(keys, tagId) {
  if (!validTagKeys(keys)) throw Error('Use distinct non-default tag keys.');
  const ring = keyring(), iv = crypto.randomBytes(12), cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(ring.keys[ring.active], 'hex'), iv);
  cipher.setAAD(Buffer.from(`hog:nfc:${tagId}:${PROFILE}`));
  const data = Buffer.concat([cipher.update(JSON.stringify(keys), 'utf8'), cipher.final()]);
  return { kid: ring.active, iv: iv.toString('hex'), data: data.toString('hex'), auth: cipher.getAuthTag().toString('hex') };
}
function open(envelope, tagId) {
  const ring = keyring(); if (!Object.hasOwn(ring.keys, envelope.kid)) throw Error('Key unavailable.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(ring.keys[envelope.kid], 'hex'), Buffer.from(envelope.iv, 'hex'));
  decipher.setAAD(Buffer.from(`hog:nfc:${tagId}:${PROFILE}`)); decipher.setAuthTag(Buffer.from(envelope.auth, 'hex'));
  const keys = JSON.parse(Buffer.concat([decipher.update(Buffer.from(envelope.data, 'hex')), decipher.final()]).toString('utf8'));
  if (!validTagKeys(keys)) throw Error('Invalid key envelope.'); return keys;
}
function tapUrl(tagId) { return `https://www.handsofgoldny.com/tap/?t=${tagId}&p=${'0'.repeat(32)}&c=${'0'.repeat(16)}`; }
function profile(tagId) {
  if (!hex(tagId, 24)) throw Error('Invalid tag ID.');
  const url = tapUrl(tagId), suffix = url.slice('https://'.length), payload = Buffer.concat([Buffer.from([0x04]), Buffer.from(suffix)]);
  const ndef = Buffer.concat([Buffer.from([0xD1, 0x01, payload.length, 0x55]), payload]);
  const nlen = Buffer.alloc(2); nlen.writeUInt16BE(ndef.length);
  const ndefFile = Buffer.concat([nlen, ndef]);
  const piccOffset = ndefFile.indexOf(Buffer.from('&p=')) + 3, macOffset = ndefFile.indexOf(Buffer.from('&c=')) + 3;
  if (ndefFile.length > 256 || piccOffset < 3 || macOffset < 3) throw Error('NDEF too long.');
  return { name: PROFILE, url, ndefFileHex: ndefFile.toString('hex').toUpperCase(), fileNumber: 2, cryptoMode: 'AES', ascii: true, uidAndCounter: true, encryptedFileData: false, appKeys: { admin: 0, meta: 1, file: 2 }, fileOptionsHex: '40', accessRightsHex: '00E0', sdmOptionsHex: 'C1', sdmAccessRightsHex: 'F112', piccDataOffset: piccOffset, sdmMacOffset: macOffset, sdmMacInputOffset: macOffset, note: 'Offsets are byte offsets from the start of NDEF file 02, including NLEN. Protect writing/settings with key 0; meta key 1; MAC key 2. Change all other default app keys during secure provisioning. Use an NTAG424-compatible tool with authenticated secure messaging; writing this URL alone is insufficient.' };
}
module.exports = { PROFILE, hex, cmac, sessionKey, mac, verify, configured, seal, open, validTagKeys, profile };
