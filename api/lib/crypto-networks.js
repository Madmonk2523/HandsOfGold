'use strict';
const bitcoin = require('bitcoinjs-lib');
const { keccak_256 } = require('@noble/hashes/sha3');
const xrp = require('./xrp-address-codec.cjs');
const JSONbig = require('json-bigint')({ storeAsString: true, strict: true });
const { coins, order } = require('../../bitcoin/networks');
const litecoin = { ...bitcoin.networks.bitcoin, bech32: 'ltc', pubKeyHash: 48, scriptHash: 50, wif: 176 };
const dogecoin = { ...bitcoin.networks.bitcoin, bech32: 'doge', pubKeyHash: 30, scriptHash: 22, wif: 158 };
const integer = (v, signed = false) => {
  if ((typeof v === 'number' && !Number.isSafeInteger(v)) || !new RegExp(signed ? '^-?\\d+$' : '^\\d+$').test(String(v))) throw new Error('Invalid balance response.');
  return BigInt(v).toString();
};
function normalize(asset, value, destinationTag) {
  if (typeof asset !== 'string' || !Object.hasOwn(coins, asset) || typeof value !== 'string' || value.length > 120) throw new Error('Choose a supported coin and enter its mainnet receiving address.');
  let address = value.trim();
  if (asset !== 'XRP' && destinationTag !== undefined && destinationTag !== null && destinationTag !== '') throw new Error('Destination tags are only used with XRP.');
  try {
    if (['BTC', 'LTC', 'DOGE'].includes(asset)) {
      if (/^(bc1|ltc1)/i.test(address) && (address === address.toUpperCase() || address === address.toLowerCase())) address = address.toLowerCase();
      const network = asset === 'BTC' ? bitcoin.networks.bitcoin : asset === 'LTC' ? litecoin : dogecoin;
      try { bitcoin.address.toOutputScript(address, network); }
      catch (error) { if (asset !== 'LTC' || !address.startsWith('3')) throw error; bitcoin.address.toOutputScript(address, { ...litecoin, scriptHash: 5 }); }
    } else if (asset === 'ETH') {
      if (!/^0x[0-9a-fA-F]{40}$/.test(address)) throw new Error();
      const raw = address.slice(2), lower = raw.toLowerCase();
      const hash = Buffer.from(keccak_256(Buffer.from(lower, 'ascii'))).toString('hex');
      const checksum = [...lower].map((c, i) => parseInt(hash[i], 16) >= 8 ? c.toUpperCase() : c).join('');
      if (raw !== lower && raw !== raw.toUpperCase() && raw !== checksum) throw new Error();
      address = '0x' + checksum;
    } else if (asset === 'SOL') {
      const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
      if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) throw new Error();
      let n = 0n; for (const c of address) n = n * 58n + BigInt(alphabet.indexOf(c));
      let bytes = 0; for (let v = n; v > 0; v >>= 8n) bytes++;
      bytes += address.match(/^1*/)[0].length;
      if (bytes !== 32) throw new Error();
    } else {
      let tag = destinationTag === '' || destinationTag === undefined || destinationTag === null ? false : destinationTag;
      if (tag !== false && (!/^\d{1,10}$/.test(String(tag)) || BigInt(tag) > 4294967295n)) throw new Error('Enter an XRP destination tag from 0 to 4294967295.');
      tag = tag === false ? false : Number(tag);
      if (xrp.isValidXAddress(address)) {
        const decoded = xrp.xAddressToClassicAddress(address);
        if (decoded.test) throw new Error('Use an XRP mainnet address, not a testnet X-address.');
        if (tag !== false && decoded.tag !== tag) throw new Error('The destination tag does not match this X-address.');
        tag = decoded.tag; address = decoded.classicAddress;
      } else if (!xrp.isValidClassicAddress(address)) throw new Error();
      return { address, ...(tag !== false ? { destinationTag: String(tag), receiveAddress: xrp.classicAddressToXAddress(address, tag, false) } : {}) };
    }
  } catch (e) {
    if (/destination tag|testnet X-address/.test(e.message)) throw e;
    throw new Error(`Enter a valid ${coins[asset].network} receiving address. Other networks are not supported.`);
  }
  return { address };
}
async function request(url, body) {
  const response = await fetch(url, { method: body ? 'POST' : 'GET', signal: AbortSignal.timeout(8000), headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  if (!response.ok) throw new Error('Balance service unavailable.');
  const text = await response.text();
  if (text.length > 1500000) throw new Error('Balance response too large.');
  return JSONbig.parse(text);
}
function utxoBalance(data) {
  const sum = name => {
    const s = data[name]; if (!s) throw new Error('Invalid balance response.');
    const n = BigInt(integer(s.funded_txo_sum)) - BigInt(integer(s.spent_txo_sum));
    if (name === 'chain_stats' && n < 0n) throw new Error('Invalid balance response.');
    return n;
  };
  const confirmed = sum('chain_stats'), pending = sum('mempool_stats');
  return { confirmed: confirmed.toString(), pending: pending.toString(), total: (confirmed + pending).toString() };
}
async function getBalance(asset, address) {
  let balance;
  if (asset === 'BTC') {
    balance = utxoBalance(await request(`https://mempool.space/api/address/${encodeURIComponent(address)}`));
  } else if (asset === 'LTC' || asset === 'DOGE') {
    const data = await request(`https://api.blockcypher.com/v1/${asset.toLowerCase()}/main/addrs/${encodeURIComponent(address)}/balance`);
    const confirmed = integer(data.balance), pending = integer(data.unconfirmed_balance, true), total = integer(data.final_balance);
    if (BigInt(confirmed) + BigInt(pending) !== BigInt(total)) throw new Error('Invalid balance response.');
    balance = { confirmed, pending, total };
  } else if (asset === 'ETH') {
    const data = await request('https://ethereum-rpc.publicnode.com', { jsonrpc: '2.0', id: 1, method: 'eth_getBalance', params: [address, 'latest'] });
    if (data.error || typeof data.result !== 'string' || !/^0x[0-9a-f]+$/i.test(data.result)) throw new Error('Invalid balance response.');
    balance = { confirmed: BigInt(data.result).toString(), pending: null, total: BigInt(data.result).toString() };
  } else if (asset === 'SOL') {
    const data = await request('https://solana-rpc.publicnode.com', { jsonrpc: '2.0', id: 1, method: 'getBalance', params: [address, { commitment: 'confirmed' }] });
    if (data.error || !data.result || !data.result.context) throw new Error('Invalid balance response.');
    const confirmed = integer(data.result.value); balance = { confirmed, pending: null, total: confirmed };
  } else if (asset === 'XRP') {
    const data = await request('https://xrplcluster.com', { method: 'account_info', params: [{ account: address, ledger_index: 'validated' }] });
    const result = data.result;
    if (!result || result.validated !== true) throw new Error('Invalid ledger response.');
    if (result.error === 'actNotFound') balance = { confirmed: '0', pending: null, total: '0', accountStatus: 'unfunded' };
    else {
      if (result.error || result.status === 'error' || result.account_data?.Account !== address) throw new Error('Invalid balance response.');
      const confirmed = integer(result.account_data.Balance); balance = { confirmed, pending: null, total: confirmed };
    }
  } else throw new Error('Unsupported coin.');
  return { ...balance, checkedAt: new Date().toISOString(), provider: coins[asset].provider };
}
function entries(record) {
  const result = Object.create(null);
  for (const asset of order) {
    const item = record.addresses?.[asset];
    if (item?.address) result[asset] = item;
  }
  if (!result.BTC && record.address) result.BTC = { address: record.address };
  return result;
}
module.exports = { normalize, getBalance, utxoBalance, integer, entries, coins, order };
