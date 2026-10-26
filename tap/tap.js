'use strict';
(() => {
  const params = new URLSearchParams(location.search), button = document.getElementById('verify'), status = document.getElementById('status'), result = document.getElementById('result');
  const valid = [...params.keys()].sort().join(',') === 'c,p,t' && /^[0-9a-f]{24}$/i.test(params.get('t') || '') && /^[0-9a-f]{32}$/i.test(params.get('p') || '') && /^[0-9a-f]{16}$/i.test(params.get('c') || '');
  const tap = valid ? Object.fromEntries(params) : null;
  history.replaceState(null, '', '/tap/');
  if (!tap) { status.textContent = 'No valid tap was supplied. Hold your phone near the original clasp again.'; return; }
  button.hidden = false;
  button.onclick = async () => {
    button.disabled = true; result.hidden = true; status.textContent = 'Checking this tap…';
    try {
      const response = await fetch('/api/nfc-verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(tap), cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw Error(data.error || 'Tag not verified. Please tap the clasp again.');
      if (data.testPassed) { status.textContent = 'Chip test passed'; result.textContent = data.message; result.hidden = false; button.hidden = true; return; }
      if (data.verified !== true || !/^\/bitcoin\/\?card=[a-f0-9]{32}$/.test(data.next || '')) throw Error('Tag not verified. Please tap again.');
      location.replace(data.next);
    } catch (e) { status.textContent = 'Verification was not completed'; result.textContent = e.message; result.hidden = false; button.hidden = true; }
  };
})();
