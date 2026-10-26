(function () {
  'use strict';
  const output = document.getElementById('price-bitcoin');
  if (!output) return;
  async function update() {
    try {
      const response = await fetch('/api/bitcoin-price');
      if (!response.ok) throw new Error('Price unavailable');
      const data = await response.json(), time = Date.parse(data.quotedAt);
      if (!Number.isFinite(data.usd) || data.usd <= 0 || !Number.isFinite(time) || Date.now() - time > 900000 || time > Date.now() + 60000) throw new Error('Price outdated');
      output.textContent = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(data.usd);
      output.title = 'USD per Bitcoin · Price as of ' + new Date(time).toLocaleString() + ' · mempool.space';
    } catch (_) { output.textContent = 'Unavailable'; output.title = 'Bitcoin price temporarily unavailable'; }
  }
  update();
  setInterval(function () { if (!document.hidden) update(); }, 60000);
})();
