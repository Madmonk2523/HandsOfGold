(() => {
  'use strict';
  const root = document.documentElement;
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  let choice = null;
  try { choice = localStorage.getItem('hog-jewelry-motion'); } catch {}
  let running = choice === 'play' || (choice !== 'pause' && !preference.matches);
  const bar = document.createElement('div');
  bar.className = 'hog-motion-bar';
  const label = document.createElement('span');
  label.textContent = '✦ Jewelry motion';
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'hog-motion-toggle';
  bar.append(label, toggle);
  const anchor = document.querySelector('main, .hog-sub-hero, .cc-hero');
  if (!anchor) return;
  anchor.before(bar);
  const sync = () => {
    root.dataset.hogMotion = running ? 'running' : 'paused';
    toggle.textContent = running ? 'Pause' : 'Play';
    toggle.setAttribute('aria-label', running ? 'Pause jewelry animations' : 'Play jewelry animations');
    toggle.setAttribute('aria-pressed', String(running));
  };
  toggle.addEventListener('click', () => {
    running = !running;
    choice = running ? 'play' : 'pause';
    try { localStorage.setItem('hog-jewelry-motion', choice); } catch {}
    sync();
  });
  preference.addEventListener('change', () => { if (choice === null) { running = !preference.matches; sync(); } });
  sync();
  document.querySelectorAll('.catalog-product-image, .product-media-card, .cc-hero-visual').forEach(el => el.classList.add('hog-glint-surface'));
  const targets = document.querySelectorAll('.catalog-product-card, .product-info-card, .cc-product-card, .hog-sub-card');
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        if (running) entry.target.classList.add('hog-motion-reveal');
        observer.unobserve(entry.target);
      });
    }, { threshold: .08 });
    targets.forEach((el,index) => { el.style.setProperty('--hog-reveal-delay',`${(index % 3) * 65}ms`); observer.observe(el); });
  }
})();
