'use strict';
const coins = ['btc', 'eth', 'sol', 'ltc', 'doge', 'xrp'];
function settings(record) {
  const balanceMode = record.balanceMode === 'private' ? 'private' : 'flex_all';
  return { balanceMode, showCoins: Object.fromEntries(coins.map(coin => [coin, record.showCoins?.[coin] === true])) };
}
function reason(record, asset, entry) {
  if (asset === 'XRP' && entry?.destinationTag !== undefined) return 'tagged-xrp';
  const s = settings(record); return s.balanceMode === 'private' && s.showCoins[asset.toLowerCase()] !== true ? 'owner-private' : null;
}
function validate(balanceMode, showCoins) {
  if (!['flex_all', 'private'].includes(balanceMode) || !showCoins || typeof showCoins !== 'object' || Array.isArray(showCoins) || Object.keys(showCoins).sort().join(',') !== [...coins].sort().join(',') || !coins.every(c => typeof showCoins[c] === 'boolean')) throw Error('Choose a valid balance mode and coin visibility.');
  return { balanceMode, showCoins: Object.fromEntries(coins.map(c => [c, showCoins[c]])) };
}
module.exports = { coins, settings, reason, validate };
