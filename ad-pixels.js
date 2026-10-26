/* Hands of Gold - Meta (Facebook/Instagram) Pixel + TikTok Pixel (Oct 2026).
   Runs on every customer page: pwa.js (on almost every page) loads it, and the
   few pages without pwa.js include it directly. Staff/admin pages are skipped.
   A page that includes it twice still only initialises once.

   Nothing loads until an ID is filled in below. The pages already report their
   steps to window.dataLayer; this file listens to those pushes (and to a few
   clicks) and sends the matching standard events:

     every page ......................... PageView / page
     grillz.html, product pages,
     product_detail_open ................ ViewContent / ViewContent
     tel: / sms: link taps .............. Contact / Contact
     Google Maps directions taps ........ FindLocation / (Meta only)
     Buy Now (Stripe) taps,
     begin_checkout (Monaci),
     deposit_redirect,
     grillz_full_checkout_redirect ...... InitiateCheckout / InitiateCheckout
     deposit_lead_success,
     grillz_design_text_me,
     service_form_success,
     custom_order_request_success,
     gold_estimate_text_request ......... Lead / SubmitForm
     signup_complete (10% coupon) ....... CompleteRegistration / CompleteRegistration
     purchase_confirmed ................. Purchase / CompletePayment

   No names, phone numbers or emails are passed to either pixel from here. */
(function () {
  "use strict";

  var META_PIXEL_ID = "836019534029701"; // Meta Events Manager → Data sources (Hands of Gold)
  var TIKTOK_PIXEL_ID = ""; // e.g. "C1234ABCD5678EFGH" (TikTok Ads Manager → Assets → Events)

  var meta = /^\d{10,20}$/.test(META_PIXEL_ID);
  var tiktok = /^[A-Z0-9]{10,30}$/.test(TIKTOK_PIXEL_ID);
  if (!meta && !tiktok) return;
  if (/^\/(staff|offline|b\/)/i.test(location.pathname)) return; // internal pages
  if (window.__hogAdPixels) return; // already running on this page
  window.__hogAdPixels = true;

  if (meta) {
    !function (f, b, e, v, n, t, s) { if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); }; if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = "2.0"; n.queue = []; t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s); }(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
    window.fbq("init", META_PIXEL_ID);
    window.fbq("track", "PageView");
  }

  if (tiktok) {
    !function (w, d, t) { w.TiktokAnalyticsObject = t; var ttq = w[t] = w[t] || []; ttq.methods = ["page", "track", "identify", "instances", "debug", "on", "off", "once", "ready", "alias", "group", "enableCookie", "disableCookie", "holdConsent", "revokeConsent", "grantConsent"]; ttq.setAndDefer = function (t, e) { t[e] = function () { t.push([e].concat(Array.prototype.slice.call(arguments, 0))); }; }; for (var i = 0; i < ttq.methods.length; i++) ttq.setAndDefer(ttq, ttq.methods[i]); ttq.instance = function (t) { for (var e = ttq._i[t] || [], n = 0; n < ttq.methods.length; n++) ttq.setAndDefer(e, ttq.methods[n]); return e; }; ttq.load = function (e, n) { var r = "https://analytics.tiktok.com/i18n/pixel/events.js", o = n && n.partner; ttq._i = ttq._i || {}; ttq._i[e] = []; ttq._i[e]._u = r; ttq._t = ttq._t || {}; ttq._t[e] = +new Date(); ttq._o = ttq._o || {}; ttq._o[e] = n || {}; n = d.createElement("script"); n.type = "text/javascript"; n.async = !0; n.src = r + "?sdkid=" + e + "&lib=" + t; e = d.getElementsByTagName("script")[0]; e.parentNode.insertBefore(n, e); }; ttq.load(TIKTOK_PIXEL_ID); ttq.page(); }(window, document, "ttq");
  }

  // One event to both pixels. eventID lets Meta drop duplicates (e.g. a reload).
  // tiktokName null = Meta only (TikTok has no matching standard event).
  function send(metaName, tiktokName, params, eventId) {
    try {
      if (meta) window.fbq("track", metaName, params, eventId ? { eventID: String(eventId) } : undefined);
      if (tiktok && tiktokName) window.ttq.track(tiktokName, params, eventId ? { event_id: String(eventId) } : undefined);
    } catch (e) { /* tracking must never break the page */ }
  }

  function params(base, value) {
    var p = { currency: "USD" };
    for (var k in base) p[k] = base[k];
    if (typeof value === "number" && isFinite(value) && value > 0) p.value = Math.round(value * 100) / 100;
    return p;
  }
  var GRILLZ = { content_name: "Custom Grillz", content_category: "Grillz", content_ids: ["grillz"], content_type: "product" };
  function grillz(v) { return params(GRILLZ, v); }
  function lead(category) { return params({ content_category: category }); }
  function money(text) { var m = /\$\s?([\d,]+(?:\.\d{2})?)/.exec(text || ""); return m ? Number(m[1].replace(/,/g, "")) : 0; }

  // The product on this page, from its Product structured data (product pages, Monaci items).
  function pageProduct() {
    var nodes = document.querySelectorAll('script[type="application/ld+json"]');
    for (var i = 0; i < nodes.length; i++) {
      try {
        var d = JSON.parse(nodes[i].textContent);
        var list = Array.isArray(d) ? d : (d["@graph"] || [d]);
        for (var j = 0; j < list.length; j++) {
          var x = list[j];
          if (x && x["@type"] === "Product") {
            var offer = Array.isArray(x.offers) ? x.offers[0] : (x.offers || {});
            return { name: String(x.name || ""), sku: String(x.sku || x.productID || x.name || ""), price: Number(offer.price || offer.lowPrice || 0) };
          }
        }
      } catch (e) { /* skip unreadable blocks */ }
    }
    return null;
  }
  function productParams(p) { return params({ content_name: p.name, content_ids: [p.sku], content_type: "product" }, p.price); }

  function handle(e) {
    if (!e || typeof e !== "object" || typeof e.event !== "string") return;
    switch (e.event) {
      case "deposit_lead_success":
      case "grillz_design_text_me":
        send("Lead", "SubmitForm", grillz(), e.lead_id);
        break;
      case "service_form_success":
        send("Lead", "SubmitForm", /grillz/i.test(String(e.service || e.form_name || "")) ? grillz() : lead(String(e.service || e.form_name || "Service")), e.lead_id);
        break;
      case "custom_order_request_success":
        send("Lead", "SubmitForm", lead("Custom jewelry"));
        break;
      case "gold_estimate_text_request":
        send("Lead", "SubmitForm", lead("Sell gold"));
        break;
      case "signup_complete":
        send("CompleteRegistration", "CompleteRegistration", lead("10% coupon signup"));
        break;
      case "product_detail_open":
        send("ViewContent", "ViewContent", params({ content_name: String(e.product || e.name || "In-stock piece"), content_type: "product" }, Number(e.value || e.price)));
        break;
      case "begin_checkout":
        send("InitiateCheckout", "InitiateCheckout", params({ content_ids: [String(e.sku || "monaci")], content_type: "product", content_category: "Monaci" }, Number(e.value)));
        break;
      case "deposit_redirect":
        send("InitiateCheckout", "InitiateCheckout", grillz(125));
        break;
      case "grillz_full_checkout_redirect":
        send("InitiateCheckout", "InitiateCheckout", grillz(Number(e.value)));
        break;
      case "purchase_confirmed":
        send("Purchase", "CompletePayment", /^grillz/i.test(String(e.sku || "")) ? grillz(Number(e.value))
          : params({ content_ids: [String(e.sku || "order")], content_type: "product" }, Number(e.value)), e.transaction_id);
        break;
    }
  }

  // Listen to every dataLayer push (GTM keeps working; it wraps push too).
  var dl = window.dataLayer = window.dataLayer || [];
  for (var i = 0; i < dl.length; i++) handle(dl[i]);
  var push = dl.push;
  dl.push = function () {
    var out = push.apply(dl, arguments);
    for (var j = 0; j < arguments.length; j++) handle(arguments[j]);
    return out;
  };

  // Taps that don't go through dataLayer.
  document.addEventListener("click", function (ev) {
    var a = ev.target && ev.target.closest ? ev.target.closest("a[href]") : null;
    if (!a) return;
    var href = a.getAttribute("href") || "";
    if (/^(tel|sms):/i.test(href)) {
      send("Contact", "Contact", lead(/^sms:/i.test(href) ? "Text" : "Call"));
    } else if (/google\.[a-z.]+\/maps|maps\.google\.|maps\.apple\.com/i.test(href)) {
      send("FindLocation", null, lead("Directions"));
    } else if (/buy\.stripe\.com\//i.test(href)) {
      // Buy Now on an in-stock piece: price from the product page, or from the card the button sits in.
      var p = pageProduct();
      var card = a.parentElement && a.parentElement.closest("article, li, .catalog-product-card");
      var value = p && p.price ? p.price : money(card ? card.textContent : "");
      var head = card && card.querySelector("h2, h3, h4, [class*=title], [class*=name]");
      var title = head ? head.textContent.trim() : (p ? p.name : "In-stock piece");
      send("InitiateCheckout", "InitiateCheckout", params({ content_name: title, content_ids: [p ? p.sku : title], content_type: "product" }, value));
    }
  }, true);

  // Page-level product views.
  if (/^\/grillz(\.html)?$/.test(location.pathname)) {
    send("ViewContent", "ViewContent", grillz());
  } else {
    var prod = pageProduct();
    if (prod) send("ViewContent", "ViewContent", productParams(prod));
  }
})();
