/* Hands of Gold — Custom Studio handoff (2026-10-12)
   The old in-page builder + AI concept panel is retired. Designs now happen in
   the Jeweler Studio app at /design-studio.html, which requires name, phone and
   email so every design arrives as a lead. This file hides the old builder
   (kept in the DOM so script.js / custom-studio-core.js never hit missing
   elements) and shows a button to the new studio. */
(function () {
  function run() {
    var section = document.getElementById('build-your-ideas');
    if (!section || section.querySelector('.hog-js-cta')) { return; }
    var builder = section.querySelector('#custom-builder');
    if (builder) { builder.style.setProperty('display', 'none', 'important'); builder.setAttribute('aria-hidden', 'true'); }
    var header = section.querySelector('.section-header');
    if (header) {
      var h2 = header.querySelector('h2');
      if (h2) { h2.textContent = 'Design Your Piece Online'; }
      var p = header.querySelector('p:not(.eyebrow)');
      if (p) { p.textContent = 'Pick the piece, metal and stones, describe your idea and watch your design come to life. We review every design and get back to you with a quote.'; }
    }
    var cta = document.createElement('div');
    cta.className = 'hog-js-cta';
    cta.style.cssText = 'display:flex;flex-wrap:wrap;gap:12px;justify-content:center;margin:24px auto 8px;';
    cta.innerHTML =
      '<a class="button button-primary" href="/design-studio.html">Start Designing</a>' +
      '<a class="button button-secondary" href="tel:6312646610">Call (631) 264-6610</a>';
    var container = section.querySelector('.container') || section;
    if (header && header.parentNode === container) { header.insertAdjacentElement('afterend', cta); }
    else { container.appendChild(cta); }
  }
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', run); } else { run(); }
})();
