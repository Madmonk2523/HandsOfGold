import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const token = process.env.GOLD_API_TOKEN;

if (!token) {
  throw new Error('Missing GOLD_API_TOKEN environment variable.');
}

const symbols = ['XAU', 'XAG', 'XPT'];
const baseUrl = 'https://api.gold-api.com/price';
const maxAttempts = 4;
const requestTimeoutMs = 10000;

const toNumber = (value) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return null;
  }

  return value;
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchPrice = async (symbol, attempt = 1) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);

  try {
    const response = await fetch(`${baseUrl}/${symbol}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-access-token': token,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`gold-api.com request failed for ${symbol} with status ${response.status}`);
    }

    const payload = await response.json();
    const price = toNumber(payload?.price) || toNumber(payload?.ask) || toNumber(payload?.bid);
    if (!price) {
      throw new Error(`gold-api.com returned no usable price for ${symbol}`);
    }

    return price;
  } catch (error) {
    if (attempt >= maxAttempts) {
      throw error;
    }

    const backoffMs = 400 * 2 ** (attempt - 1);
    console.warn(`Attempt ${attempt} failed for ${symbol}. Retrying in ${backoffMs}ms...`);
    await wait(backoffMs);
    return fetchPrice(symbol, attempt + 1);
  } finally {
    clearTimeout(timeout);
  }
};

const readPreviousSnapshot = async (outputPath) => {
  try {
    const raw = await readFile(outputPath, 'utf8');
    const parsed = JSON.parse(raw);
    const prices = parsed?.prices || {};

    return {
      XAU: toNumber(prices.XAU),
      XAG: toNumber(prices.XAG),
      XPT: toNumber(prices.XPT),
    };
  } catch {
    return {
      XAU: null,
      XAG: null,
      XPT: null,
    };
  }
};

const run = async () => {
  const scriptPath = fileURLToPath(import.meta.url);
  const repoRoot = path.resolve(path.dirname(scriptPath), '..');
  const outputPath = path.join(repoRoot, 'data', 'metals.json');
  const previousPrices = await readPreviousSnapshot(outputPath);

  const results = await Promise.allSettled(symbols.map((symbol) => fetchPrice(symbol)));
  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      console.warn(`Using fallback price for ${symbols[index]}: ${result.reason?.message || result.reason}`);
    }
  });

  const prices = {
    XAU: results[0].status === 'fulfilled' ? results[0].value : previousPrices.XAU,
    XAG: results[1].status === 'fulfilled' ? results[1].value : previousPrices.XAG,
    XPT: results[2].status === 'fulfilled' ? results[2].value : previousPrices.XPT,
  };

  if (!prices.XAU || !prices.XAG || !prices.XPT) {
    throw new Error('Failed to build a complete metals snapshot after retries and fallback.');
  }

  const updatedAtMs = Date.now();

  const output = {
    source: 'gold-api.com',
    currency: 'USD',
    updatedAtMs,
    prices,
  };

  await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  console.log(`Updated ${outputPath}`);
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
