'use strict';
const el = id => document.getElementById(id);
const { coins, order, formatAtomic, receivePayload } = HOGCrypto;
let card = new URLSearchParams(location.search).get('card'), assets = {}, activeAsset = 'BTC', prices = {}, priceTime = {}, priceSource = {};
let pricePromise, priceRequestedAt = 0;
let staffSignedIn = false, verificationTimer;
const dollars = value => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
function error(message) { el('error').textContent = message; el('error').hidden = !message; }
async function staffStatus() {
  try { const r = await fetch('/api/jewelry-admin', { cache: 'no-store' }); staffSignedIn = r.ok && (await r.json()).staff === true; }
  catch (_) { staffSignedIn = false; }
  el('staff-signin').hidden = staffSignedIn; el('staff-tools-link').hidden = !staffSignedIn;
  el('staff-tools-link').href = '/jewelry-staff/' + (card ? '?card=' + card : '');
  el('start').hidden = !!card || !staffSignedIn; el('settings').hidden = !card || !staffSignedIn; el('add-coin').hidden = !staffSignedIn;
}
async function verificationStatus() {
  clearTimeout(verificationTimer); el('tag-verification').hidden = true;
  if (!card) return;
  try {
    const r = await fetch('/api/nfc-verify?card=' + card, { cache: 'no-store' }), v = await r.json();
    const remaining = Date.parse(v.expiresAt) - Date.now();
    if (!r.ok || v.verified !== true || remaining <= 0 || remaining > 301000) return;
    el('tag-verification').hidden = false;
    verificationTimer = setTimeout(() => { el('tag-verification').hidden = true; }, remaining);
  } catch (_) { /* A failed check must never leave a verified badge visible. */ }
}
async function api(body) {
  const response = await fetch(body ? '/api/bitcoin-card' : `/api/bitcoin-card?card=${encodeURIComponent(card)}&portfolio=1`, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : { cache: 'no-store' });
  const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Please try again.'); return data;
}
function priceValid(asset) { return Number.isFinite(prices[asset]) && prices[asset] > 0 && Date.now() - Date.parse(priceTime[asset]) < 900000 && Date.parse(priceTime[asset]) <= Date.now() + 60000; }
function balanceHidden(asset, entry) { return !!entry && (entry.balanceHidden === true || (asset === 'XRP' && entry.destinationTag !== undefined)); }
function estimate(asset, balance) {
  if (!priceValid(asset)) return null;
  const value = Number(formatAtomic(balance, asset).split(' ')[0]) * prices[asset];
  return Number.isFinite(value) ? dollars(value) : null;
}
function updatePrices() {
  el('header-btc-price').textContent = priceValid(activeAsset) ? `1 ${activeAsset} = ${dollars(prices[activeAsset])} USD` : `${activeAsset} price unavailable`;
  rootPrices();
  const entry = assets[activeAsset]; if (!entry?.balance || balanceHidden(activeAsset, entry)) return;
  const usd = estimate(activeAsset, entry.balance.confirmed);
  el('usd-value').textContent = usd === null ? 'Dollar estimate unavailable' : `≈ ${usd} USD`;
  el('usd-rate').textContent = usd === null ? 'Your coin balance is still shown.' : `Estimated value · ${priceSource[activeAsset]} · Quote checked ${new Date(priceTime[activeAsset]).toLocaleString()}`;
}
function rootPrices() {
  for (const button of el('coin-list').querySelectorAll('[data-asset]')) {
    const asset = button.dataset.asset, entry = assets[asset], target = button.querySelector('.coin-usd');
    target.textContent = entry?.balance && !balanceHidden(asset, entry) ? (estimate(asset, entry.balance.confirmed) || '') : '';
  }
}
function getPrices() {
  if (pricePromise && Date.now() - priceRequestedAt < 30000) return pricePromise;
  priceRequestedAt = Date.now();
  pricePromise = Promise.allSettled([
    (async () => { const r = await fetch('/api/bitcoin-price'); if (!r.ok) return; const q = await r.json(); prices.BTC = q.usd; priceTime.BTC = q.quotedAt; priceSource.BTC = 'mempool.space'; })(),
    (async () => { const r = await fetch('/api/crypto-prices'); if (!r.ok) return; const q = await r.json(); for (const asset of order.filter(a => a !== 'BTC')) { prices[asset] = q.prices?.[asset]; priceTime[asset] = q.quotedAt; priceSource[asset] = q.source; } })()
  ]).then(updatePrices); return pricePromise;
}
function configureForm(asset) {
  const coin = coins[asset], entry = assets[asset];
  el('asset').value = asset; el('address-label').textContent = `${coin.name} receiving address`;
  el('new-address').placeholder = coin.placeholder; el('new-address').value = entry?.address || '';
  el('tag-field').hidden = asset !== 'XRP'; el('destination-tag').value = entry?.destinationTag ?? '';
  el('destination-tag').disabled = asset !== 'XRP';
  el('setup-note').textContent = `Verify this ${coin.network} address in your wallet before saving. Native ${asset} only; other networks and tokens are not included.`;
}
function addCoin(asset) {
  if (!staffSignedIn) return;
  el('settings').hidden = false; el('settings').open = true;
  configureForm(asset || order.find(a => !assets[a]) || activeAsset);
  el('settings').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'nearest' });
}
function renderPortfolio() {
  const list = el('coin-list'); list.replaceChildren();
  for (const asset of order) {
    const entry = assets[asset], button = document.createElement('button');
    button.type = 'button'; button.className = 'coin-card'; button.dataset.asset = asset;
    button.setAttribute('aria-pressed', String(!!entry && asset === activeAsset));
    const label = document.createElement('span'); label.className = 'coin-name'; label.textContent = `${coins[asset].name} · ${asset}`;
    button.disabled = !entry && !staffSignedIn;
    const value = document.createElement('strong'); value.textContent = !entry ? staffSignedIn ? 'Add address' : 'Not linked' : balanceHidden(asset, entry) ? 'Balance not shown' : entry.balance ? formatAtomic(entry.balance.confirmed, asset).replace(/(\.\d*?[1-9])0+ |\.0+ /, '$1 ') : 'Balance unavailable';
    const usd = document.createElement('span'); usd.className = 'coin-usd';
    button.append(label, value, usd);
    button.addEventListener('click', () => { if (!entry) return addCoin(asset); activeAsset = asset; renderPortfolio(); showActive(); }); list.append(button);
  }
  rootPrices();
}
function showActive() {
  const coin = coins[activeAsset], entry = assets[activeAsset], hiddenBalance = balanceHidden(activeAsset, entry);
  el('coin-icon').textContent = coin.icon; el('network-badge').textContent = coin.network.toUpperCase();
  el('balance').hidden = !entry?.balance || hiddenBalance; el('receiving').hidden = !entry;
  el('balance-notice').hidden = !hiddenBalance;
  for (const id of ['confirmed', 'pending', 'total', 'usd-value', 'usd-rate', 'checked']) el(id).textContent = '';
  updatePrices(); if (!entry) return;
  el('receive-title').textContent = `Receive ${coin.name}`; el('address').textContent = entry.address;
  el('explorer').href = coin.explorer + encodeURIComponent(entry.address); el('explorer').textContent = `View ${activeAsset} account / transactions ↗`;
  el('qr').setAttribute('aria-label', `${coin.network} receiving QR code`);
  const qr = qrcode(0, 'M'); qr.addData(receivePayload(activeAsset, entry)); qr.make(); el('qr').innerHTML = qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
  el('xrp-tag-box').hidden = activeAsset !== 'XRP' || entry.destinationTag === undefined;
  el('saved-tag').textContent = entry.destinationTag ?? '';
  el('copy-address').textContent = activeAsset === 'XRP' && entry.destinationTag !== undefined ? 'Copy X-address (includes tag)' : 'Copy receiving address';
  el('network-note').textContent = activeAsset === 'XRP' ? hiddenBalance ? 'The receiving QR and X-address include your destination tag. Check your wallet or exchange app for your personal XRP balance.' : 'XRP balance is the entire account, including reserved XRP. It may be shared if this is an exchange deposit address. A new unfunded account can show zero.' : `Only receive native ${activeAsset} on ${coin.network}. Tokens and balances on other networks are not shown.`;
  el('status').textContent = entry.error ? `${activeAsset}: ${entry.error}` : 'Choose a linked coin for its address and receiving details.';
  if (!entry.balance || hiddenBalance) return;
  const b = entry.balance; el('balance-label').textContent = activeAsset === 'ETH' ? 'ON-CHAIN ETH BALANCE' : activeAsset === 'XRP' ? 'VALIDATED XRP ACCOUNT BALANCE' : 'CONFIRMED BALANCE';
  el('confirmed').textContent = formatAtomic(b.confirmed, activeAsset);
  el('pending-stats').hidden = b.pending === null;
  if (b.pending !== null) { el('pending').textContent = `${BigInt(b.pending) > 0n ? '+' : ''}${formatAtomic(b.pending, activeAsset)}`; el('total').textContent = formatAtomic(b.total, activeAsset); }
  el('checked').textContent = `Last checked ${new Date(b.checkedAt).toLocaleString()} · ${b.provider}`;
}
async function load() {
  error(''); el('refresh').disabled = true; el('status').textContent = 'Checking your linked coins…';
  try {
    const [data] = await Promise.all([api(), staffStatus()]); assets = data.assets || {};
    el('portfolio').hidden = false; el('settings').hidden = !staffSignedIn; el('start').hidden = true;
    el('card-link-box').hidden = false; el('card-link').value = `${location.origin}/bitcoin/?card=${card}`;
    if (!assets[activeAsset]) activeAsset = order.find(a => assets[a]) || 'BTC';
    if (!Object.keys(assets).length) { el('status').textContent = 'Contact the store to link your coin addresses.'; el('settings').open = staffSignedIn; }
    configureForm(activeAsset); renderPortfolio(); showActive();
    if (!Object.keys(assets).length) el('status').textContent = 'Contact the store to link your coin addresses.';
    verificationStatus();
    getPrices();
  } catch (e) { el('status').textContent = 'Unable to load your jewelry'; error(e.message); }
  finally { el('refresh').disabled = false; }
}
async function copy(value, button) {
  try { await navigator.clipboard.writeText(value); const old = button.textContent; button.textContent = 'Copied'; setTimeout(() => button.textContent = old, 2000); }
  catch (_) { error('Copy was unavailable. Select the text and copy it manually.'); }
}
el('create').onclick = async () => {
  el('create').disabled = true; error('');
  try { const r = await api({ action: 'create' }); card = r.id; history.replaceState(null, '', `/bitcoin/?card=${card}`); await load(); }
  catch (e) { error(e.message); } finally { el('create').disabled = false; }
};
el('setup').onsubmit = async event => {
  event.preventDefault(); error('');
  if (!staffSignedIn) { error('Staff sign-in required.'); return; }
  const button = event.submitter; button.disabled = true; const asset = el('asset').value;
  try { await api({ id: card, asset, address: el('new-address').value.trim(), ...(asset === 'XRP' ? { destinationTag: el('destination-tag').value.trim() } : {}) }); activeAsset = asset; el('settings').open = false; await load(); }
  catch (e) { error(e.message); } finally { button.disabled = false; }
};
el('asset').onchange = () => configureForm(el('asset').value);
el('refresh').onclick = load; el('add-coin').onclick = () => addCoin();
el('copy-link').onclick = e => copy(el('card-link').value, e.currentTarget);
el('copy-address').onclick = e => { const entry = assets[activeAsset]; if (entry) copy(entry.receiveAddress || entry.address, e.currentTarget); };
getPrices();
if (card) { if (/^[a-f0-9]{32}$/.test(card)) load(); else { el('status').textContent = 'Invalid jewelry link'; error('Check the jewelry link or contact Hands of Gold.'); } }
else { el('status').textContent = 'One jewelry link. Up to six coin addresses. Contact the store for setup.'; staffStatus(); }
window.addEventListener('focus', verificationStatus);
window.addEventListener('pageshow', verificationStatus);
