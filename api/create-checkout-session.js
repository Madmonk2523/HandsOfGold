const path = require('node:path');
const { readFile } = require('node:fs/promises');
const Stripe = require('stripe');
const {
  calculateRetailPrice,
  getPricingConfig,
  toPositiveNumber,
} = require('./lib/pricing');

const TROY_OUNCE_TO_GRAMS = 31.1035;

const loadCatalog = async () => {
  const catalogPath = path.join(process.cwd(), 'data', 'cuban-catalog.json');
  const raw = await readFile(catalogPath, 'utf8');
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed?.variants) ? parsed.variants : [];
};

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

const normalizeVariant = (variant) => ({
  product: String(variant?.product || '').trim().toLowerCase(),
  width: String(variant?.width || '').trim(),
  length: String(variant?.length || '').trim(),
  karat: String(variant?.karat || '').trim().toUpperCase(),
  weightGrams: toPositiveNumber(variant?.weightGrams),
  sku: String(variant?.sku || '').trim(),
});

const parseCartKey = (value) => {
  const [product, width, length, karat] = String(value || '').split('|');
  return {
    product: String(product || '').trim().toLowerCase(),
    width: String(width || '').trim(),
    length: String(length || '').trim(),
    karat: String(karat || '').trim().toUpperCase(),
  };
};

const quantityToInt = (value) => {
  const parsed = Number.parseInt(String(value || ''), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
};

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const secretKey = String(process.env.STRIPE_SECRET_KEY || '').trim();
  if (!secretKey) {
    return res.status(500).json({ error: 'Missing STRIPE_SECRET_KEY environment variable.' });
  }

  try {
    const stripe = new Stripe(secretKey);
    const bodyItems = Array.isArray(req.body?.items) ? req.body.items : [];

    if (!bodyItems.length) {
      return res.status(400).json({ error: 'Cart is empty.' });
    }

    const variants = (await loadCatalog()).map(normalizeVariant);
    const pricingConfig = getPricingConfig();
    const spotPricePerGram = await loadSpotPricePerGram();

    const lineItems = bodyItems.map((item) => {
      const requested = parseCartKey(item?.key);
      const quantity = quantityToInt(item?.quantity);

      if (!requested.product || !requested.width || !requested.length || !requested.karat || !quantity) {
        throw new Error('Invalid cart payload.');
      }

      const variant = variants.find((entry) =>
        entry.product === requested.product
        && entry.width === requested.width
        && entry.length === requested.length
        && entry.karat === requested.karat
      );

      if (!variant || !variant.weightGrams) {
        throw new Error('One or more cart items are no longer available.');
      }

      const pricing = calculateRetailPrice({
        spotPricePerGram,
        karatOrPurity: variant.karat,
        weightGrams: variant.weightGrams,
        config: pricingConfig,
      });

      const unitAmountCents = Math.round(pricing.retailPrice * 100);
      const productTypeName = variant.product === 'bracelet' ? 'Classic Cuban Link Bracelet' : 'Classic Cuban Link Necklace';
      const variantLabel = `${variant.width} | ${variant.length} | ${variant.karat}`;

      return {
        quantity,
        price_data: {
          currency: 'usd',
          unit_amount: unitAmountCents,
          product_data: {
            name: `${productTypeName} (${variantLabel})`,
            metadata: {
              sku: variant.sku || '',
              product: variant.product,
              width: variant.width,
              length: variant.length,
              karat: variant.karat,
              weightGrams: String(variant.weightGrams),
            },
          },
        },
      };
    });

    const siteUrlFromEnv = String(process.env.SITE_URL || '').trim();
    const fallbackOrigin = String(req.headers.origin || '').trim();
    const baseUrl = siteUrlFromEnv || fallbackOrigin;

    if (!baseUrl) {
      return res.status(500).json({
        error: 'Missing SITE_URL environment variable. Set SITE_URL to your public domain.',
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: lineItems,
      success_url: `${baseUrl}/checkout-success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/checkout-cancel.html`,
      billing_address_collection: 'required',
      phone_number_collection: {
        enabled: true,
      },
      metadata: {
        sourcePath: String(req.body?.sourcePath || '').trim(),
      },
    });

    return res.status(200).json({
      ok: true,
      sessionId: session.id,
      url: session.url || null,
    });
  } catch (error) {
    console.error('Stripe checkout session creation failed:', error);
    return res.status(400).json({
      error: error instanceof Error ? error.message : 'Failed to start checkout session.',
    });
  }
};
