'use strict';
const crypto = require('node:crypto');
const { command, configured } = require('./lib/redis'), store = require('./lib/jewelry-store'), security = require('./lib/request-security');
const auth = require('./lib/jewelry-owner'), visibility = require('./lib/balance-visibility'), mail = require('./lib/jewelry-mail'), networks = require('./lib/crypto-networks');
const goodId = id => typeof id === 'string' && /^[a-f0-9]{32}$/.test(id);
const UPDATE = `local raw=redis.call('GET',KEYS[1]);if not raw then return -1 end;local r=cjson.decode(raw);local own=redis.call('GET',KEYS[2]);local o=nil;if own then o=cjson.decode(own) end;if ARGV[1]=='owner' and (not o or o.version~=ARGV[2]) then return -2 end;local next=cjson.decode(ARGV[3]);local changed=r.balanceMode~=next.balanceMode;local previous=r.showCoins or {};for k,v in pairs(next.showCoins) do if (previous[k]==true)~=v then changed=true end end;local oldMode=r.balanceMode or 'flex_all';local enabled={};for symbol,entry in pairs(r.addresses or {}) do local coin=string.lower(symbol);local tagged=symbol=='XRP' and entry.destinationTag~=nil;local was=not tagged and (oldMode~='private' or previous[coin]==true);local now=not tagged and (next.balanceMode~='private' or next.showCoins[coin]==true);if now and (not was or ARGV[4]~='save') then table.insert(enabled,symbol) end end;if r.address and not (r.addresses and r.addresses.BTC) then local was=oldMode~='private' or previous.btc==true;local now=next.balanceMode~='private' or next.showCoins.btc==true;if now and (not was or ARGV[4]~='save') then table.insert(enabled,'BTC') end end;if #enabled>0 and (not o or not o.verifiedAt or o.version~=ARGV[8]) then return -3 end;if ARGV[4]~='save' then if ARGV[1]~='staff' then return -2 end;if r.handoff then return -4 end;r.handoff={choice=ARGV[4],staff=ARGV[5],at=ARGV[6]};changed=true end;if not changed then return 0 end;r.balanceMode=next.balanceMode;r.showCoins=next.showCoins;local event=cjson.decode(ARGV[7]);event.previous={balanceMode=oldMode,showCoins=previous};event.next=next;event.enabledCoins=enabled;redis.call('SET',KEYS[1],cjson.encode(r));redis.call('XADD',KEYS[3],'*','event',cjson.encode(event));if #enabled>0 then local m={to=o.email,cardId=event.cardId,type='visibility-on',status='queued',createdAt=ARGV[6],subject='Your Hands of Gold balance visibility is ON',text='Balance visibility was turned ON for: '..table.concat(enabled,', ')..'. Anyone who opens your jewelry link can see those linked address balances. If you did not authorize this, sign in to turn them off or contact Hands of Gold.'};redis.call('SET',KEYS[4],cjson.encode(m));redis.call('ZADD',KEYS[5],ARGV[9],ARGV[10]) end;return #enabled>0 and 2 or 1`;
module.exports = async (req, res) => {
  security.headers(res); if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ error: 'Method not allowed.' });
  if (!configured()) return res.status(503).json({ error: 'Jewelry service unavailable.' });
  try {
    if (!await security.rate(req, 'card-preferences', 80, 60)) return res.status(429).json({ error: 'Please wait a minute.' });
    if (req.method === 'POST' && !security.sameOrigin(req)) return res.status(403).json({ error: 'Open this screen on our website.' });
    let b = {}; if (req.method === 'POST') { try { b = security.body(req); } catch (_) { return res.status(400).json({ error: 'Invalid request.' }); } }
    const id = req.method === 'GET' ? req.query?.card : b.id; if (!goodId(id)) return res.status(400).json({ error: 'Invalid jewelry link.' });
    const actor = await auth.authorize(req, id); if (!actor) return res.status(401).json({ error: 'Sign in as this card’s owner or store staff.' });
    const card = await store.readCard(id); if (!card) return res.status(404).json({ error: 'Jewelry link not found.' });
    const owner = await auth.current(id);
    if (req.method === 'GET') {
      const audit = await command('XREVRANGE', auth.auditKey(id), '+', '-', 'COUNT', 30);
      const result = { id, role: actor.role, preview: store.preview, ...visibility.settings(card), linkedCoins: Object.keys(networks.entries(card)), handoff: card.handoff || null, owner: owner ? { email: owner.email, verified: Boolean(owner.verifiedAt) } : null, audit };
      if (store.preview && actor.role === 'staff') { const ids = await command('LRANGE', store.scope(`hog:jewelry:preview-mail:${id}`), 0, 4); result.previewEmails = await Promise.all((ids || []).map(async mid => auth.parse(await command('GET', mail.mailKey(mid))))); }
      return res.status(200).json(result);
    }
    if (b.action === 'assign-owner') {
      if (actor.role !== 'staff') return res.status(403).json({ error: 'Staff must verify and assign the card’s owner.' });
      const email = auth.email(b.email); if (!email) return res.status(400).json({ error: 'Enter a valid owner email.' });
      await store.ensureCard(id); const at = new Date().toISOString();
      const event = { type: 'owner-assigned', cardId: id, actor, at };
      const result = await command('EVAL', auth.ASSIGN, 3, store.cardKey(id), auth.ownerKey(id), auth.auditKey(id), email, auth.hash(email), crypto.randomBytes(16).toString('hex'), at, JSON.stringify(event));
      if (result < 0) return res.status(409).json({ error: 'An owner transfer after handoff requires a separate verified store process.' });
      return res.status(200).json({ success: true, preview: store.preview });
    }
    if (b.action === 'retry-notifications') { if (actor.role !== 'staff') return res.status(403).json({ error: 'Staff sign-in required.' }); return res.status(200).json({ processed: await mail.retry(id) }); }
    if (!['save', 'handoff'].includes(b.action)) return res.status(400).json({ error: 'Unknown action.' });
    let setting, choice = 'save';
    try {
      if (b.action === 'handoff') {
        if (actor.role !== 'staff') return res.status(403).json({ error: 'Only staff can complete handoff.' });
        if (!['keep-flex', 'private-coins', 'private-none'].includes(b.choice)) throw Error('Answer “Would you like the balances turned off?” before handoff.');
        choice = b.choice; setting = visibility.validate(choice === 'keep-flex' ? 'flex_all' : 'private', choice === 'private-coins' ? b.showCoins : Object.fromEntries(visibility.coins.map(c => [c, false])));
        if (choice === 'private-coins' && !Object.keys(networks.entries(card)).some(c => setting.showCoins[c.toLowerCase()])) throw Error('Choose at least one linked coin, or choose Private – show none.');
      } else setting = visibility.validate(b.balanceMode, b.showCoins);
    } catch (e) { return res.status(400).json({ error: e.message }); }
    await store.ensureCard(id); const now = Date.now(), at = new Date(now).toISOString(), messageId = crypto.randomUUID();
    const event = { type: b.action === 'handoff' ? 'handoff-completed' : 'visibility-changed', cardId: id, actor, at, notificationId: messageId, choice };
    const result = await command('EVAL', UPDATE, 5, store.cardKey(id), auth.ownerKey(id), auth.auditKey(id), mail.mailKey(messageId), mail.queueKey, actor.role, actor.version, JSON.stringify(setting), choice, actor.id, at, JSON.stringify(event), owner?.version || '', now, messageId);
    if (result < 0) return res.status(result === -2 ? 403 : 409).json({ error: result === -3 ? 'Verify the assigned owner email before turning a balance ON.' : result === -4 ? 'Handoff is already complete. Use the visibility controls for later changes.' : 'Unable to update this card.' });
    const notification = result === 2 ? await mail.deliver(messageId) : null;
    return res.status(200).json({ success: true, preview: store.preview, notification, ...setting });
  } catch (_) { return res.status(503).json({ error: 'Unable to update jewelry preferences. Please try again.' }); }
};
module.exports.UPDATE = UPDATE;
