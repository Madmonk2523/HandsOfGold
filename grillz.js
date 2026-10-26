/* ==========================================================================
   Hands of Gold - Grillz funnel helper (grillz.html, grillz-quote.html,
   grillz-fitting.html). Load BEFORE subpage.js, which still handles the
   actual lead submission to /api/leads.

   /api/leads only keeps known fields, so grillz answers are packed into
   fields it already stores: piece, metal, stones, budget, contact_time,
   request_summary and details.
   ========================================================================== */
(() => {
  "use strict";

  /* ---- PLACEHOLDER PRICING: replace with real numbers before going live ----
     Per-tooth prices in USD. The estimate shown is total → total × spread. */
  var PRICING = {
    showEstimate: true,
    metal:  { "Sterling Silver": 60, "10K Gold": 150, "14K Gold": 200, "14K White Gold": 210, "14K Rose Gold": 210, "18K Gold": 275 },
    style:  { "Solid": 0, "Open face": 0, "Diamond cut": 30, "Fangs": 40 },
    stones: { "No stones": 0, "Lab diamonds": 175, "Natural diamonds": 350 },
    arches: { "Top": 1, "Bottom": 1, "Top & bottom": 2 },
    spread: 1.3
  };

  /* ---- DEPOSIT PAYMENT LINK ----
     Stripe Payment Link "Grillz Deposit (Hands of Gold)" (plink_1ULZIL4v8ZDKIFB1GIKdryWN):
     customer chooses the amount, $125 preset and minimum, no tax.
     If this is ever emptied, the deposit form still saves the reservation
     and tells the customer the store will text them a secure payment link. */
  var DEPOSIT_URL = "https://buy.stripe.com/4gMcMYcfje24bA06Of8bS06";
  var DEPOSIT_MIN = 125;

  function push(evt, data) {
    try {
      window.dataLayer = window.dataLayer || [];
      var payload = { event: evt };
      for (var k in data) { if (Object.prototype.hasOwnProperty.call(data, k)) payload[k] = data[k]; }
      window.dataLayer.push(payload);
    } catch (e) { /* analytics must never break the page */ }
  }

  function money(n) { return "$" + Math.round(n).toLocaleString("en-US"); }
  function round25(n) { return Math.round(n / 25) * 25; }

  /* ---------- grill illustrations ---------- */
  function renderArt(el) {
    var n = parseInt(el.getAttribute("data-gz-teeth"), 10) || 6;
    el.innerHTML = "";
    for (var i = 0; i < n; i++) {
      var t = document.createElement("span");
      t.className = "gz-tooth";
      el.appendChild(t);
    }
    el.setAttribute("aria-hidden", "true");
  }

  // Which illustration best matches a set of choices.
  function artFor(s) {
    if (s.stones && s.stones !== "No stones") return "iced";
    if (s.style === "Open face") return "open";
    if (s.style === "Diamond cut") return "cut";
    if (s.style === "Fangs") return "fangs";
    if (s.metal === "14K White Gold" || s.metal === "Sterling Silver") return "white";
    if (s.metal === "14K Rose Gold") return "rose";
    return s.arch === "Bottom" ? "bottom" : "solid";
  }

  function estimate(s) {
    var teeth = parseInt(s.teeth, 10);
    var arches = PRICING.arches[s.arch];
    var metal = PRICING.metal[s.metal];
    if (!teeth || !arches || metal == null) return null;
    var per = metal + (PRICING.style[s.style] || 0) + (PRICING.stones[s.stones] || 0);
    var low = round25(per * teeth * arches);
    return { low: low, high: round25(low * PRICING.spread), teeth: teeth * arches };
  }

  function summaryOf(s) {
    var parts = ["Grillz"];
    if (s.arch) parts.push(s.arch);
    if (s.teeth) parts.push(s.teeth + (s.teeth === "1" ? " tooth" : " teeth") + (s.arch === "Top & bottom" ? " each" : ""));
    if (s.style) parts.push(s.style);
    if (s.metal) parts.push(s.metal);
    if (s.stones) parts.push(s.stones);
    return parts.join(" · ");
  }

  function setHidden(form, name, value) {
    var el = form.querySelector("input[type='hidden'][name='" + name + "']");
    if (!el) {
      el = document.createElement("input");
      el.type = "hidden";
      el.name = name;
      form.appendChild(el);
    }
    el.value = value || "";
  }

  /* ---------- choice button groups ----------
     <div data-gz-group="arch"><button class="gz-choice" data-value="Top">…</button></div>
     Selected value lives on the group's data-gz-value. */
  // Multi-select groups (data-gz-multi) store "A, B" and treat the
  // data-gz-exclusive value (e.g. "Plain polish") as "none of the others".
  function syncMultiValue(group) {
    var vals = Array.prototype.slice.call(group.querySelectorAll('.gz-choice[aria-pressed="true"]'))
      .map(function (b) { return b.getAttribute("data-value"); });
    group.setAttribute("data-gz-value", vals.join(", "));
  }
  function pressMulti(group, btn, forceOn) {
    var exclusive = group.getAttribute("data-gz-exclusive");
    var value = btn.getAttribute("data-value");
    var on = forceOn ? true : btn.getAttribute("aria-pressed") !== "true";
    if (value === exclusive) {
      group.querySelectorAll(".gz-choice").forEach(function (b) { b.setAttribute("aria-pressed", "false"); });
      btn.setAttribute("aria-pressed", "true");
    } else {
      btn.setAttribute("aria-pressed", on ? "true" : "false");
      var ex = exclusive && group.querySelector('.gz-choice[data-value="' + exclusive + '"]');
      var any = group.querySelector('.gz-choice[aria-pressed="true"]:not([data-value="' + exclusive + '"])');
      if (ex) ex.setAttribute("aria-pressed", any ? "false" : "true");
    }
    syncMultiValue(group);
  }
  function initGroups(root, onPick) {
    root.querySelectorAll("[data-gz-group]").forEach(function (group) {
      var multi = group.hasAttribute("data-gz-multi");
      group.setAttribute("role", "group");
      group.querySelectorAll(".gz-choice").forEach(function (btn) {
        btn.type = "button";
        var preset = btn.getAttribute("aria-pressed") === "true";
        btn.setAttribute("aria-pressed", preset ? "true" : "false");
        if (preset && !multi) group.setAttribute("data-gz-value", btn.getAttribute("data-value"));
        btn.addEventListener("click", function () {
          if (multi) {
            pressMulti(group, btn);
          } else {
            group.querySelectorAll(".gz-choice").forEach(function (b) { b.setAttribute("aria-pressed", "false"); });
            btn.setAttribute("aria-pressed", "true");
            group.setAttribute("data-gz-value", btn.getAttribute("data-value"));
          }
          if (onPick) onPick(group.getAttribute("data-gz-group"), group.getAttribute("data-gz-value"));
        });
      });
      if (multi) syncMultiValue(group);
    });
  }

  // Current answers from selects [data-gz-key] and groups [data-gz-group] inside root.
  function readState(root) {
    var s = {};
    root.querySelectorAll("[data-gz-key]").forEach(function (el) { if (el.value) s[el.getAttribute("data-gz-key")] = el.value; });
    root.querySelectorAll("[data-gz-group]").forEach(function (g) {
      var v = g.getAttribute("data-gz-value");
      if (v) s[g.getAttribute("data-gz-group")] = v;
    });
    // Named selects (metal/stones) count too.
    ["metal", "stones"].forEach(function (k) {
      var el = root.querySelector("select[name='" + k + "']");
      if (el && el.value && !s[k]) s[k] = el.value;
    });
    return s;
  }

  /* Optional permission to post a customer design. Only reported when a design
     is attached (forms with a concept_id field) or on the text-me form. */
  function shareNote(form) {
    var id = form.querySelector("input[name='concept_id']");
    if (id && !id.value) return "";
    var box = form.querySelector("[data-gz-share-box]");
    return box && box.checked
      ? " · DESIGN SHARING: ALLOWED (customer opted in to website/social use; never their name, number or photos)"
      : " · design sharing: not allowed";
  }

  /* ---------- V1 + V3: keep hidden summary fields in sync ---------- */
  function initSummaryForm(form) {
    var mode = form.getAttribute("data-gz-summary"); // "baseline", "request" or "fitting"
    function sync() {
      var s = readState(form);
      if (mode === "baseline") {
        // grillz.html: set size + metal + gold color.
        var color = s.color && s.color !== "Not applicable" ? s.color : "";
        var piece = ["Grillz", s.set, [s.metal, color].filter(Boolean).join(" ")].filter(Boolean).join(" · ");
        setHidden(form, "piece", piece);
        setHidden(form, "request_summary", piece + (s.stones ? " · gemstones: " + s.stones : "") + shareNote(form));
        return;
      }
      setHidden(form, "piece", summaryOf(s));
      if (mode === "fitting") {
        var when = [s.day, s.time].filter(Boolean).join(", ");
        var how = s.confirm ? "confirm by " + s.confirm.toLowerCase() : "";
        setHidden(form, "contact_time", [when, how].filter(Boolean).join(" · "));
        setHidden(form, "request_summary", "Grillz impression appointment request" + (when ? " (" + when + ")" : ""));
      } else {
        var est = estimate(s);
        setHidden(form, "request_summary", summaryOf(s) + (est && PRICING.showEstimate ? " · web estimate " + money(est.low) + "–" + money(est.high) : ""));
      }
    }
    initGroups(form, sync);
    form.addEventListener("change", sync);
    form.addEventListener("input", sync);
    // Capture phase: runs before subpage.js reads the form on submit.
    form.addEventListener("submit", sync, true);
    sync();
  }

  /* ---------- V2: step-by-step quote builder ---------- */
  function initQuiz(quiz) {
    var panels = Array.prototype.slice.call(quiz.querySelectorAll(".gz-panel"));
    var bar = quiz.querySelector(".gz-progress i");
    var counter = quiz.querySelector(".gz-quiz-top output");
    var form = quiz.querySelector("form");
    var state = {};
    var idx = 0;

    function show(i) {
      idx = Math.max(0, Math.min(i, panels.length - 1));
      panels.forEach(function (p, n) { p.hidden = n !== idx; });
      if (bar) bar.style.width = Math.round(((idx + 1) / panels.length) * 100) + "%";
      if (counter) counter.textContent = "Step " + (idx + 1) + " of " + panels.length;
      var next = panels[idx].querySelector("[data-gz-next]");
      var key = panels[idx].getAttribute("data-gz-step");
      if (next) next.disabled = !!key && !state[key];
      if (idx === panels.length - 1) finish();
      var h = panels[idx].querySelector("h2");
      if (h && i !== 0) { h.setAttribute("tabindex", "-1"); h.focus({ preventScroll: true }); }
      var top = quiz.getBoundingClientRect().top;
      if (top < 0) quiz.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    function finish() {
      var est = estimate(state);
      var range = quiz.querySelector("[data-gz-range]");
      if (range) range.textContent = est && PRICING.showEstimate ? money(est.low) + " – " + money(est.high) : "Custom quote";
      quiz.querySelectorAll("[data-gz-show]").forEach(function (el) {
        el.textContent = state[el.getAttribute("data-gz-show")] || "—";
      });
      var art = quiz.querySelector("[data-gz-preview]");
      if (art) {
        art.setAttribute("data-gz-art", artFor(state));
        art.setAttribute("data-gz-teeth", state.teeth || "6");
        renderArt(art);
      }
      if (form) {
        setHidden(form, "piece", summaryOf(state));
        setHidden(form, "metal", state.metal);
        setHidden(form, "stones", state.stones);
        setHidden(form, "budget", est && PRICING.showEstimate ? "Web estimate " + money(est.low) + "–" + money(est.high) : "");
        setHidden(form, "request_summary", summaryOf(state));
      }
      push("gz_quiz_complete", { form_name: "grillz-quote", estimate_low: est ? est.low : null, teeth_total: est ? est.teeth : null });
    }

    initGroups(quiz, function (key, value) {
      state[key] = value;
      push("gz_quiz_step", { step: key, value: value });
      var next = panels[idx].querySelector("[data-gz-next]");
      if (next) next.disabled = false;
      // Auto-advance keeps momentum; Back is always available.
      setTimeout(function () { if (panels[idx].getAttribute("data-gz-step") === key) show(idx + 1); }, 260);
    });

    quiz.addEventListener("click", function (e) {
      var t = e.target.closest ? e.target.closest("[data-gz-next],[data-gz-back],[data-gz-restart]") : null;
      if (!t) return;
      if (t.hasAttribute("data-gz-next")) show(idx + 1);
      else if (t.hasAttribute("data-gz-back")) show(idx - 1);
      else show(0);
    });

    show(0);
    push("gz_quiz_view", { form_name: "grillz-quote" });
  }

  /* ---------- design slideshow (grillz.html) ----------
     Crossfades every ~5 s and loops. Pauses on hover, on keyboard focus inside,
     and while the tab is hidden; resumes afterwards unless paused by the visitor.
     Reduced motion: no crossfade and no autoplay until the visitor presses play. */
  function initSlideshow(show) {
    var slides = Array.prototype.slice.call(show.querySelectorAll(".gz-slide"));
    if (slides.length < 2) return;
    var stage = show.querySelector(".gz-show-stage");
    var title = show.querySelector("#gz-show-title");
    var count = show.querySelector("#gz-show-count");
    var toggle = show.querySelector("#gz-toggle");
    var INTERVAL = 5000;
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var idx = 0, timer = null;
    var userPaused = reduce, focused = false;

    function captionOf(slide) { return (slide.getAttribute("aria-label") || "").replace(/^\d+ of \d+:\s*/, ""); }

    function go(n) {
      slides[idx].classList.remove("is-active");
      slides[idx].setAttribute("aria-hidden", "true");
      idx = (n + slides.length) % slides.length;
      slides[idx].classList.add("is-active");
      slides[idx].removeAttribute("aria-hidden");
      var img = slides[idx].querySelector("img");
      if (img) img.loading = "eager";
      var nextImg = slides[(idx + 1) % slides.length].querySelector("img");
      if (nextImg) nextImg.loading = "eager"; // warm the next image before it fades in
      if (title) title.textContent = captionOf(slides[idx]);
      if (count) count.textContent = (idx + 1) + " / " + slides.length;
    }

    function running() { return !userPaused && !focused && !document.hidden; }
    function schedule() {
      clearInterval(timer); timer = null;
      if (running()) timer = setInterval(function () { go(idx + 1); }, INTERVAL);
      // Announce slide changes only when the visitor is driving it.
      stage.setAttribute("aria-live", running() ? "off" : "polite");
    }
    function setPaused(p) {
      userPaused = p;
      show.classList.toggle("is-paused", p);
      toggle.setAttribute("aria-label", p ? "Play slideshow" : "Pause slideshow");
      schedule();
    }

    show.querySelector("#gz-prev").addEventListener("click", function () { go(idx - 1); schedule(); });
    show.querySelector("#gz-next").addEventListener("click", function () { go(idx + 1); schedule(); });
    toggle.addEventListener("click", function () { setPaused(!userPaused); push("gz_slideshow_toggle", { paused: userPaused }); });
    // Pause only for keyboard focus. Hover and taps used to pause it too, and on
    // phones a tap left it paused until the visitor tapped somewhere else.
    show.addEventListener("focusin", function (e) {
      var keyboard = true;
      try { keyboard = e.target.matches(":focus-visible"); } catch (err) {}
      if (keyboard) { focused = true; schedule(); }
    });
    show.addEventListener("focusout", function (e) { if (!show.contains(e.relatedTarget)) { focused = false; schedule(); } });
    document.addEventListener("visibilitychange", schedule);
    show.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft") { go(idx - 1); schedule(); }
      else if (e.key === "ArrowRight") { go(idx + 1); schedule(); }
    });

    go(0);
    setPaused(userPaused);
  }

  /* ---------- deposit / reserve form (grillz.html #reserve) ----------
     1. Saves the reservation through /api/leads (same checks as subpage.js).
     2. Deposit: sends the customer to DEPOSIT_URL, or, without one, confirms
        that the store will text a payment link.
     3. Pay in full (plain 6 / 8 sets, free mold kit): asks /api/grillz-checkout
        for a Stripe Checkout page. Prices, tax and shipping shown here come
        from that API's probe, and the API recomputes them before charging.
     Card details never touch this form. */
  var CHECKOUT_API = "/api/grillz-checkout";
  var FULL_SETS = { "Top OR Bottom 6 Set": 6, "Top OR Bottom 8 Set": 8 };

  function cents(n) { return "$" + (n / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

  function initDeposit(form) {
    var hasLink = /^https:\/\//.test(DEPOSIT_URL);
    var mode = hasLink ? "link" : "manual";
    form.querySelectorAll("[data-gz-deposit-copy]").forEach(function (el) { el.hidden = el.getAttribute("data-gz-deposit-copy") !== mode; });
    var submit = form.querySelector(".hog-submit");
    var label = submit.getAttribute("data-label-" + mode) || submit.textContent;
    submit.textContent = label;
    var status = form.querySelector(".hog-status");
    var startedAt = Date.now();
    var sent = false;
    var full = null; // probe result once "pay in full" is available
    var payWrap = form.querySelector("[data-gz-pay-wrap]");
    var summary = form.querySelector("[data-gz-full-summary]");
    var archField = form.querySelector("[data-gz-full-only]");
    var archSel = archField && archField.querySelector("select");
    var termsDeposit = form.querySelector("[data-gz-deposit-terms]");
    var termsFull = form.querySelector("[data-gz-full-terms]");
    var metalSel = form.querySelector("select[name='metal']");
    initGroups(form, function () { render(); });

    function say(msg, kind) { status.className = "hog-status" + (kind ? " is-" + kind : ""); status.textContent = msg; }

    function payMode() {
      var g = form.querySelector('[data-gz-group="pay"]');
      return full && g && g.getAttribute("data-gz-value") === "full" ? "full" : "deposit";
    }

    // The full-payment total for the current answers, or the reason there isn't one.
    function quote() {
      var s = readState(form);
      var metal = metalSel.value;
      var fitting = s.fitting || "In store";
      var teeth = FULL_SETS[s.set];
      var row = full.prices[metal];
      if (!teeth) return { reason: "Pay in full is for Top OR Bottom 6 and 8 sets. Single teeth and custom sets start with the $125 deposit." };
      if (!metal) return { reason: "Choose your metal to see your total." };
      if (!row || !row[teeth]) return { reason: metal + " sets are quoted individually, so they start with the $125 deposit." };
      var mail = fitting === "Mail-in kit";
      if (mail && full.mailInShipping == null) return { reason: "Pay in full is available for in-store fitting right now. For mail-in, start with the $125 deposit." };
      var price = row[teeth], ship = mail ? full.mailInShipping : 0;
      var tax = Math.round((price + ship) * full.taxRate);
      return { ok: true, s: s, metal: metal, fitting: fitting, teeth: teeth, price: price, ship: ship, tax: tax, kit: full.kitValue[fitting] || 0, total: price + ship + tax };
    }

    function line(label, value, cls) {
      var p = document.createElement("p");
      if (cls) p.className = cls;
      var a = document.createElement("span"); a.textContent = label;
      var b = document.createElement("b"); b.textContent = value;
      p.append(a, b);
      return p;
    }

    function render() {
      var m = payMode();
      form.classList.toggle("is-pay-full", m === "full");
      if (archField) { archField.hidden = m !== "full"; archSel.required = m === "full"; }
      form.querySelectorAll("[data-gz-pay-copy]").forEach(function (el) { el.hidden = el.getAttribute("data-gz-pay-copy") !== m; });
      if (termsDeposit) termsDeposit.required = m === "deposit";
      if (termsFull) termsFull.required = m === "full";
      if (m !== "full") { summary.hidden = true; submit.textContent = label; return; }
      var q = quote();
      summary.hidden = false;
      summary.innerHTML = "";
      if (!q.ok) {
        summary.appendChild(line(q.reason, "", "is-note"));
        submit.textContent = "Continue to Payment";
        return;
      }
      var metalLabel = /Gold/.test(q.metal) && q.s.color && q.s.color !== "Not applicable" ? q.metal.replace("Gold", q.s.color + " Gold") : q.metal;
      summary.appendChild(line((q.s.arch ? q.s.arch + " " : "") + q.teeth + "-tooth set · " + metalLabel, cents(q.price)));
      summary.appendChild(line("Mold kit", q.kit ? "FREE (save " + cents(q.kit) + ")" : "FREE", "is-free"));
      if (q.ship) summary.appendChild(line("Mail-in shipping", cents(q.ship)));
      summary.appendChild(line("NY sales tax (" + (Math.round(full.taxRate * 10000) / 100) + "%)", cents(q.tax)));
      summary.appendChild(line("Total today", cents(q.total), "is-total"));
      submit.textContent = "Continue to Payment · " + cents(q.total);
    }
    form.addEventListener("change", render);

    // "Pay in full" / "Reserve" links elsewhere on the page preselect the choice.
    document.addEventListener("click", function (e) {
      var a = e.target && e.target.closest ? e.target.closest("[data-gz-pay]") : null;
      if (!a || !full) return;
      var btn = form.querySelector('[data-gz-group="pay"] .gz-choice[data-value="' + a.getAttribute("data-gz-pay") + '"]');
      if (btn && btn.getAttribute("aria-pressed") !== "true") btn.click();
    });

    form.addEventListener("input", function once() { push("deposit_form_start", { form_name: "grillz-deposit" }); form.removeEventListener("input", once); });

    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      if (sent) return;
      var honey = form.querySelector("[name='website']");
      if (honey && honey.value.trim()) return;
      var pay = payMode();
      var q = pay === "full" ? quote() : null;
      if (q && !q.ok) { say(q.reason, "error"); return; }
      if (q && /Gold/.test(q.metal) && !/^(Yellow|White|Rose)$/.test(q.s.color || "")) { say("Please choose your gold color.", "error"); form.querySelector("[data-gz-key='color']").focus(); return; }
      if (!form.reportValidity()) return;
      var consent = form.querySelector("[name='contactConsent']");
      if (consent && !consent.checked) { say("Please accept the contact consent so we can confirm your order.", "error"); consent.focus(); return; }
      if (Date.now() - startedAt < 1500) { say("Please take a moment to review your details, then submit again.", "error"); startedAt = Date.now() - 1600; return; }

      var s = readState(form);
      var color = s.color && s.color !== "Not applicable" ? s.color : "";
      var piece = ["Grillz", q && s.arch ? s.arch + " " + s.set.replace("Top OR Bottom ", "") : s.set, [s.metal, color].filter(Boolean).join(" ")].filter(Boolean).join(" · ");
      var fitting = s.fitting || "In store";
      var data = new FormData(form);
      var payload = {
        leadType: "service",
        website: "",
        _subject: q ? "New Grillz Order (Pay in Full) — " + fitting : "New Grillz Reservation (Deposit) — " + fitting,
        _template: "table",
        service: q ? "Grillz Pay in Full" : "Grillz Deposit",
        source: "HandsOfGoldNY.com grillz-deposit page",
        page: window.location.href,
        submitted_at: new Date().toLocaleString(),
        consent: "Customer agreed to be contacted by phone, text or email by Hands of Gold and accepted the Terms and Privacy Policy.",
        piece: piece,
        request_summary: q
          ? "PAY IN FULL · " + fitting + " · " + piece + " · total " + cents(q.total) + " (set " + cents(q.price) + (q.ship ? " + shipping " + cents(q.ship) : "") + " + tax " + cents(q.tax) + ") · FREE mold kit · customer sent to Stripe checkout (confirm payment in Stripe) · customer accepted: custom-made, final sale once production begins, 7-day fit guarantee"
          : "Deposit reservation · " + fitting + " · " + piece + (hasLink ? " · sent to online deposit page" : " · needs a deposit payment link texted ($" + DEPOSIT_MIN + " minimum)") + " · customer accepted: deposit covers " + (fitting === "Mail-in kit" ? "$49.95 mold kit" : "$25 in-house mold kit (silver sale through Nov 30)") + (fitting === "Mail-in kit" ? " and, in most cases, shipping (contact customer to cover any shipping difference before the kit is sent)" : "") + " first, remainder toward set/teeth; no sales tax on deposit, tax added to final payment" + "; non-refundable, usable as in-store credit",
        contact_time: "Fitting: " + fitting
      };
      payload.request_summary += shareNote(form);
      data.forEach(function (v, k) {
        if (k === "website" || k === "contactConsent" || k === "design_share") return;
        if (typeof v === "string" && v.trim()) payload[k] = v.trim();
      });
      try {
        var params = new URLSearchParams(window.location.search);
        payload.utm_source = params.get("utm_source") || "direct / unknown";
        payload.utm_campaign = params.get("utm_campaign") || "";
      } catch (e2) {}

      var online = q || hasLink;
      submit.disabled = true; submit.textContent = online ? "Opening payment…" : "Saving…";
      say(online ? "Saving your details and opening our secure payment page…" : "Saving your reservation…", "");

      // Save the reservation, but never let a slow or failed save block the
      // payment: Stripe collects name, email and phone on its own page too.
      var leadId = "";
      try {
        var ctrl = ("AbortController" in window) ? new AbortController() : null;
        var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, 6000) : null;
        var res = await fetch("/api/leads", { method: "POST", headers: { "Content-Type": "application/json", "Accept": "application/json" }, body: JSON.stringify(payload), signal: ctrl ? ctrl.signal : undefined });
        if (timer) clearTimeout(timer);
        var out = await res.json().catch(function () { return {}; });
        if (!res.ok || out.success !== true || !out.leadId) throw new Error(out.error || "Submission failed");
        leadId = String(out.leadId);
        push("deposit_lead_success", { form_name: "grillz-deposit", fitting: fitting, lead_id: leadId, pay: pay });
      } catch (err) {
        console.error("Hands of Gold deposit form: reservation not saved", err);
        push("deposit_form_error", { form_name: "grillz-deposit", continued_to_payment: !!online, pay: pay });
      }
      var email = form.querySelector("[name='email']").value.trim();

      if (q) {
        try {
          var cres = await fetch(CHECKOUT_API, { method: "POST", headers: { "Content-Type": "application/json", "Accept": "application/json" },
            body: JSON.stringify({ set: s.set, metal: q.metal, color: color, arch: s.arch || "", fitting: fitting, email: email, leadId: leadId, quotedTotal: q.total }) });
          var cout = await cres.json().catch(function () { return {}; });
          if (cres.status === 409 && cout.probe) {
            full = cout.probe; render();
            say(cout.error || "Your total changed. Please check it and continue.", "error");
            submit.disabled = false;
            return;
          }
          if (!cres.ok || !/^https:\/\//.test(cout.url || "")) throw new Error(cout.error || "Checkout failed");
          sent = true;
          say("Taking you to our secure payment page…", "success");
          push("grillz_full_checkout_redirect", { lead_id: leadId || "not_saved", value: q.total / 100, metal: q.metal, teeth: q.teeth, fitting: fitting });
          setTimeout(function () { window.location.href = cout.url; }, 300); // let ad pixels send first
        } catch (err3) {
          console.error("Hands of Gold pay in full: checkout not opened", err3);
          push("grillz_full_checkout_error", { lead_id: leadId || "not_saved" });
          if (leadId) {
            sent = true;
            say("Your order is saved ✓ We couldn't open the payment page just now, so we'll text you a secure link to pay. Need us sooner? Call (631) 264-6610.", "success");
            submit.textContent = "Saved ✓";
          } else {
            say("We couldn't open checkout just now. Please call (631) 264-6610 and we'll take your order by phone.", "error");
            submit.disabled = false; render();
          }
        }
        return;
      }

      if (hasLink) {
        sent = true;
        var url = new URL(DEPOSIT_URL);
        if (email) url.searchParams.set("prefilled_email", email);
        if (leadId) url.searchParams.set("client_reference_id", leadId.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 200));
        say("Taking you to our secure payment page…", "success");
        push("deposit_redirect", { form_name: "grillz-deposit", lead_id: leadId || "not_saved" });
        setTimeout(function () { window.location.href = url.toString(); }, 300); // let ad pixels send first
      } else if (leadId) {
        sent = true;
        say("Reservation saved ✓ We'll text you a secure link to pay your deposit ($" + DEPOSIT_MIN + " minimum) during store hours. Need us sooner? Call (631) 264-6610.", "success");
        submit.textContent = "Reserved ✓";
        form.querySelectorAll("input, select, textarea, button.gz-choice").forEach(function (el) { el.disabled = true; });
      } else {
        say("We couldn't save that just now. Please call (631) 264-6610 and we'll take your deposit by phone.", "error");
        submit.disabled = false; submit.textContent = label;
      }
    });

    // Offer "pay in full" only when the checkout API says it can take payments.
    fetch(CHECKOUT_API + "?probe=1", { headers: { "Accept": "application/json" } })
      .then(function (r) { return r.ok ? r.json() : {}; })
      .then(function (p) {
        if (!p || !p.available || !p.prices) return;
        full = p;
        payWrap.hidden = false;
        if (/[?&]checkout=cancelled\b/.test(location.search)) {
          var b = form.querySelector('[data-gz-group="pay"] .gz-choice[data-value="full"]');
          if (b) b.click();
          say("Checkout was cancelled, so nothing was charged. You can try again or switch to the $125 deposit.", "");
        }
        render();
        push("grillz_full_available", {});
      })
      .catch(function () { /* deposit only; the rest of the form is unaffected */ });

    push("deposit_form_view", { form_name: "grillz-deposit", mode: mode });
  }

  function initPartnerTracking() {
    document.addEventListener("click", function (e) {
      var a = e.target && e.target.closest ? e.target.closest("[data-gz-partner]") : null;
      if (a) push("financing_click", { partner: a.getAttribute("data-gz-partner") });
    });
  }

  /* ---------- Grillz Design Studio (AI concepts through /api/design) ----------
     Same service as the Custom Jewelry Studio. Only design choices are sent;
     name, email and phone never reach the image generator. The section stays
     hidden unless /api/design?probe=1 reports that generation is available.
     Demo mode (local preview only): open the page on localhost with ?studio=demo. */
  var STUDIO_API = "/api/design";
  // Starting prices for plain styles, from the approved price table.
  var START_PRICES = {
    ".925 Sterling Silver": { 1: 96.99, 6: 525, 8: 600 }, // SILVER SALE through Nov 30, 2026 (regular: 1: 125, 6: 675, 8: 800)
    "10K Gold": { 1: 295, 6: 1590, 8: 1888 },
    "14K Gold": { 1: 400, 6: 2150, 8: 2560 },
    "18K Gold": { 1: 575, 6: 3100, 8: 3680 }
  };
  var STUDIO_LOADING = ["Shaping each tooth…", "Polishing the metal…", "Adding your details…", "Almost there…"];

  function money0(n) { return "$" + Number(n).toLocaleString("en-US"); }

  function initStudio(section) {
    var form = section.querySelector("#gz-studio-form");
    if (!form) return;
    var $s = function (id) { return section.querySelector("#" + id); };
    var genBtn = $s("gz-studio-generate"), updBtn = $s("gz-studio-update"), altBtn = $s("gz-studio-another");
    var statusEl = $s("gz-studio-status"), img = $s("gz-studio-img"), empty = $s("gz-studio-empty"), loading = $s("gz-studio-loading");
    var meta = $s("gz-studio-meta"), loadMsg = $s("gz-studio-loading-msg"), remainingEl = $s("gz-studio-remaining");
    var metalSel = $s("s-metal"), colorSel = $s("s-color"), revisionEl = $s("s-revision"), honey = $s("s-website");
    var demo = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && /[?&]studio=demo\b/.test(location.search);
    var state = { busy: false, concept: null, history: [], timer: null, demoCount: 0 };

    initGroups(form);

    // Idea starters: add the idea to the description and switch on the matching detail.
    var notesEl = $s("s-notes");
    section.querySelectorAll("[data-gz-idea]").forEach(function (chip) {
      chip.addEventListener("click", function () {
        var idea = chip.getAttribute("data-gz-idea");
        var current = notesEl.value.trim();
        if (current.indexOf(idea) === -1) {
          notesEl.value = (current ? current.replace(/[.\s]*$/, ". ") : "") + idea + ".";
        }
        var add = chip.getAttribute("data-gz-adds");
        var group = form.querySelector('[data-gz-group="s_style"]');
        var btn = add && group && group.querySelector('.gz-choice[data-value="' + add + '"]');
        if (btn) pressMulti(group, btn, true);
        notesEl.focus();
        push("grillz_design_idea", { idea: chip.textContent });
      });
    });

    // Inspiration photo: accepted up to 5 MB, then shrunk on the device (longest
    // side 1024 px, JPEG) so the upload stays small. Sent only with new designs.
    var PHOTO_MAX_BYTES = 5 * 1024 * 1024, PHOTO_EDGE = 1024;
    var PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
    var fileInput = $s("s-photo"), drop = $s("gz-upload-drop"), photoPreview = $s("gz-upload-preview");
    state.photo = "";

    function clearPhoto() {
      state.photo = ""; fileInput.value = "";
      photoPreview.hidden = true; drop.hidden = false;
    }
    function shrinkPhoto(file) {
      return new Promise(function (resolve, reject) {
        var url = URL.createObjectURL(file);
        var im = new Image();
        im.onload = function () {
          var scale = Math.min(1, PHOTO_EDGE / Math.max(im.naturalWidth, im.naturalHeight));
          var w = Math.max(1, Math.round(im.naturalWidth * scale)), h = Math.max(1, Math.round(im.naturalHeight * scale));
          var canvas = document.createElement("canvas");
          canvas.width = w; canvas.height = h;
          var ctx = canvas.getContext("2d");
          ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, w, h); // flatten transparent PNGs
          ctx.drawImage(im, 0, 0, w, h);
          URL.revokeObjectURL(url);
          var q = 0.85, out = canvas.toDataURL("image/jpeg", q);
          while (out.length > 1400000 && q > 0.5) { q -= 0.1; out = canvas.toDataURL("image/jpeg", q); }
          resolve(out);
        };
        im.onerror = function () { URL.revokeObjectURL(url); reject(new Error("unreadable")); };
        im.src = url;
      });
    }
    async function takePhoto(file) {
      if (!file) return;
      if (PHOTO_TYPES.indexOf(file.type) === -1) { say("Please choose a JPG, PNG or WEBP photo.", "error"); fileInput.value = ""; return; }
      if (file.size > PHOTO_MAX_BYTES) { say("That photo is over 5 MB. Please choose a smaller one.", "error"); fileInput.value = ""; return; }
      try {
        state.photo = await shrinkPhoto(file);
      } catch (e) {
        say("We couldn't read that photo. Please try another one.", "error");
        clearPhoto();
        return;
      }
      $s("gz-upload-img").src = state.photo;
      $s("gz-upload-name").textContent = file.name + " · ready to use";
      photoPreview.hidden = false; drop.hidden = true;
      say("", "");
      push("grillz_design_photo_added", { size_kb: Math.round(file.size / 1024) });
    }
    fileInput.addEventListener("change", function () { takePhoto(fileInput.files && fileInput.files[0]); });
    ["dragenter", "dragover"].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add("is-drag"); }); });
    ["dragleave", "drop"].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove("is-drag"); }); });
    drop.addEventListener("drop", function (e) { takePhoto(e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]); });
    $s("gz-upload-remove").addEventListener("click", clearPhoto);

    function say(msg, kind) { statusEl.className = "hog-status" + (kind ? " is-" + kind : ""); statusEl.textContent = msg; }

    function syncColor() {
      var isGold = /Gold/.test(metalSel.value);
      colorSel.disabled = !isGold;
      colorSel.closest(".hog-field").style.opacity = isGold ? "" : ".5";
    }
    metalSel.addEventListener("change", syncColor);
    syncColor();

    function spec() {
      var s = readState(form);
      var metal = s.s_metal || "14K Gold";
      var metalLabel = /Gold/.test(metal) ? metal.replace("Gold", (s.s_color || "Yellow") + " Gold") : metal;
      var teeth = s.s_teeth || "6", arch = s.s_arch || "Top", style = s.s_style || "Plain polish";
      var details = style.split(/,\s*/).filter(Boolean);
      var teethText = teeth === "1" ? "1 tooth" : teeth + " teeth";
      return {
        arch: arch, teeth: teeth, style: style, details: details, metal: metal, metalLabel: metalLabel,
        iced: details.indexOf("Iced out") >= 0,
        size: arch + " · " + teethText + (arch === "Top & bottom" ? " on each arch" : ""),
        stones: details.indexOf("Iced out") >= 0 ? "Diamonds, iced out in pave settings" : "No stones / metal only",
        notes: ("Details: " + style + ". " + (s.s_notes || "")).trim()
      };
    }

    function priceLine(sp) {
      var p = START_PRICES[sp.metal];
      if (!p) return sp.metal + " is quoted individually.";
      var perArch = sp.arch === "Top & bottom" ? " per arch" : "";
      var line = sp.teeth === "6" ? "Top OR Bottom 6 Set in " + sp.metal + " from " + money0(p[6]) + perArch
        : sp.teeth === "8" ? "Top OR Bottom 8 Set in " + sp.metal + " from " + money0(p[8]) + perArch
        : "Single teeth in " + sp.metal + " from " + money0(p[1]) + " per tooth";
      line = "Starting price (plain style): " + line + ".";
      var custom = sp.details.filter(function (d) { return d !== "Plain polish"; });
      if (custom.length) line += " Custom details (" + custom.join(", ") + ") are quoted individually.";
      return line;
    }

    function setRemaining(n) {
      if (typeof n !== "number") return;
      remainingEl.textContent = n > 0 ? (n + (n === 1 ? " concept" : " concepts") + " left today.") : "You've used today's concepts. Reserve or request a quote with your favourite.";
      if (n <= 0) [genBtn, updBtn, altBtn].forEach(function (b) { b.disabled = true; });
    }

    function showLoading(on) {
      loading.hidden = !on;
      if (on) { empty.hidden = true; img.hidden = true; }
      else if (!state.concept) empty.hidden = false;
      clearInterval(state.timer);
      if (on) {
        var i = 0; loadMsg.textContent = "This usually takes 30 to 60 seconds.";
        state.timer = setInterval(function () { loadMsg.textContent = STUDIO_LOADING[i++ % STUDIO_LOADING.length]; }, 7000);
      }
    }

    function select(concept) {
      state.concept = concept;
      img.src = concept.image;
      img.alt = "AI concept of custom grillz: " + concept.summary;
      img.hidden = false; empty.hidden = true; meta.hidden = false;
      $s("gz-studio-id").textContent = concept.id;
      $s("gz-studio-summary").textContent = concept.summary;
      $s("gz-studio-price").textContent = concept.price;
      var save = $s("gz-studio-save");
      if (save) {
        var ext = (/^data:image\/(\w+)/.exec(concept.image) || /\.(jpe?g|png|webp)(?:[?#]|$)/i.exec(concept.image) || [])[1] || "png";
        save.href = concept.image;
        save.setAttribute("download", "hands-of-gold-grillz-" + concept.id + "." + (ext === "jpeg" ? "jpg" : ext));
      }
      renderHistory();
      attach(concept);
      var tf = $s("gz-textme");
      if (tf) tf.dispatchEvent(new Event("gz:concept"));
    }

    function renderHistory() {
      var box = $s("gz-studio-history");
      box.innerHTML = "";
      if (state.history.length < 2) return;
      state.history.forEach(function (c, i) {
        var b = document.createElement("button");
        b.type = "button";
        b.setAttribute("aria-label", "Use version " + (i + 1) + ", concept " + c.id);
        b.setAttribute("aria-current", state.concept && state.concept.id === c.id ? "true" : "false");
        var t = document.createElement("img"); t.src = c.image; t.alt = "";
        b.appendChild(t);
        b.addEventListener("click", function () { select(c); });
        box.appendChild(b);
      });
    }

    // Put the concept on both lead forms and fill their matching fields if empty.
    function attach(concept) {
      var sp = concept.spec;
      var absolute = concept.imageUrl ? location.origin + concept.imageUrl : "";
      document.querySelectorAll("form").forEach(function (f) {
        var box = f.querySelector("[data-gz-attached]");
        if (!box) return;
        setHidden(f, "concept_id", concept.id);
        setHidden(f, "concept_image_url", absolute || ("Not stored. Ask the customer for concept " + concept.id));
        box.querySelector("img").src = concept.image;
        box.querySelector("[data-gz-attached-id]").textContent = concept.id + " · " + concept.summary;
        box.hidden = false;
        var share = f.querySelector("[data-gz-share]");
        if (share) share.hidden = false;
        // Fill a field if it's empty or still holds what the studio filled last time;
        // never overwrite something the customer typed or chose themselves.
        var fill = function (sel, val) {
          var el = f.querySelector(sel);
          if (!el || !val) return;
          if (el.value && el.value !== el.getAttribute("data-gz-auto")) return;
          el.value = val;
          el.setAttribute("data-gz-auto", el.value);
          el.dispatchEvent(new Event("change", { bubbles: true }));
        };
        fill("select[data-gz-key='set']", sp.teeth === "6" ? "Top OR Bottom 6 Set" : sp.teeth === "8" ? "Top OR Bottom 8 Set" : "Single tooth");
        fill("select[name='metal']", sp.metal);
        fill("select[data-gz-key='color']", /Gold/.test(sp.metal) ? sp.metalLabel.split(" ")[1] : "Not applicable");
        fill("select[name='stones']", sp.iced ? "Yes, please quote" : "No stones");
        fill("textarea[name='details']", "Design concept " + concept.id + ": " + concept.summary + " (" + sp.style + ")" + (sp.photo ? " · made from the customer's inspiration photo" : ""));
      });
      push("grillz_design_attached", { concept_id: concept.id });
    }

    document.querySelectorAll("[data-gz-detach]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var f = btn.closest("form");
        setHidden(f, "concept_id", ""); setHidden(f, "concept_image_url", "");
        btn.closest("[data-gz-attached]").hidden = true;
        var share = f.querySelector("[data-gz-share]");
        if (share) { share.hidden = true; share.querySelector("input").checked = false; }
      });
    });

    async function generate(mode) {
      if (state.busy) return;
      if (honey && honey.value.trim()) return;
      var sp = spec();
      var revision = mode === "revise" ? revisionEl.value.trim() : "";
      if (mode === "revise" && !revision) { say("Tell us what you'd like changed first.", "error"); revisionEl.focus(); return; }

      state.busy = true;
      [genBtn, updBtn, altBtn].forEach(function (b) { b.disabled = true; });
      genBtn.textContent = "Creating…";
      say("", "");
      showLoading(true);
      push("grillz_design_generate_attempt", { mode: mode, style: sp.style, metal: sp.metal });

      var body = {
        piece: "Grillz", metal: sp.metalLabel, stones: sp.stones, budget: "", size: sp.size, notes: sp.notes,
        revision: revision, mode: mode, referenceConceptId: mode === "revise" && state.concept ? state.concept.id : "", website: "",
        referenceImage: mode !== "revise" && state.photo ? state.photo : ""
      };
      sp.photo = Boolean(body.referenceImage);
      try {
        var data;
        if (demo) {
          await new Promise(function (r) { setTimeout(r, 2500); });
          state.demoCount++;
          data = { ok: true, conceptId: "HOG-CUSTOM-DEMO" + state.demoCount, image: "grillz-designs/fang-design-preview.jpg", imageUrl: "",
            summary: ["Grillz", sp.metalLabel, sp.stones, sp.size].join(" · "), remaining: Math.max(0, 3 - state.demoCount) };
        } else {
          var res = await fetch(STUDIO_API, { method: "POST", headers: { "Content-Type": "application/json", "Accept": "application/json" }, body: JSON.stringify(body) });
          data = await res.json().catch(function () { return {}; });
          if (!res.ok || !data.ok) {
            if (typeof data.remaining === "number") setRemaining(data.remaining);
            throw new Error(data.error || "We couldn't create your preview this time. Please try again, or call (631) 264-6610.");
          }
        }
        var concept = { id: data.conceptId, image: data.image, imageUrl: data.imageUrl || "", summary: data.summary, spec: sp, price: priceLine(sp) };
        state.history.push(concept);
        showLoading(false);
        select(concept);
        if (revision) revisionEl.value = "";
        setRemaining(data.remaining);
        say(demo ? "Demo concept (local preview only)." : "", demo ? "success" : "");
        push("grillz_design_generated", { concept_id: concept.id, mode: mode, style: sp.style, metal: sp.metal });
      } catch (err) {
        showLoading(false);
        if (state.concept) { img.hidden = false; empty.hidden = true; }
        say(err && err.message ? err.message : "We couldn't reach the design studio. Please try again, or call (631) 264-6610.", "error");
        push("grillz_design_failed", { mode: mode });
      } finally {
        state.busy = false;
        genBtn.textContent = "Generate My Design";
        if (!/used today/.test(remainingEl.textContent)) [genBtn, updBtn, altBtn].forEach(function (b) { b.disabled = false; });
      }
    }

    genBtn.addEventListener("click", function () { generate("create"); });
    updBtn.addEventListener("click", function () { generate("revise"); });
    altBtn.addEventListener("click", function () { generate("alternate"); });
    revisionEl.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); generate("revise"); } });

    /* "Text me my design": saves a lead with the concept link through /api/leads.
       There is no SMS service on the site, so the store texts it from the
       store phone; the lead email has the number and the concept image link. */
    var textForm = $s("gz-textme");
    if (textForm) {
      var textStatus = textForm.querySelector(".hog-status");
      var textBtn = $s("gz-textme-send");
      var textStarted = Date.now(), textSentFor = "";
      var sayText = function (msg, kind) { textStatus.className = "hog-status" + (kind ? " is-" + kind : ""); textStatus.textContent = msg; };
      // A new or different concept can be texted too.
      textForm.addEventListener("gz:concept", function () {
        if (state.concept && textSentFor !== state.concept.id) { textBtn.disabled = false; textBtn.textContent = "Text Me My Design"; sayText("", ""); }
      });
      textForm.addEventListener("submit", async function (e) {
        e.preventDefault();
        var c = state.concept;
        if (!c) return;
        if ($s("t-website").value.trim()) return;
        if (textSentFor === c.id) { sayText("This design is already on its way to your phone ✓", "success"); return; }
        if (!textForm.reportValidity()) return;
        var phone = $s("t-phone").value.trim();
        if (phone.replace(/\D/g, "").length < 10) { sayText("Please enter a 10-digit mobile number.", "error"); $s("t-phone").focus(); return; }
        // Optional email: /api/leads emails the design straight to it (customer copy).
        var email = $s("t-email") ? $s("t-email").value.trim() : "";
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { sayText("Please check your email address, or leave it blank.", "error"); $s("t-email").focus(); return; }
        if (Date.now() - textStarted < 1500) { sayText("Please check your number, then tap again.", "error"); textStarted = Date.now() - 1600; return; }
        var absolute = c.imageUrl ? location.origin + c.imageUrl : "";
        var payload = {
          leadType: "service",
          website: "",
          _subject: "Text this grillz design — " + c.id,
          _template: "table",
          service: "Grillz Design · Text Me",
          source: "HandsOfGoldNY.com grillz design studio",
          page: window.location.href,
          submitted_at: new Date().toLocaleString(),
          consent: "Customer asked to be texted this design, agreed to be contacted by text, phone or email by Hands of Gold, and accepted the Terms and Privacy Policy.",
          name: $s("t-name").value.trim(),
          phone: phone,
          email: email,
          piece: "Grillz · " + c.summary,
          metal: c.spec.metalLabel,
          concept_id: c.id,
          concept_image_url: absolute || ("Not stored. Ask the customer for concept " + c.id),
          request_summary: "TEXT THIS DESIGN to " + phone + " · concept " + c.id + " · " + c.summary + " (" + c.spec.style + ") · " + c.price + shareNote(textForm),
          contact_time: "Text the design to the customer"
        };
        try {
          var params = new URLSearchParams(window.location.search);
          payload.utm_source = params.get("utm_source") || "direct / unknown";
          payload.utm_campaign = params.get("utm_campaign") || "";
        } catch (e2) {}
        textBtn.disabled = true; textBtn.textContent = "Sending…";
        try {
          var res = await fetch("/api/leads", { method: "POST", headers: { "Content-Type": "application/json", "Accept": "application/json" }, body: JSON.stringify(payload) });
          var out = await res.json().catch(function () { return {}; });
          if (!res.ok || out.success !== true) throw new Error(out.error || "We couldn't save that just now.");
          textSentFor = c.id;
          sayText("Got it ✓ " + (out.customerCopy ? "Your design is on its way to " + email + ", and we'll" : "We'll") + " text concept " + c.id + " to " + phone + ", usually within a few hours during store hours.", "success");
          textBtn.textContent = "Sent ✓";
          push("grillz_design_text_me", { concept_id: c.id, lead_id: out.leadId || "" });
        } catch (err) {
          sayText((err && err.message ? err.message + " " : "") + "You can also call us at (631) 264-6610.", "error");
          textBtn.textContent = "Text Me My Design";
          push("grillz_design_text_me_error", { concept_id: c.id });
        } finally {
          textBtn.disabled = textSentFor === c.id;
        }
      });
    }

    function reveal(perVisitor) {
      section.hidden = false;
      if (perVisitor) remainingEl.textContent = "Up to " + perVisitor + " concepts per day.";
      push("grillz_design_studio_view", { demo: demo });
    }

    if (demo) { reveal(3); return; }
    var ctrl = ("AbortController" in window) ? new AbortController() : null;
    var t = ctrl ? setTimeout(function () { ctrl.abort(); }, 5000) : null;
    fetch(STUDIO_API + "?probe=1", { headers: { "Accept": "application/json" }, signal: ctrl ? ctrl.signal : undefined })
      .then(function (r) { return r.ok ? r.json() : {}; })
      .then(function (p) { if (t) clearTimeout(t); if (p && p.available) reveal(p.perVisitor); })
      .catch(function () { /* studio stays hidden; the rest of the page is unaffected */ });
  }

  /* ---------- sticky mobile call-to-action ---------- */
  function initSticky() {
    var bar = document.querySelector(".gz-sticky");
    if (!bar) return;
    document.body.classList.add("gz-has-sticky");
    var formInView = false;
    var targets = document.querySelectorAll(".hog-form, .gz-quiz");
    if ("IntersectionObserver" in window && targets.length) {
      var seen = new Set();
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { if (en.isIntersecting) seen.add(en.target); else seen.delete(en.target); });
        formInView = seen.size > 0;
        update();
      });
      targets.forEach(function (t) { io.observe(t); });
    }
    function update() { bar.classList.toggle("is-on", window.scrollY > 420 && !formInView); }
    window.addEventListener("scroll", update, { passive: true });
    update();
  }

  function boot() {
    document.querySelectorAll("[data-gz-art]").forEach(renderArt);
    document.querySelectorAll("form[data-gz-summary]").forEach(initSummaryForm);
    document.querySelectorAll(".gz-quiz").forEach(initQuiz);
    document.querySelectorAll(".gz-show").forEach(initSlideshow);
    document.querySelectorAll("form.gz-deposit").forEach(initDeposit);
    document.querySelectorAll("[data-gz-studio]").forEach(initStudio);
    initPartnerTracking();
    initSticky();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
