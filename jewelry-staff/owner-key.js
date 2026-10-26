'use strict';
(() => {
  const $ = id => document.getElementById(id); let ring, busy = false;
  function result(text, ok = false) {
    $('message').textContent = text; $('restore-result').textContent = text;
    $('restore-result').className = 'notice'; $('restore-result').dataset.result = ok ? 'success' : 'error';
  }
  function validate(data) {
    const r = data?.keyring;
    if (data?.kind !== 'hog-nfc-owner-keyring-v1' || data.environment !== 'production' || !r || !/^[A-Za-z0-9_-]{1,30}$/.test(r.active || '') || !r.keys || !Object.hasOwn(r.keys, r.active) || !Object.entries(r.keys).every(([k,v]) => /^[A-Za-z0-9_-]{1,30}$/.test(k) && typeof v === 'string' && /^[0-9a-f]{64}$/i.test(v) && !/^0+$/.test(v))) throw Error('This file is not a valid Hands of Gold owner-key backup. Choose the owner-keyring backup, not a per-tag backup.');
    return r;
  }
  $('create-key').onsubmit = async e => {
    e.preventDefault(); const button = e.submitter; button.disabled = true;
    try {
      if ($('pass').value !== $('repeat').value) throw Error('Passphrases do not match.');
      const fresh = { active: 'v1', keys: { v1: HOGBackup.randomHex(32) } };
      const backup = await HOGBackup.encrypt({ kind: 'hog-nfc-owner-keyring-v1', environment: 'production', keyring: fresh, createdAt: new Date().toISOString() }, $('pass').value);
      HOGBackup.download(backup, 'hands-of-gold-owner-keyring.encrypted.json'); ring = fresh;
      $('pass').value = ''; $('repeat').value = ''; $('created').hidden = false; $('saved').checked = false;
      $('message').textContent = 'Encrypted backup download requested. Confirm the file was saved, then test restoration below. The key has not been uploaded.';
    } catch (e) { $('message').textContent = e.message; } finally { button.disabled = false; }
  };
  async function restore(event) {
    event.preventDefault(); if (busy) return;
    busy = true; $('restore').disabled = true; $('restore').textContent = 'Checking encrypted backup…'; result('Checking your selected backup. Keep this page open.');
    try {
      const file = $('restore-file').files?.[0];
      if (!file) throw Error('Choose your encrypted owner backup file first. It is usually in Downloads.');
      if (file.size > 20000 || file.size === 0) throw Error('Choose a valid owner backup file smaller than 20 KB.');
      const passphrase = $('restore-pass').value;
      if (passphrase.length < 16 || passphrase.length > 256) throw Error('Enter the original backup passphrase (16 to 256 characters).');
      let encrypted; try { encrypted = JSON.parse(await file.text()); } catch (_) { throw Error('This file is not a readable JSON backup. Choose the downloaded encrypted owner-keyring file.'); }
      let data; try { data = await HOGBackup.decrypt(encrypted, passphrase); } catch (_) { throw Error('The backup could not be unlocked. Check the passphrase and that this is the matching, unmodified backup file. Your passphrase has been kept so you can correct it.'); }
      const restored = validate(data); ring = restored;
      $('created').hidden = false; $('saved').checked = false; $('restore-pass').value = '';
      result('Owner backup restored and checked locally. Your passphrase field was cleared after successful validation. No server settings were changed.', true);
      $('restore-result').scrollIntoView({ block: 'center', behavior: 'smooth' });
    } catch (e) { result(e.message); }
    finally { busy = false; $('restore').disabled = false; $('restore').textContent = 'Restore locally and verify backup'; }
  }
  $('restore-backup').onsubmit = restore;
  $('copy-key').onclick = async () => {
    try { if (!ring || !$('saved').checked) throw Error('Confirm that the encrypted backup is saved first.'); await navigator.clipboard.writeText(JSON.stringify(ring)); $('message').textContent = 'Copied. Paste directly into the Production Secret named NFC_KEYRING_JSON, then clear your clipboard.'; }
    catch (e) { $('message').textContent = e.message || 'Clipboard unavailable.'; }
  };
})();
