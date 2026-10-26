// Meta (Facebook/Instagram) product catalog feed for the Monaci Cuban line.
// URL: https://www.handsofgoldny.com/api/meta-feed
//
// Prices are calculated LIVE on every fetch with the same rule the Monaci page uses
// (classic-cuban-pricing.js, mode "melt"):
//   price = round5( (gold spot per gram x karat purity + $45) x catalog weight )
// Product list is read from /classic-cuban-data.js so there is one source of truth:
// change that file and the feed follows. Meta fetches this hourly.

const SITE = "https://www.handsofgoldny.com";
const OZ_TO_G = 31.1034768;
const PURITY = { "10K": 0.417, "14K": 0.585 };
const LABOR_PER_GRAM = 45;
const ROUND_TO = 5;

function csvCell(v) {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export default async function handler(request, response) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.setHeader("Allow", "GET, HEAD");
    return response.status(405).send("Method not allowed");
  }

  let spot = null;
  try {
    const r = await fetch("https://api.gold-api.com/price/XAU", {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(5000)
    });
    if (r.ok) {
      const d = await r.json();
      const p = Number(d.price);
      if (Number.isFinite(p) && p > 0) spot = p;
    }
  } catch (_) {}

  // No spot = no feed. Better for Meta to keep the last good prices than get wrong ones.
  if (!spot) {
    response.setHeader("Cache-Control", "no-store");
    return response.status(503).send("Gold price feed unavailable, try again later");
  }

  let products = [];
  try {
    const r = await fetch(`${SITE}/classic-cuban-data.js`, { signal: AbortSignal.timeout(5000) });
    const js = await r.text();
    const start = js.indexOf("[");
    const end = js.lastIndexOf("]");
    products = JSON.parse(js.slice(start, end + 1));
  } catch (_) {}

  if (!products.length) {
    response.setHeader("Cache-Control", "no-store");
    return response.status(503).send("Catalog data unavailable, try again later");
  }

  const header = [
    "id", "title", "description", "availability", "condition", "price",
    "link", "image_link", "brand", "item_group_id", "google_product_category",
    "product_type", "material", "size", "custom_label_0"
  ];
  const rows = [header.join(",")];

  for (const p of products) {
    for (const [karat, grams] of Object.entries(p.weights || {})) {
      const purity = PURITY[karat];
      if (!purity || !(grams > 0)) continue;
      const perGram = (spot / OZ_TO_G) * purity + LABOR_PER_GRAM;
      const price = Math.round((perGram * grams) / ROUND_TO) * ROUND_TO;

      const kind = p.type === "necklace" ? "Chain" : "Bracelet";
      const len = `${p.lengthIn}`;
      const title = `Monaci ${karat} Gold Cuban Link ${kind} - ${p.widthMm}mm, ${len} in`;
      const description =
        `Authentic Monaci ${karat} gold hollow Cuban link ${kind.toLowerCase()}, ` +
        `${p.widthMm}mm wide, ${len} inches long, approx. ${grams} grams. ` +
        `Priced live from today's gold spot price. Pick up at Hands of Gold, ` +
        `494 Oak St, Copiague, NY - family jeweler since 1983.`;
      const id = `${p.sku}-${karat}`;
      const link = `${SITE}/monaci-item.html?sku=${encodeURIComponent(p.sku)}&karat=${karat}`;

      rows.push([
        id, title, description, "available for order", "new", `${price.toFixed(2)} USD`,
        link, `${SITE}/${p.image}`, "Monaci", `${p.sku}`,
        "Apparel & Accessories > Jewelry", `Monaci Cuban > ${kind}s`,
        `${karat} Gold`, `${p.widthMm}mm x ${len}in`, kind
      ].map(csvCell).join(","));
    }
  }

  response.setHeader("Content-Type", "text/csv; charset=utf-8");
  response.setHeader("Cache-Control", "public, s-maxage=600, stale-while-revalidate=300");
  return response.status(200).send(rows.join("\n"));
}
