const KARAT_PURITY_VALUES = {
  10: 0.4167,
  14: 0.5833,
  18: 0.75,
};

const DEFAULT_SURCHARGE_PER_GRAM = 10;
const DEFAULT_MARGIN_DIVISOR = 0.65;
const DEFAULT_COMPARE_MULTIPLIER = 2.4;
// Temporary end-to-end Stripe test price for both Cuban products.
const TEST_RETAIL_PRICE_USD = 1;

const toPositiveNumber = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null;
  }

  return numeric;
};

const normalizeKarat = (value) => {
  const text = String(value || '').trim().toLowerCase();
  const digits = text.endsWith('k') ? text.slice(0, -1) : text;
  const normalized = Number.parseInt(digits, 10);

  if (!Number.isFinite(normalized)) {
    return null;
  }

  return normalized;
};

const resolvePurity = (karatOrPurity) => {
  const directPurity = toPositiveNumber(karatOrPurity);
  if (directPurity && directPurity <= 1) {
    return directPurity;
  }

  const karat = normalizeKarat(karatOrPurity);
  if (!karat) {
    return null;
  }

  return KARAT_PURITY_VALUES[karat] || null;
};

const roundToNearestFive = (value) => Math.round(value / 5) * 5;

const getPricingConfig = () => {
  const surchargePerGram =
    toPositiveNumber(process.env.RETAIL_SURCHARGE_PER_GRAM) || DEFAULT_SURCHARGE_PER_GRAM;
  const marginDivisor =
    toPositiveNumber(process.env.RETAIL_MARGIN_DIVISOR) || DEFAULT_MARGIN_DIVISOR;
  const compareMultiplier =
    toPositiveNumber(process.env.RETAIL_COMPARE_MULTIPLIER) || DEFAULT_COMPARE_MULTIPLIER;

  return {
    surchargePerGram,
    marginDivisor,
    compareMultiplier,
  };
};

const calculateRetailPrice = ({
  spotPricePerGram,
  karatOrPurity,
  weightGrams,
  config = getPricingConfig(),
}) => {
  const spot = toPositiveNumber(spotPricePerGram);
  const weight = toPositiveNumber(weightGrams);
  const purity = resolvePurity(karatOrPurity);

  if (!spot || !weight || !purity) {
    throw new Error('Invalid pricing inputs. spotPricePerGram, karat/purity, and weightGrams are required.');
  }

  const baseRetail = ((spot + config.surchargePerGram) * purity * weight) / config.marginDivisor;
  const roundedRetail = roundToNearestFive(baseRetail);
  const compareAtPrice = spot * purity * weight * config.compareMultiplier;

  return {
    retailPrice: TEST_RETAIL_PRICE_USD || roundedRetail,
    compareAtPrice: Number(compareAtPrice.toFixed(2)),
    inputs: {
      spotPricePerGram: spot,
      purity,
      weightGrams: weight,
      surchargePerGram: config.surchargePerGram,
      marginDivisor: config.marginDivisor,
      compareMultiplier: config.compareMultiplier,
    },
  };
};

module.exports = {
  KARAT_PURITY_VALUES,
  TEST_RETAIL_PRICE_USD,
  calculateRetailPrice,
  getPricingConfig,
  normalizeKarat,
  resolvePurity,
  toPositiveNumber,
};
