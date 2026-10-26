'use strict';
const crypto = require('node:crypto');
const { command } = require('./redis'), store = require('./jewelry-store'), staff = require('./staff-auth-lib');
const hash = s => crypto.createHash('sha256').update(s).digest('hex');
const ownerKey = id => store.scope(`hog:jewelry:owner:${id}`), auditKey = id => store.scope(`hog:jewelry:audit:${id}`);
const sessionKey = token => store.scope(`hog:jewelry:owner-session:${hash(token)}`);
const parse = s => typeof s === 'string' ? JSON.parse(s) : s;
function email(value) { if (typeof value !== 'string') return null; const e = value.trim().toLowerCase(); return e.length <= 254 && /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,63}$/.test(e) ? e : null; }
async function current(id) { return parse(await command('GET', ownerKey(id))); }
async function authorize(req, id) {
  if (staff.isStaff(req)) return { role: 'staff', id: (process.env.STAFF_EMAIL || 'HandsOfGold@handsofgold.org').toLowerCase(), version: '' };
  const cookie = String(req.headers.cookie || '').match(/(?:^|;\s*)__Host-hog_owner=([a-f0-9]{64})(?:;|$)/); if (!cookie) return null;
  const session = parse(await command('GET', sessionKey(cookie[1]))); if (!session || session.cardId !== id || session.expiresAt <= Date.now()) return null;
  const owner = await current(id); if (!owner || !owner.verifiedAt || owner.version !== session.version || owner.emailHash !== session.subject) return null;
  return { role: 'owner', id: session.subject, version: session.version };
}
const ASSIGN = `if not redis.call('EXISTS',KEYS[1]) then return -1 end;local card=cjson.decode(redis.call('GET',KEYS[1]));local old=redis.call('GET',KEYS[2]);if old then local o=cjson.decode(old);if o.email==ARGV[1] then return 0 end;if card.handoff then return -2 end end;local r={email=ARGV[1],emailHash=ARGV[2],version=ARGV[3],assignedAt=ARGV[4]};redis.call('SET',KEYS[2],cjson.encode(r));redis.call('XADD',KEYS[3],'*','event',ARGV[5]);return 1`;
const LOGIN = `local raw=redis.call('GET',KEYS[1]);local own=redis.call('GET',KEYS[2]);if not raw or not own then return 0 end;local c=cjson.decode(raw);local o=cjson.decode(own);if c.version~=o.version or c.emailHash~=o.emailHash then return 0 end;c.attempts=c.attempts+1;if c.attempts>5 then redis.call('DEL',KEYS[1]);return 0 end;if c.hash~=ARGV[1] then local ttl=redis.call('TTL',KEYS[1]);if ttl>0 then redis.call('SET',KEYS[1],cjson.encode(c),'EX',ttl) end;return 0 end;redis.call('DEL',KEYS[1]);o.verifiedAt=ARGV[2];redis.call('SET',KEYS[2],cjson.encode(o));redis.call('SET',KEYS[3],ARGV[3],'EX',ARGV[4]);return 1`;
module.exports = { hash, email, current, authorize, ownerKey, auditKey, sessionKey, parse, ASSIGN, LOGIN };
