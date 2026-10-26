(() => {
  'use strict';
  const cards = [...document.querySelectorAll('#archive-grid .catalog-product-card')];
  const buttons = [...document.querySelectorAll('.catalog-filter')];
  const search = document.getElementById('archive-search');
  const count = document.getElementById('archive-visible-count');
  const empty = document.getElementById('archive-empty');
  let filter = 'all';

  cards.forEach(card => {
    const type = card.querySelector('.catalog-product-meta span:first-child')?.textContent?.trim().toLowerCase() || '';
    const title = card.querySelector('h3')?.textContent?.toLowerCase() || '';
    if (/\bchains?\b/.test(title) && !title.includes('pendant')) {
      card.dataset.category = 'chain';
      const label = card.querySelector('.catalog-product-meta span:first-child');
      if (label) label.textContent = 'Chain';
    } else if (type === 'pendant' || title.includes('pendant')) card.dataset.category = 'pendant';
  });
  const update = () => {
    const query = search.value.trim().toLowerCase();
    let visible = 0;
    cards.forEach(card => {
      card.hidden = (filter !== 'all' && card.dataset.category !== filter) || !card.textContent.toLowerCase().includes(query);
      if (!card.hidden) visible++;
    });
    count.textContent = String(visible);
    empty.hidden = visible !== 0;
  };
  buttons.forEach(button => button.addEventListener('click', () => {
    filter = button.dataset.filter;
    buttons.forEach(item => item.classList.toggle('is-active', item === button));
    update();
  }));
  search.addEventListener('input', update);
  update();

  const videos = [...document.querySelectorAll('#archive-grid video')];
  const load = video => {
    const source = video.querySelector('source[data-src]');
    if (source && !source.src) { source.src = source.dataset.src; video.load(); }
  };
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      const video = entry.target;
      if (entry.isIntersecting && !video.closest('[hidden]')) {
        load(video);
        if (!matchMedia('(prefers-reduced-motion: reduce)').matches) video.play().catch(() => {});
      } else video.pause();
    }), {rootMargin:'120px'});
    videos.forEach(video => observer.observe(video));
  } else videos.forEach(load);
})();
