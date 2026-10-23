'use strict';
const el = id => document.getElementById(id);
let card = new URLSearchParams(location.search).get('card');
let savedAddress = '';
const btc = sats => `${(sats / 100000000).toFixed(8)} BTC`;
const dollars = value => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
async function showDollarValue(sats) {
  el('usd-value').textContent = 'Checking dollar value…'; el('usd-rate').textContent = '';
  try {
    const response = await fetch('/api/bitcoin-price');
    if (!response.ok) throw new Error('Price unavailable');
    const price = await response.json();
    const time = Date.parse(price.quotedAt);
    if (!Number.isFinite(price.usd) || price.usd <= 0 || !Number.isFinite(time) || Date.now() - time > 900000 || time > Date.now() + 60000) throw new Error('Price outdated');
    el('usd-value').textContent = `≈ ${dollars((sats / 100000000) * price.usd)} USD`;
    el('usd-rate').textContent = `Estimated confirmed value · 1 BTC = ${dollars(price.usd)} USD · Price as of ${new Date(time).toLocaleString()} · mempool.space`;
  } catch (_) { el('usd-value').textContent = 'Dollar estimate unavailable'; el('usd-rate').textContent = 'Your Bitcoin balance is still shown. Refresh to try the dollar estimate again.'; }
}
function error(message) { el('error').textContent = message; el('error').hidden = !message; }
async function api(body) {
  const response = await fetch(body ? '/api/bitcoin-card' : `/api/bitcoin-card?card=${encodeURIComponent(card)}`, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : { cache: 'no-store' });
  const data = await response.json();
  if (!response.ok) { if (data.address) showAddress(data.address); throw new Error(data.error || 'Please try again.'); }
  return data;
}
function showLink() { el('card-link-box').hidden = false; el('card-link').value = `${location.origin}/bitcoin/?card=${card}`; }
function showAddress(value) {
  el('card-link-box').hidden = true;
  el('start').hidden = true;
  el('issued').hidden = true;
  el('issued-code').value = '';
  el('settings').hidden = false;
  document.querySelector('.intro > p:last-child').textContent = 'Your Bitcoin balance and estimated dollar value, one tap away.';
  savedAddress = value; el('receiving').hidden = false; el('address').textContent = value;
  el('new-address').value = value; el('explorer').href = `https://mempool.space/address/${encodeURIComponent(value)}`;
  const qr = qrcode(0, 'M'); qr.addData(`bitcoin:${value}`); qr.make();
  el('qr').innerHTML = qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
}
async function load() {
  error(''); el('refresh').disabled = true;
  el('balance').hidden = true; el('status').textContent = 'Checking your jewelry…';
  try {
    const data = await api();
    el('settings').hidden = false;
    if (!data.address) { showLink(); el('status').textContent = 'Ready to link your Bitcoin address.'; el('settings').open = true; return; }
    showAddress(data.address); el('balance').hidden = false;
    el('confirmed').textContent = btc(data.confirmed);
    el('pending').textContent = `${data.pending > 0 ? '+' : ''}${btc(data.pending)}`;
    el('total').textContent = btc(data.total);
    el('checked').textContent = `Last checked ${new Date(data.checkedAt).toLocaleString()}`;
    el('status').textContent = 'Your linked address';
    await showDollarValue(data.confirmed);
  } catch (e) { el('status').textContent = 'Balance unavailable'; error(e.message); }
  finally { el('refresh').disabled = false; }
}
async function copy(value, button) {
  try { await navigator.clipboard.writeText(value); const old = button.textContent; button.textContent = 'Copied'; setTimeout(() => button.textContent = old, 2000); }
  catch (_) { error('Copy was unavailable. Select the text and copy it manually.'); }
}
el('create').onclick = async () => {
  el('create').disabled = true; error('');
  try {
    const result = await api({ action: 'create' }); card = result.id;
    history.replaceState(null, '', `/bitcoin/?card=${card}`);
    el('start').hidden = true; el('issued').hidden = false;
    el('issued-code').value = result.editCode; el('edit-code').value = result.editCode;
    await load();
  } catch (e) { error(e.message); } finally { el('create').disabled = false; }
};
el('setup').onsubmit = async event => {
  event.preventDefault(); error('');
  if (!el('issued').hidden && !el('code-saved').checked) { error('Save your setup code and check the confirmation before continuing.'); return; }
  const button = event.submitter; button.disabled = true;
  try {
    await api({ id: card, editCode: el('edit-code').value.trim(), address: el('new-address').value.trim() });
    el('edit-code').value = ''; el('settings').open = false; el('issued').hidden = true; el('issued-code').value = '';
    await load();
  } catch (e) { error(e.message); } finally { button.disabled = false; }
};
el('refresh').onclick = load;
el('copy-code').onclick = event => copy(el('issued-code').value, event.currentTarget);
el('copy-link').onclick = event => copy(el('card-link').value, event.currentTarget);
el('copy-address').onclick = event => copy(savedAddress, event.currentTarget);
if (card) { if (/^[a-f0-9]{32}$/.test(card)) load(); else { el('status').textContent = 'Invalid jewelry link'; error('Check the jewelry link or contact Hands of Gold.'); } }
else { el('status').textContent = 'Tap your jewelry to show your Bitcoin balance.'; el('start').hidden = false; }
