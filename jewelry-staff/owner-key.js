'use strict';
(() => {
  const $ = id => document.getElementById(id); let ring;
  $('create-key').onsubmit = async e => {
    e.preventDefault(); e.submitter.disabled = true;
    try {
      if ($('pass').value !== $('repeat').value) throw Error('Passphrases do not match.');
      ring = { active: 'v1', keys: { v1: HOGBackup.randomHex(32) } };
      const backup = await HOGBackup.encrypt({ kind: 'hog-nfc-owner-keyring-v1', environment: 'production', keyring: ring, createdAt: new Date().toISOString() }, $('pass').value);
      HOGBackup.download(backup, 'hands-of-gold-owner-keyring.encrypted.json'); $('pass').value = ''; $('repeat').value = ''; $('created').hidden = false; $('saved').checked = false;
      $('message').textContent = 'Encrypted backup downloaded. The key has not been uploaded.';
    } catch (e) { ring = null; $('message').textContent = e.message; } finally { e.submitter.disabled = false; }
  };
  $('restore').onclick = async () => {
    try {
      const file = $('restore-file').files[0]; if (!file || file.size > 20000) throw Error('Choose a valid owner backup.');
      const data = await HOGBackup.decrypt(JSON.parse(await file.text()), $('restore-pass').value); $('restore-pass').value = '';
      const r = data.keyring;
      if (data.kind !== 'hog-nfc-owner-keyring-v1' || data.environment !== 'production' || !r || !/^[A-Za-z0-9_-]{1,30}$/.test(r.active || '') || !r.keys || !Object.hasOwn(r.keys, r.active) || !Object.values(r.keys).every(v => typeof v === 'string' && /^[0-9a-f]{64}$/i.test(v) && !/^0+$/.test(v))) throw Error('Invalid owner keyring.');
      ring = r; $('created').hidden = false; $('saved').checked = false; $('message').textContent = 'Owner backup restored and checked locally. No server settings were changed.';
    } catch (_) { ring = null; $('message').textContent = 'Could not restore this backup. Check its file and passphrase.'; }
  };
  $('copy-key').onclick = async () => {
    try { if (!ring || !$('saved').checked) throw Error('Confirm that the encrypted backup is saved first.'); await navigator.clipboard.writeText(JSON.stringify(ring)); $('message').textContent = 'Copied. Paste directly into the Production Secret named NFC_KEYRING_JSON, then clear your clipboard.'; }
    catch (e) { $('message').textContent = e.message || 'Clipboard unavailable.'; }
  };
})();
