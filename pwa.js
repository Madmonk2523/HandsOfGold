(function(){document.querySelectorAll('link[rel="icon"],link[rel="shortcut icon"]').forEach(function(el){el.remove();});var icon=document.createElement("link");icon.rel="icon";icon.type="image/png";icon.href="/favicon.png?v=20261006";document.head.appendChild(icon);})();
/* Meta/TikTok ad pixels on every page (ad-pixels.js decides what to load and skips internal pages). */
(function(){if(document.querySelector('script[src*="ad-pixels.js"]'))return;var s=document.createElement("script");s.src="/ad-pixels.js?v=20261016";s.async=true;(document.head||document.documentElement).appendChild(s);})();
/* Hands of Gold - PWA registration + "Add to Home Screen" prompt.
 * Self-contained on purpose: nothing here touches script.js or style.css.
 *
 * Two rules it obeys, so it never fights the site:
 *   1. It stays hidden while the legacy offer popup (or the cart drawer, or any
 *      other overlay) is open. That lead capture is worth more than an install.
 *   2. It sits ABOVE the sticky mobile dock instead of covering Call/Custom/Visit.
 */
(function () {
  'use strict';

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/service-worker.js').catch(function () { /* silent */ });
    });
  }

  var KEY = 'hog-install-dismissed';
  var dl = (window.dataLayer = window.dataLayer || []);

  function isDismissed() {
    try { return localStorage.getItem(KEY) === '1'; } catch (e) { return false; }
  }
  function setDismissed() {
    try { localStorage.setItem(KEY, '1'); } catch (e) { /* private mode */ }
  }

  var installed = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
                  window.navigator.standalone === true;
  if (installed || isDismissed()) { return; }

  var ua = navigator.userAgent || '';
  var isIOS = /iPad|iPhone|iPod/.test(ua) ||
              (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);

  var bar = null;

  /* --- is something more important already on screen? ---
   * Must be VISIBLE, not merely present. This site keeps a product modal in the
   * DOM with aria-modal="true" at all times, so presence alone means nothing. */
  function reallyVisible(el) {
    if (!el) { return false; }
    var cs = window.getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') { return false; }
    if (parseFloat(cs.opacity) < 0.1) { return false; }
    var r = el.getBoundingClientRect();
    return r.width > 1 && r.height > 1;
  }

  function overlayOpen() {
    
    if (reallyVisible(document.querySelector('.cart-drawer.is-open'))) { return true; }

    var els = document.querySelectorAll('[aria-modal="true"], .modal, .popup, .overlay, body > div, body > section, body > aside');
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (el === bar || (bar && bar.contains(el)) || el.contains(bar)) { continue; }
      if (window.getComputedStyle(el).position !== 'fixed') { continue; }
      if (!reallyVisible(el)) { continue; }
      var r = el.getBoundingClientRect();
      /* a large fixed panel covering the screen = a modal worth waiting for */
      if (r.width > window.innerWidth * 0.5 && r.height > window.innerHeight * 0.4) { return true; }
    }
    return false;
  }

  /* --- clear whatever the site already sticks to the bottom ---
   * Not just the mobile dock: the EN/ES language toggle floats above it.
   * Measure every fixed bar down there and sit above the highest one. */
  function bottomInset() {
    var vh = window.innerHeight;
    var topMost = vh;
    var kids = document.body.children;
    for (var i = 0; i < kids.length; i++) {
      var el = kids[i];
      if (el === bar) { continue; }
      var cs = window.getComputedStyle(el);
      if (cs.position !== 'fixed' || cs.display === 'none' || cs.visibility === 'hidden') { continue; }
      if (parseFloat(cs.opacity) < 0.1) { continue; }
      var r = el.getBoundingClientRect();
      if (r.height < 1 || r.height > vh * 0.4) { continue; }   /* a bar, not a modal */
      if (r.bottom < vh * 0.6) { continue; }                   /* bottom furniture only */
      if (r.top < topMost) { topMost = r.top; }
    }
    return topMost >= vh ? 12 : Math.round(vh - topMost) + 10;
  }

  function position() {
    if (bar) { bar.style.bottom = bottomInset() + 'px'; }
  }
  window.addEventListener('resize', position);
  window.addEventListener('orientationchange', function () { setTimeout(position, 250); });

  function build(message, buttonLabel, onClick) {
    if (bar) { return; }
    bar = document.createElement('div');
    bar.setAttribute('role', 'dialog');
    bar.setAttribute('aria-label', 'Add Hands of Gold to your home screen');
    bar.style.cssText = [
      'position:fixed', 'left:12px', 'right:12px', 'bottom:' + bottomInset() + 'px',
      'z-index:9998',                      /* under the dock (9999), over the page */
      'display:flex', 'align-items:center', 'gap:12px',
      'padding:12px 14px', 'border-radius:14px',
      'background:rgba(15,15,16,.97)', 'border:1px solid rgba(212,175,55,.45)',
      'box-shadow:0 10px 30px rgba(0,0,0,.55)',
      'font-family:inherit', 'color:#f5f1e6',
      'transform:translateY(180%)', 'transition:transform .35s ease',
      'max-width:520px', 'margin:0 auto'
    ].join(';');

    var icon = document.createElement('img');
    icon.src = '/icon-192.png';
    icon.alt = '';
    icon.width = 40; icon.height = 40;
    icon.style.cssText = 'width:40px;height:40px;border-radius:9px;flex:0 0 auto';

    var text = document.createElement('div');
    text.style.cssText = 'flex:1 1 auto;font-size:13px;line-height:1.35';
    text.innerHTML = message;

    var close = document.createElement('button');
    close.type = 'button';
    close.setAttribute('aria-label', 'Dismiss');
    close.textContent = '×';
    close.style.cssText = 'flex:0 0 auto;background:none;border:0;color:#9b958a;font-size:22px;line-height:1;cursor:pointer;padding:0 4px';
    close.onclick = function () { setDismissed(); hide(); };

    bar.appendChild(icon);
    bar.appendChild(text);

    if (buttonLabel) {
      var cta = document.createElement('button');
      cta.type = 'button';
      cta.textContent = buttonLabel;
      cta.style.cssText = 'flex:0 0 auto;background:linear-gradient(180deg,#e8c766,#c9a227);color:#1a1408;border:0;border-radius:9px;padding:9px 15px;font-size:13px;font-weight:700;cursor:pointer';
      cta.onclick = onClick;
      bar.appendChild(cta);
    }
    bar.appendChild(close);

    document.body.appendChild(bar);
    requestAnimationFrame(function () { position(); bar.style.transform = 'translateY(0)'; });
  }

  function hide() {
    if (!bar) { return; }
    bar.style.transform = 'translateY(180%)';
    var dead = bar;
    bar = null;
    setTimeout(function () { if (dead.parentNode) { dead.parentNode.removeChild(dead); } }, 400);
  }

  /* Wait for engagement, THEN wait for a clear screen. */
  function whenEngaged(fn) {
    var fired = false;

    var waited = 0;
    function clearThen() {
      if (isDismissed()) { return; }
      if (overlayOpen() && waited < 90000) { waited += 800; setTimeout(clearThen, 800); return; }
      if (overlayOpen()) { return; }   /* give up rather than fight the page */
      fn();
    }
    function go() {
      if (fired) { return; }
      fired = true;
      window.removeEventListener('scroll', onScroll);
      clearThen();
    }
    function onScroll() { if (window.scrollY > 600) { go(); } }

    window.addEventListener('scroll', onScroll, { passive: true });
    setTimeout(go, 25000);
  }

  /* Android / Chrome: real install prompt. */
  var deferred = null;
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferred = e;
    whenEngaged(function () {
      build('Keep <strong>Hands of Gold</strong> one tap away on your phone.', 'Install', function () {
        hide();
        dl.push({ event: 'pwa_install_clicked' });
        deferred.prompt();
        deferred.userChoice.then(function (choice) {
          dl.push({ event: 'pwa_install_' + choice.outcome });
          if (choice.outcome === 'dismissed') { setDismissed(); }
          deferred = null;
        });
      });
      dl.push({ event: 'pwa_prompt_shown', pwa_platform: 'android' });
    });
  });

  window.addEventListener('appinstalled', function () {
    setDismissed();
    hide();
    dl.push({ event: 'pwa_installed' });
  });

  /* iOS: Safari shows no prompt of its own, so tell them where to tap. */
  if (isIOS && isSafari) {
    whenEngaged(function () {
      build(
        'Add <strong>Hands of Gold</strong> to your home screen: tap the Share button, then <strong>Add to Home Screen</strong>.',
        null, null
      );
      dl.push({ event: 'pwa_prompt_shown', pwa_platform: 'ios' });
    });
  }
})();


/* Labor Day 2026 campaign removed 2026-09-08 at Julio's request. */

/* =====================================================================
   HOG SIGN-UP — "Sign up now, get 10% off (up to $100)" (Oct 2026)
   Replaces the VIP list popup that was switched off on 2026-09-14.
   The code is created by /api/signup, shown here and emailed to the
   customer; staff find it on the staff page by searching the code.

   Opens on its own once per visitor (after 12 s on the page, then 20 s or
   30% scroll), never on checkout/confirmation/staff pages, never over
   another dialog or while someone is typing in a form. Any element with
   data-hog-signup opens it on demand (homepage "Sign up now" button).
   ===================================================================== */
(function () {
  'use strict';

  var LEAD_TYPE = 'welcome_offer';
  var SUBMITTED = 'hog_signup_done';        // never auto-open again
  var DISMISSED = 'hog_signup_dismissed_at'; // auto-open again after 30 days
  var DISMISS_DAYS = 30;

  /* Pages where a popup would be wrong (it still opens from a data-hog-signup click). */
  var BLOCKED = ['/requests', '/jewelry-catalog', '/staff', '/offline', '/order-confirmed', '/reserved', '/passport-', '/grillz-paid', '/b/'];
  var path = location.pathname.toLowerCase();
  var autoAllowed = true;
  for (var i = 0; i < BLOCKED.length; i++) {
    if (path.indexOf(BLOCKED[i]) > -1) { autoAllowed = false; }
  }

  function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } }
  function push(evt, data) { try { window.dataLayer = window.dataLayer || []; var o = { event: evt }; for (var k in (data || {})) { o[k] = data[k]; } window.dataLayer.push(o); } catch (e) {} }

  if (get(SUBMITTED) === '1') { autoAllowed = false; }
  var when = parseInt(get(DISMISSED) || '0', 10);
  if (when && (Date.now() - when) < DISMISS_DAYS * 864e5) { autoAllowed = false; }

  var box = null, lastFocus = null, shown = false, startedAt = 0;

  function build() {
    if (box) { return; }
    box = document.createElement('div');
    box.className = 'hog-vip hog-signup';
    box.id = 'hog-vip';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-labelledby', 'hog-diamond-title');
    box.setAttribute('aria-hidden', 'true');
    box.innerHTML =
      '<div class="hog-vip-scrim" data-vip-close></div>' +
      '<div class="hog-vip-card">' +
        '<button type="button" class="hog-vip-x" aria-label="Close" data-vip-close>&times;</button>' +
        '<div class="hog-diamond-invite">' +
 '<div class="hog-diamond-art" role="img" aria-label="Neon New York City skyline with the Hands of Gold storefront"></div>' +
 '<div class="hog-diamond-offer"><p>Hands of Gold</p><h2 id="hog-diamond-title">10% OFF</h2><span>Your next purchase &middot; up to $100</span><button type="button" id="hog-diamond-start">Get my code &rarr;</button></div></div>' +
 '<div class="hog-vip-details" hidden>' +
 '<p class="hog-vip-eyebrow">Hands of Gold &middot; Since 1983</p>' +
        '<h2 id="hog-vip-title">Sign up now. Get 10% off.</h2>' +
        '<p class="hog-vip-copy">Get a coupon for <strong>10% off your next purchase, up to $100 off</strong>. We&rsquo;ll show your code here and email it to you right away.</p>' +
        '<form class="hog-vip-form" id="hog-vip-form" novalidate>' +
          '<label>Name<input type="text" id="hog-vip-name" name="name" autocomplete="name" required></label>' +
          '<label>Email<input type="email" id="hog-vip-email" name="email" autocomplete="email" inputmode="email" required></label>' +
          '<label>Mobile <small>(optional, for text offers)</small><input type="tel" id="hog-vip-phone" name="phone" autocomplete="tel" inputmode="tel"></label>' +
          '<div class="hog-vip-hp" aria-hidden="true"><label>Website<input type="text" id="hog-vip-website" tabindex="-1" autocomplete="off"></label></div>' +
          '<label class="hog-vip-consent"><input type="checkbox" id="hog-vip-consent" required>' +
            '<span>Yes, email me my code and Hands of Gold offers (and texts if I add my number). I accept the ' +
            '<a href="/terms.html" target="_blank" rel="noopener">Terms</a> and <a href="/privacy.html" target="_blank" rel="noopener">Privacy Policy</a>. Unsubscribe anytime.</span></label>' +
          '<button type="submit" class="hog-vip-submit" id="hog-vip-submit">Get My 10% Code</button>' +
          '<p class="hog-vip-status" id="hog-vip-status" aria-live="polite"></p>' +
        '</form>' +
        '<div class="hog-signup-done" id="hog-signup-done" hidden>' +
          '<p class="hog-signup-label">Your code</p>' +
          '<p class="hog-signup-code" id="hog-signup-code"></p>' +
          '<p class="hog-signup-exp" id="hog-signup-exp"></p>' +
          '<button type="button" class="hog-vip-submit" id="hog-signup-copy">Copy Code</button>' +
          '<p class="hog-vip-copy">Use it in store, or mention it when you order by phone or text at <a href="tel:6312646610">(631) 264-6610</a>. Shopping online? Call or text us before checkout for a discounted payment link.</p>' +
          '<a class="hog-signup-shop" href="/index.html#featured-products" data-vip-close>Shop in-stock pieces &rarr;</a>' +
        '</div>' +
        '<button type="button" class="hog-vip-no" data-vip-close>No thanks</button>' +
        '<p class="hog-vip-fine">10% off one purchase, up to $100 off. One code per customer, single use, valid 30 days. ' +
          'Not valid on past purchases or gift cards; can&rsquo;t be combined with other coupons. 494 Oak St, Copiague NY &middot; (631) 264-6610</p>' +
      '</div></div>';
    document.body.appendChild(box);
    box.querySelector('#hog-diamond-start').addEventListener('click', expand);
    function expand() {
      box.querySelector('.hog-diamond-invite').hidden = true;
      box.querySelector('.hog-vip-details').hidden = false;
      box.querySelector('.hog-vip-card').classList.add('is-expanded');
      box.setAttribute('aria-labelledby', 'hog-vip-title');
      box.querySelector('#hog-vip-name').focus();
    }

    box.addEventListener('click', function (e) {
      var t = e.target;
      if (t && t.closest && t.closest('[data-vip-close]')) { close(!get(SUBMITTED)); }
    });
    document.addEventListener('keydown', onKey);
    box.querySelector('#hog-vip-form').addEventListener('submit', submit);
    box.querySelector('#hog-signup-copy').addEventListener('click', copyCode);
  }

  function onKey(e) {
    if (!box || !box.classList.contains('is-open')) { return; }
    if (e.key === 'Escape') { close(!get(SUBMITTED)); return; }
    if (e.key !== 'Tab') { return; }
    var f = Array.prototype.filter.call(box.querySelectorAll('button, input, a[href]'), function (el) { return el.offsetParent !== null; });
    if (!f.length) { return; }
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  function open(how) {
    build();
    if (box.classList.contains('is-open')) { return; }
    shown = true;
    startedAt = Date.now();
    lastFocus = document.activeElement;
    box.classList.add('is-open');
    box.setAttribute('aria-hidden', 'false');
    document.documentElement.style.overflow = 'hidden';
    var n = !box.querySelector('.hog-diamond-invite').hidden ? box.querySelector('#hog-diamond-start') : (box.querySelector('#hog-signup-done').hidden ? box.querySelector('#hog-vip-name') : box.querySelector('#hog-signup-copy'));
    if (n) { try { n.focus({ preventScroll: true }); } catch (e) { n.focus(); } }
    push('signup_popup_shown', { trigger: how || 'auto' });
  }

  function close(remember) {
    if (!box) { return; }
    box.classList.remove('is-open');
    box.setAttribute('aria-hidden', 'true');
    document.documentElement.style.overflow = '';
    if (remember) { set(DISMISSED, String(Date.now())); }
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (e) {} }
  }

  function copyCode() {
    var code = box.querySelector('#hog-signup-code').textContent;
    var btn = box.querySelector('#hog-signup-copy');
    function done() { btn.textContent = 'Copied ✓'; setTimeout(function () { btn.textContent = 'Copy Code'; }, 2000); }
    if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(code).then(done, function () {}); }
    push('signup_code_copied', {});
  }

  async function submit(e) {
    e.preventDefault();
    var form = e.target;
    var status = box.querySelector('#hog-vip-status');
    var btn = box.querySelector('#hog-vip-submit');
    if (box.querySelector('#hog-vip-website').value.trim()) { return; }   /* bot */
    if (!form.reportValidity()) { return; }
    if (Date.now() - startedAt < 1500) { status.className = 'hog-vip-status is-error'; status.textContent = 'Please check your details, then tap again.'; startedAt = 0; return; }

    var name = box.querySelector('#hog-vip-name').value.trim();
    btn.disabled = true;
    btn.textContent = 'Getting your code…';
    status.className = 'hog-vip-status';
    status.textContent = '';

    var q = new URLSearchParams(location.search);
    var body = {
      leadType: LEAD_TYPE,
      name: name,
      email: box.querySelector('#hog-vip-email').value.trim(),
      phone: box.querySelector('#hog-vip-phone').value.trim(),
      page: location.href,
      referrer: document.referrer || '',
      utm_source: q.get('utm_source') || 'direct / unknown',
      utm_campaign: q.get('utm_campaign') || '',
      submitted_at: new Date().toLocaleString(),
      website: '',
      consent: true
    };

    try {
      var r = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(body)
      });
      var d = await r.json().catch(function () { return {}; });
      if (!r.ok || d.success !== true) { throw new Error(d.error || ''); }
      set(SUBMITTED, '1');
      if (d.existing) {
        status.className = 'hog-vip-status is-success';
        status.textContent = 'You already have a code. ' + (d.resent ? 'We just emailed it to you again.' : 'Check your email for it, or call (631) 264-6610.');
        btn.textContent = 'Already signed up ✓';
        push('signup_existing', {});
        return;
      }
      box.querySelector('#hog-vip-form').hidden = true;
      box.querySelector('.hog-vip-no').hidden = true;
      box.querySelector('#hog-vip-title').textContent = 'You’re in, ' + name.split(' ')[0] + '!';
      box.querySelector('.hog-vip-copy').textContent = d.emailed ? 'Here’s your code. We also emailed it to you.' : 'Here’s your code. Save it or take a screenshot.';
      box.querySelector('#hog-signup-code').textContent = d.code;
      box.querySelector('#hog-signup-exp').textContent = 'Valid through ' + d.expires;
      box.querySelector('#hog-signup-done').hidden = false;
      box.querySelector('#hog-signup-copy').focus();
      push('signup_complete', { lead_type: LEAD_TYPE, emailed: !!d.emailed });
    } catch (err) {
      status.className = 'hog-vip-status is-error';
      status.textContent = (err && err.message ? err.message + ' ' : '') + 'You can also call (631) 264-6610.';
      btn.disabled = false;
      btn.textContent = 'Get My 10% Code';
    }
  }

  /* Never fight another dialog, and never interrupt someone typing in a form. */
  function armed() {
    var other = document.querySelector('.lead-popup.is-open, .hog-ldpop.is-open, [aria-modal="true"].is-open, .gz-studio-panel:not([hidden])');
    if (other && other !== box) { return false; }
    var a = document.activeElement;
    if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && !(box && box.contains(a))) { return false; }
    return true;
  }
  function maybeOpen() {
    if (shown) { return; }
    if (/^#(?:sell-watches-gold|quick-gold-estimate|hero-gold-register)$/.test(location.hash)) { return; }
    if (!armed()) { setTimeout(maybeOpen, 2000); return; }
    open('auto');
  }

  function start() {
    var sheet = document.createElement('link'); sheet.rel = 'stylesheet'; sheet.href = '/assets/css/diamond-signup-20261019.css'; document.head.appendChild(sheet);
    // On-demand buttons work everywhere, even after a dismissal.
    document.addEventListener('click', function (e) {
      var t = e.target && e.target.closest ? e.target.closest('[data-hog-signup]') : null;
      if (!t) { return; }
      e.preventDefault();
      var trigger=t.getAttribute('data-hog-signup') || 'button';
      open(trigger);
      if(trigger==='forms-directory'){var expandButton=box.querySelector('#hog-diamond-start');if(expandButton&&!box.querySelector('.hog-diamond-invite').hidden)expandButton.click();}
    });
    if (!autoAllowed) { return; }

    /* A visitor who clicks a nav link jumps straight past 30% of the page in
       one animated scroll. Nothing may fire for the first 12 seconds. */
    var MIN_DWELL = 12000;
    var landed = Date.now();
    var scrolledEnough = false;
    var t = setTimeout(maybeOpen, 20000);

    function tryOpen() {
      if (Date.now() - landed < MIN_DWELL) { setTimeout(tryOpen, 1500); return; }
      clearTimeout(t);
      maybeOpen();
    }
    function onScroll() {
      var h = document.documentElement.scrollHeight - window.innerHeight;
      if (h > 0 && (window.scrollY / h) > 0.3 && !scrolledEnough) {
        scrolledEnough = true;
        window.removeEventListener('scroll', onScroll);
        tryOpen();
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', start); }
  else { start(); }
})();

/* Customer forms stay one tap away across the storefront. */
(function(){
  function formsAccess(){
    var actions=document.querySelector('.hog-global-actions');
    if(actions&&!actions.querySelector('.hog-forms-link')){
      var a=document.createElement('a');a.href='/requests.html';a.className='hog-forms-link';a.textContent='Forms';a.setAttribute('aria-label','All forms and requests');
      var menu=actions.querySelector('.hog-global-menu');if(menu)actions.insertBefore(a,menu);else actions.appendChild(a);
    }
    document.querySelectorAll('.hog-global-menu-panel,.hog-global-footer-links').forEach(function(parent){
      if(parent.querySelector('a[href="/requests.html"]'))return;
      var a=document.createElement('a');a.href='/requests.html';a.textContent='Forms & Requests';parent.appendChild(a);
    });
    var homeAliases={'#sell-watches-gold':'/#quick-gold-estimate','#visit':'/#store-info','#gift-cards':'/gift-cards.html','#repairs':'/jewelry-repair.html#repair-form','#engraving':'/engraving.html#request-form'};
    document.querySelectorAll('a[href]').forEach(function(a){
      var href=a.getAttribute('href')||'';
      if(/^(?:\/)?jewelry-repair\.html(?:#request)?$/.test(href))a.href='/jewelry-repair.html#repair-form';
      if(/^(?:\/)?custom-jewelry(?:\.html)?(?:[?#].*)?$/.test(href))a.href='/design-studio.html';
      var destination;try{destination=new URL(a.getAttribute('href'),location.href);}catch(e){return;}
      if(destination.origin!==location.origin)return;
      var onHome=/^\/(?:index\.html)?$/.test(destination.pathname);
      var goldPage=/^\/sell-gold(?:\.html)?\/?$/.test(destination.pathname);
      if(onHome&&homeAliases[destination.hash])a.setAttribute('href',homeAliases[destination.hash]);
      if(goldPage&&(!destination.hash||destination.hash==='#request'||a.closest('nav,.hog-global-footer-links')))a.setAttribute('href','/#quick-gold-estimate');
      if(a.getAttribute('href')==='/#quick-gold-estimate'&&a.closest('nav,.hog-global-footer-links'))a.textContent='We Buy Gold';
    });
    // Put gold buying beside Grillz and keep the new watch collection one tap away.
    document.querySelectorAll('.hog-global-nav.site-nav,.hog-global-menu-panel').forEach(function(parent){
      var gold=parent.querySelector('a[href="/#quick-gold-estimate"]');
      if(!gold){gold=document.createElement('a');gold.href='/#quick-gold-estimate';}
      gold.textContent='We Buy Gold';
      var grillz=parent.querySelector('a[href="/grillz.html"]'),monaci=parent.querySelector('a[href="/classic-cuban-collection.html"]');
      if(grillz)parent.insertBefore(gold,grillz.nextSibling);else if(monaci)parent.insertBefore(gold,monaci);else parent.appendChild(gold);
      var watch=parent.querySelector('a[href="/watches.html"]');
      if(!watch){watch=document.createElement('a');watch.href='/watches.html';watch.textContent='Watches';}
      parent.insertBefore(watch,gold.nextSibling);
      if(location.pathname==='/watches.html')watch.setAttribute('aria-current','page');
    });
    // Keep every service available without repeating its promotion on the homepage.
    document.querySelectorAll('.hog-global-menu-panel,.hog-global-footer-links').forEach(function(parent){
      [['/style-lab.html#set','Style Lab · Build a Set & Try On'],['/made-to-order.html','Made to Order'],['/#quick-gold-estimate','We Buy Gold'],['/watches.html','Watches'],['/sell-watch.html#request-form','Sell a Watch'],['/engraving.html#request-form','Engraving'],['/gift-cards.html','Gift Cards'],['/#store-info','Visit Us']].forEach(function(row){
        var exists=Array.prototype.some.call(parent.querySelectorAll('a[href]'),function(a){return a.getAttribute('href')===row[0];});
        if(!exists){var a=document.createElement('a');a.href=row[0];a.textContent=row[1];parent.appendChild(a);}
      });
    });
    document.addEventListener('click',function(e){
      var link=e.target.closest&&e.target.closest('a[href]');
      if(!link||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;
      var destination;try{destination=new URL(link.href,location.href);}catch(err){return;}
      if(destination.origin!==location.origin)return;
      var menu=link.closest('.hog-global-menu');if(menu)menu.open=false;
      if(!/^\/(?:index\.html)?$/.test(location.pathname)||!/^\/(?:index\.html)?$/.test(destination.pathname))return;
      var target=destination.hash&&document.getElementById(destination.hash.slice(1));
      if(!target)return;
      e.preventDefault();history.pushState(null,'',location.pathname+destination.search+destination.hash);
      requestAnimationFrame(function(){target.scrollIntoView({behavior:'instant',block:'start'});});
    });
    function legacyDestination(){
      if(!/^\/(?:index\.html)?$/.test(location.pathname))return;
      var next=homeAliases[location.hash];if(!next)return;
      if(next.indexOf('/#')!==0){location.replace(next);return;}
      history.replaceState(null,'',location.pathname+location.search+next.slice(1));
      var target=document.getElementById(next.slice(2));if(target)target.scrollIntoView({behavior:'instant',block:'start'});
    }
    if(document.readyState==='complete')legacyDestination();else window.addEventListener('load',legacyDestination,{once:true});
    window.addEventListener('hashchange',legacyDestination);
    var style=document.createElement('style');style.textContent='@media(min-width:1261px){.hog-global-header .hog-global-nav a{padding:0 8px!important}}.hog-forms-link{display:inline-flex;align-items:center;justify-content:center;min-height:42px;padding:0 11px;border:1px solid #d9be7c;border-radius:10px;color:#efd8a3!important;background:#17191f;text-decoration:none;font-size:.78rem;font-weight:800;white-space:nowrap}.hog-forms-link:hover{background:#30291d}@media(max-width:1260px){.hog-global-nav.site-nav{display:none!important}.hog-global-menu{display:block}.hog-global-actions{margin-left:auto}}@media(max-width:400px){.hog-global-inner{width:calc(100% - 20px)!important;gap:6px!important}.hog-global-brand{gap:6px!important;min-width:0!important}.hog-global-brand img{width:32px!important;height:32px!important}.hog-global-brand-copy strong{font-size:.62rem!important;letter-spacing:.05em!important}.hog-global-brand-copy small{font-size:.45rem!important;letter-spacing:.04em!important}.hog-global-actions{gap:5px!important}.hog-forms-link{min-height:40px;padding:0 7px;font-size:.68rem}}';document.head.appendChild(style);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',formsAccess);else formsAccess();
})();
