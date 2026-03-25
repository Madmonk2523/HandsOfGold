import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const token = process.env.GOLDAPI_ACCESS_TOKEN;

if (!token) {
  throw new Error('Missing GOLDAPI_ACCESS_TOKEN environment variable.');
}

const symbols = ['XAU', 'XAG', 'XPT'];
const baseUrl = 'https://www.goldapi.io/api';

const toNumber = (value) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return null;
  }

  return value;
};

const fetchPrice = async (symbol) => {
  const response = await fetch(`${baseUrl}/${symbol}/USD`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'x-access-token': token,
    },
  });

  if (!response.ok) {
    throw new Error(`GoldAPI request failed for ${symbol} with status ${response.status}`);
  }

  const payload = await response.json();
  const price = toNumber(payload?.price) || toNumber(payload?.ask) || toNumber(payload?.bid);
  if (!price) {
    throw new Error(`GoldAPI returned no usable price for ${symbol}`);
  }

  return price;
};

const run = async () => {
  const [xau, xag, xpt] = await Promise.all(symbols.map((symbol) => fetchPrice(symbol)));
  const updatedAtMs = Date.now();

  const output = {
    source: 'goldapi',
    currency: 'USD',
    updatedAtMs,
    prices: {
      XAU: xau,
      XAG: xag,
      XPT: xpt,
    },
  };

  const scriptPath = fileURLToPath(import.meta.url);
  const repoRoot = path.resolve(path.dirname(scriptPath), '..');
  const outputPath = path.join(repoRoot, 'data', 'metals.json');

  await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  console.log(`Updated ${outputPath}`);
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
