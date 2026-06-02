const path = require('node:path');
const { readFile } = require('node:fs/promises');
const {
  calculateRetailPrice,
  getPricingConfig,
  toPositiveNumber,
} = require('./lib/pricing');

const TROY_OUNCE_TO_GRAMS = 31.1035;

const loadSpotPricePerGram = async () => {
  const metalsPath = path.join(process.cwd(), 'data', 'metals.json');
  const raw = await readFile(metalsPath, 'utf8');
  const parsed = JSON.parse(raw);
  const xauPerOunce = toPositiveNumber(parsed?.prices?.XAU);

  if (!xauPerOunce) {
    throw new Error('Metals snapshot missing valid XAU spot price.');
  }

  return xauPerOunce / TROY_OUNCE_TO_GRAMS;
};

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      spotPricePerGram,
      karat,
      purity,
      weightGrams,
      sku,
    } = req.body || {};

    const config = getPricingConfig();
    const resolvedSpot =
      toPositiveNumber(spotPricePerGram) || (await loadSpotPricePerGram());

    const pricing = calculateRetailPrice({
      spotPricePerGram: resolvedSpot,
      karatOrPurity: purity || karat,
      weightGrams,
      config,
    });

    return res.status(200).json({
      ok: true,
      sku: String(sku || '').trim() || null,
      spotSource: toPositiveNumber(spotPricePerGram) ? 'request' : 'metals-snapshot',
      ...pricing,
    });
  } catch (error) {
    console.error('Retail pricing calculation failed:', error);
    return res.status(400).json({
      error: error instanceof Error ? error.message : 'Failed to calculate retail price.',
    });
  }
};
