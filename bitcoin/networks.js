(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.HOGCrypto = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const coins = {
    BTC: { name: 'Bitcoin', network: 'Bitcoin mainnet', decimals: 8, icon: '₿', placeholder: 'bc1… or a Bitcoin address beginning with 1 or 3', provider: 'mempool.space', explorer: 'https://mempool.space/address/' },
    ETH: { name: 'Ethereum', network: 'Ethereum mainnet', decimals: 18, icon: 'Ξ', placeholder: '0x… (Ethereum mainnet only)', provider: 'PublicNode', explorer: 'https://etherscan.io/address/' },
    SOL: { name: 'Solana', network: 'Solana mainnet', decimals: 9, icon: '◎', placeholder: 'Your Solana wallet address', provider: 'PublicNode', explorer: 'https://explorer.solana.com/address/' },
    LTC: { name: 'Litecoin', network: 'Litecoin mainnet', decimals: 8, icon: 'Ł', placeholder: 'ltc1… or a Litecoin receiving address', provider: 'BlockCypher', explorer: 'https://live.blockcypher.com/ltc/address/' },
    DOGE: { name: 'Dogecoin', network: 'Dogecoin mainnet', decimals: 8, icon: 'Ð', placeholder: 'Your Dogecoin receiving address', provider: 'BlockCypher', explorer: 'https://live.blockcypher.com/doge/address/' },
    XRP: { name: 'XRP', network: 'XRP Ledger mainnet', decimals: 6, icon: 'X', placeholder: 'r… classic address or mainnet X-address', provider: 'XRP Ledger public server', explorer: 'https://livenet.xrpl.org/accounts/' }
  };
  function formatAtomic(value, asset) {
    if (!coins[asset] || !/^-?\d+$/.test(String(value))) throw new Error('Invalid coin amount.');
    const n = BigInt(value), negative = n < 0n, abs = negative ? -n : n, d = coins[asset].decimals;
    const text = abs.toString().padStart(d + 1, '0');
    return `${negative ? '-' : ''}${text.slice(0, -d)}.${text.slice(-d)} ${asset}`;
  }
  function receivePayload(asset, entry) {
    const value = entry.receiveAddress || entry.address;
    if (asset === 'BTC') return `bitcoin:${value}`;
    if (asset === 'ETH') return `ethereum:${value}@1`;
    if (asset === 'SOL') return `solana:${value}`;
    if (asset === 'LTC') return `litecoin:${value}`;
    if (asset === 'DOGE') return `dogecoin:${value}`;
    return value;
  }
  return { coins, order: Object.keys(coins), formatAtomic, receivePayload };
});
