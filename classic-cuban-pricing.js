window.HOG_CLASSIC_CUBAN_PRICING = {
  retailEnabled: true,
  // 14K retail rates per gram, applied to the whole catalog weight.
  // Exactly 10g enters the second tier; exactly 30g enters the third;
  // exactly 55g remains in the third tier. Totals round only to cents.
  weightRates: {
    "14K": [
      { lt: 10, rate: 155 },
      { lt: 30, rate: 140 },
      { lte: 55, rate: 127 },
      { rate: 120 }
    ]
  },
  // Other karats retain their existing market-based pricing.
  mode: "melt",
  laborPerGram: 45,
  markupPercent: 0,
  flatFee: 0,
  roundTo: 5,
  maxAutoPrice: null,
  quoteMinutes: 25,
  recordHighRef: 5500,
  spotPlusPerGram: 45,
  spotPlusKarats: ["10K", "14K"],
  retailPerGram: { "10K": null, "14K": null }
};
