'use strict';
const $ = id => document.getElementById(id);
let cardId = '', prepared = null, nfcConfigured = false;
const message = text => { $('message').textContent = text; };
async function request(url, data, method) {
  const r = await fetch(url, { method: method || (data ? 'POST' : 'GET'), cache: 'no-store', ...(data ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) } : {}) });
  const result = await r.json(); if (!r.ok) throw Error(result.error || 'Please try again.'); return result;
}
function parseCard(value) {
  let id = value.trim(); if (id.includes('://')) { const url = new URL(id); if (url.origin !== location.origin && url.origin !== 'https://www.handsofgoldny.com') throw Error('Use a Hands of Gold jewelry link.'); id = url.searchParams.get('card') || ''; }
  if (!/^[a-f0-9]{32}$/.test(id)) throw Error('Enter a valid jewelry link or card ID.'); return id;
}
async function status() {
  const s = await request('/api/jewelry-admin');
  $('login-panel').hidden = s.staff; $('tools').hidden = !s.staff;
  nfcConfigured = s.nfcConfigured === true; $('owner-needed').hidden = !s.staff || nfcConfigured;
  if (!s.staff) { prepared = null; $('access-code').value = ''; message('Sign in with your existing store staff credentials.'); return false; }
  message('Signed in. Load an existing jewelry link.'); return true;
}
async function loadCard() {
  const id = parseCard($('card').value), data = await request('/api/jewelry-admin?card=' + id);
  if (!data.staff) { await status(); return; }
  if (id !== cardId) { prepared = null; $('prepared').hidden = true; }
  cardId = id; nfcConfigured = data.nfcConfigured; $('owner-needed').hidden = nfcConfigured;
  $('card-summary').textContent = `${data.linkedCoins.join(', ') || 'No coins linked'} · ${data.tags.length} tag enrollment(s)`;
  $('wallet-link').href = '/bitcoin/?card=' + cardId; $('wallet-link').hidden = false;
  $('enroll-panel').hidden = !nfcConfigured; $('tag-list-panel').hidden = false;
  $('tag-list').replaceChildren();
  for (const tag of data.tags) {
    const box = document.createElement('div'); box.className = 'tag';
    const title = document.createElement('h3'); title.textContent = tag.state === 'active' ? 'Active tag' : tag.state === 'pending' ? 'Pending physical test / activation' : 'Revoked tag';
    const detail = document.createElement('p'); detail.textContent = `UID ${tag.uid} · Tag ${tag.tagId}${tag.lastTestAt ? ' · Test passed ' + new Date(tag.lastTestAt).toLocaleString() : ''}`;
    box.append(title, detail);
    const settingsButton = document.createElement('button'); settingsButton.className = 'secondary'; settingsButton.textContent = 'View programming settings';
    settingsButton.onclick = async () => { try { const r = await request('/api/jewelry-admin?profile=' + tag.tagId); let output = box.querySelector('textarea'); if (!output) { output = document.createElement('textarea'); output.readOnly = true; output.setAttribute('aria-label', 'Tag programming settings'); box.append(output); } output.value = JSON.stringify(r.settings, null, 2); } catch (e) { message(e.message); } }; box.append(settingsButton);
    if (tag.state === 'pending' && tag.lastTestAt) {
      const label = document.createElement('label'); label.className = 'consent'; const check = document.createElement('input'); check.type = 'checkbox'; const text = document.createElement('span'); text.textContent = 'I tested this physical tag inside the finished clasp and verified its programming access is protected.'; label.append(check, text); box.append(label);
      const activate = document.createElement('button'); activate.textContent = 'Activate this tag'; activate.disabled = true; check.onchange = () => { activate.disabled = !check.checked; };
      activate.onclick = () => change(tag, 'activate', activate); box.append(activate);
    }
    if (tag.state !== 'revoked') { const revoke = document.createElement('button'); revoke.className = 'secondary'; revoke.textContent = 'Revoke this tag'; revoke.onclick = () => { if (confirm('Remove verified status from this tag? Wallet addresses and jewelry links will stay unchanged.')) change(tag, 'revoke', revoke); }; box.append(revoke); }
    $('tag-list').append(box);
  }
  await HOGPreferences.load(cardId);
  message('Jewelry loaded.');
}
async function change(tag, action, button) {
  button.disabled = true;
  try { await request('/api/jewelry-admin', { action, cardId, tagId: tag.tagId, ...(action === 'activate' ? { physicalTestConfirmed: true } : {}) }); await loadCard(); }
  catch (e) { message(e.message); button.disabled = false; }
}
$('login').onsubmit = async e => {
  e.preventDefault(); const button = e.submitter; button.disabled = true;
  try { await request('/api/staff-auth', { email: $('email').value.trim(), accessCode: $('access-code').value }); $('access-code').value = ''; if (await status() && $('card').value) await loadCard(); }
  catch (e) { message(e.message); } finally { button.disabled = false; }
};
$('logout').onclick = async () => { try { await request('/api/staff-auth', null, 'DELETE'); prepared = null; $('backup-password').value = ''; $('backup-confirm').value = ''; $('recover-password').value = ''; await status(); } catch (e) { message(e.message); } };
$('find-card').onsubmit = e => { e.preventDefault(); loadCard().catch(e => message(e.message)); };
$('reload').onclick = () => loadCard().catch(e => message(e.message));
$('prepare').onsubmit = async e => {
  e.preventDefault(); const button = e.submitter; button.disabled = true;
  try {
    if (!cardId || !nfcConfigured) throw Error('Load a jewelry link and complete owner key setup first.');
    const uid = $('uid').value.trim().toUpperCase(); if (!/^04[0-9A-F]{12}$/.test(uid)) throw Error('Read the actual NTAG424 UID from the chip.');
    const pass = $('backup-password').value; if (pass !== $('backup-confirm').value) throw Error('Backup passphrases do not match.');
    const tagId = HOGBackup.randomHex(12), settings = (await request('/api/jewelry-admin?profile=' + tagId)).settings;
    const data = { kind: 'hog-ntag424-package-v1', cardId, tagId, uid, profile: settings.name, keys: { admin: HOGBackup.randomHex(16), meta: HOGBackup.randomHex(16), file: HOGBackup.randomHex(16) }, additionalAppKeys: { 3: HOGBackup.randomHex(16), 4: HOGBackup.randomHex(16) }, settings };
    const encrypted = await HOGBackup.encrypt(data, pass); HOGBackup.download(encrypted, 'hands-of-gold-tag-' + uid + '.encrypted.json');
    prepared = data; $('backup-password').value = ''; $('backup-confirm').value = ''; $('backup-saved').checked = false; $('prepared').hidden = false;
    message('Encrypted backup prepared. Confirm it is safely saved before registering.');
  } catch (e) { message(e.message); } finally { button.disabled = false; }
};
$('export-package').onclick = () => {
  if (!prepared || !$('backup-saved').checked) { message('Prepare or recover a package and confirm that its encrypted backup is saved.'); return; }
  if (confirm("Export this tag's secret programming keys for a trusted NTAG424 programmer? Keep the export out of chats and delete it after secure provisioning.")) HOGBackup.download(prepared, 'hands-of-gold-programmer-' + prepared.uid + '.private.json');
};
$('register').onclick = async () => {
  if (!prepared || prepared.cardId !== cardId || !$('backup-saved').checked) { message('Load the matching jewelry link and confirm that the encrypted backup is saved.'); return; }
  $('register').disabled = true;
  try { await request('/api/jewelry-admin', { action: 'enroll', cardId, tagId: prepared.tagId, uid: prepared.uid, profile: prepared.profile, keys: prepared.keys }); prepared = null; $('prepared').hidden = true; await loadCard(); message('Registered for testing. Program the physical chip with its encrypted package and a compatible secure provisioning tool, then tap it and choose Verify this tap.'); }
  catch (e) { message(e.message); } finally { $('register').disabled = false; }
};
$('recover').onclick = async () => {
  try {
    const file = $('recover-file').files[0]; if (!file || file.size > 20000) throw Error('Choose a valid encrypted tag backup.');
    const data = await HOGBackup.decrypt(JSON.parse(await file.text()), $('recover-password').value); $('recover-password').value = '';
    if (data.kind !== 'hog-ntag424-package-v1' || data.cardId !== cardId) throw Error('Load the jewelry link matching this backup.');
    prepared = data; $('backup-saved').checked = false; $('prepared').hidden = false; $('enroll-panel').hidden = !nfcConfigured; message('Package opened locally. Existing tag enrollment, if present, will be preserved.');
  } catch (_) { message('Could not open this backup. Check the passphrase and matching jewelry link.'); }
};
const initial = new URLSearchParams(location.search).get('card'); if (initial && /^[a-f0-9]{32}$/.test(initial)) $('card').value = initial;
status().then(ok => { if (ok && $('card').value) return loadCard(); }).catch(e => message(e.message));
