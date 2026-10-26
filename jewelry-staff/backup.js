'use strict';
window.HOGBackup = (() => {
  const text = new TextEncoder(), decode = new TextDecoder();
  const to64 = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes)));
  const from64 = value => Uint8Array.from(atob(value), c => c.charCodeAt(0));
  const randomHex = length => [...crypto.getRandomValues(new Uint8Array(length))].map(b => b.toString(16).padStart(2, '0')).join('');
  async function key(password, salt, usage) {
    if (typeof password !== 'string' || password.length < 16 || password.length > 256) throw Error('Use a backup passphrase of 16 to 256 characters.');
    const material = await crypto.subtle.importKey('raw', text.encode(password), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 600000 }, material, { name: 'AES-GCM', length: 256 }, false, usage);
  }
  async function encrypt(value, password) {
    const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
    const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: text.encode('HOG NFC backup v1') }, await key(password, salt, ['encrypt']), text.encode(JSON.stringify(value)));
    return { format: 'hog-nfc-backup-v1', kdf: 'PBKDF2-SHA256', iterations: 600000, salt: to64(salt), iv: to64(iv), data: to64(data) };
  }
  async function decrypt(value, password) {
    if (value.format !== 'hog-nfc-backup-v1' || value.iterations !== 600000 || value.kdf !== 'PBKDF2-SHA256' || JSON.stringify(value).length > 20000) throw Error('Unsupported backup.');
    const salt = from64(value.salt), iv = from64(value.iv); if (salt.length !== 16 || iv.length !== 12) throw Error('Invalid backup.');
    const data = await crypto.subtle.decrypt({ name: 'AES-GCM', iv, additionalData: text.encode('HOG NFC backup v1') }, await key(password, salt, ['decrypt']), from64(value.data));
    return JSON.parse(decode.decode(data));
  }
  function download(value, name) {
    const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
  return { randomHex, encrypt, decrypt, download };
})();
