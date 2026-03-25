const body = document.body;
const header = document.querySelector('.site-header');
const navToggle = document.querySelector('.nav-toggle');
const nav = document.querySelector('.site-nav');
const navLinks = document.querySelectorAll('.site-nav a, .nav-actions a');
const yearTarget = document.getElementById('year');

if (yearTarget) {
  yearTarget.textContent = new Date().getFullYear();
}

const closeMenu = () => {
  body.classList.remove('nav-open');
  if (navToggle) {
    navToggle.setAttribute('aria-expanded', 'false');
    navToggle.setAttribute('aria-label', 'Open navigation menu');
  }
};

if (navToggle && nav) {
  navToggle.addEventListener('click', () => {
    const isOpen = body.classList.toggle('nav-open');
    navToggle.setAttribute('aria-expanded', String(isOpen));
    navToggle.setAttribute('aria-label', isOpen ? 'Close navigation menu' : 'Open navigation menu');
  });

  navLinks.forEach((link) => {
    link.addEventListener('click', closeMenu);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeMenu();
    }
  });
}

const updateHeaderState = () => {
  if (!header) {
    return;
  }

  header.classList.toggle('scrolled', window.scrollY > 12);
};

updateHeaderState();
window.addEventListener('scroll', updateHeaderState, { passive: true });

const revealItems = document.querySelectorAll('[data-reveal]');

if ('IntersectionObserver' in window) {
  const revealObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }

        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    },
    {
      threshold: 0.2,
      rootMargin: '0px 0px -10% 0px',
    }
  );

  revealItems.forEach((item) => revealObserver.observe(item));
} else {
  revealItems.forEach((item) => item.classList.add('is-visible'));
}

const counters = document.querySelectorAll('[data-counter]');

const animateCounter = (element) => {
  const target = Number(element.dataset.counter);
  const duration = 1400;
  const startTime = performance.now();

  const step = (timestamp) => {
    const progress = Math.min((timestamp - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const value = Math.round(target * eased);

    element.textContent = target >= 100 ? `${value}%` : `${value}`;

    if (progress < 1) {
      window.requestAnimationFrame(step);
    } else if (target === 1983) {
      element.textContent = '1983';
    }
  };

  window.requestAnimationFrame(step);
};

if ('IntersectionObserver' in window && counters.length) {
  const counterObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }

        animateCounter(entry.target);
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.6 }
  );

  counters.forEach((counter) => counterObserver.observe(counter));
} else {
  counters.forEach(animateCounter);
}

const reviewsTrack = document.getElementById('reviews-track');
const dotsContainer = document.getElementById('reviews-dots');
const prevButton = document.getElementById('reviews-prev');
const nextButton = document.getElementById('reviews-next');

const metalPriceNodes = {
  XAU: document.getElementById('price-gold'),
  XAG: document.getElementById('price-silver'),
  XPT: document.getElementById('price-platinum'),
};
const metalsUpdatedNode = document.getElementById('metals-updated');

const GOLDAPI_ACCESS_TOKEN = 'goldapi-9a56pxsmn6g021i-io';
const GOLDAPI_BASE_URL = 'https://www.goldapi.io/api';
const METALS_REFRESH_MS = 12 * 60 * 60 * 1000;
const METALS_CACHE_KEY = 'hog-metals-cache-v1';

const formatUsd = (value) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(value);

const toNumber = (value) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return null;
  }

  return value;
};

const formatEasternTimestamp = (timestampMs) =>
  new Date(timestampMs).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/New_York',
    timeZoneName: 'short',
  });

const paintMetalsTicker = (prices, updatedAtMs) => {
  metalPriceNodes.XAU.textContent = `${formatUsd(prices.XAU)}/oz`;
  metalPriceNodes.XAG.textContent = `${formatUsd(prices.XAG)}/oz`;
  metalPriceNodes.XPT.textContent = `${formatUsd(prices.XPT)}/oz`;
  metalsUpdatedNode.textContent = `Updated ${formatEasternTimestamp(updatedAtMs)}`;
};

const readMetalsCache = () => {
  try {
    const raw = window.localStorage.getItem(METALS_CACHE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    const updatedAtMs = Number(parsed?.updatedAtMs);
    const prices = parsed?.prices;

    if (
      !Number.isFinite(updatedAtMs) ||
      !prices ||
      !toNumber(prices.XAU) ||
      !toNumber(prices.XAG) ||
      !toNumber(prices.XPT)
    ) {
      return null;
    }

    return {
      updatedAtMs,
      prices: {
        XAU: Number(prices.XAU),
        XAG: Number(prices.XAG),
        XPT: Number(prices.XPT),
      },
    };
  } catch (error) {
    console.error(error);
    return null;
  }
};

const writeMetalsCache = (prices, updatedAtMs) => {
  try {
    window.localStorage.setItem(
      METALS_CACHE_KEY,
      JSON.stringify({
        updatedAtMs,
        prices,
      })
    );
  } catch (error) {
    console.error(error);
  }
};

const fetchGoldApiPrice = async (symbol) => {
  const response = await fetch(`${GOLDAPI_BASE_URL}/${symbol}/USD`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'x-access-token': GOLDAPI_ACCESS_TOKEN,
    },
  });

  if (!response.ok) {
    throw new Error(`GoldAPI request failed for ${symbol} with status ${response.status}`);
  }

  const payload = await response.json();
  const parsed = toNumber(payload?.price) || toNumber(payload?.ask) || toNumber(payload?.bid);
  if (!parsed) {
    throw new Error(`GoldAPI returned no usable price for ${symbol}`);
  }

  return parsed;
};

const setMetalsErrorState = () => {
  Object.values(metalPriceNodes).forEach((node) => {
    if (node) {
      node.textContent = 'Unavailable';
    }
  });

  if (metalsUpdatedNode) {
    metalsUpdatedNode.textContent = 'Update failed. Retrying in 12h';
  }
};

const updateMetalsTicker = async () => {
  if (!metalPriceNodes.XAU || !metalPriceNodes.XAG || !metalPriceNodes.XPT || !metalsUpdatedNode) {
    return;
  }

  const now = Date.now();
  const cached = readMetalsCache();

  if (cached && now - cached.updatedAtMs < METALS_REFRESH_MS) {
    paintMetalsTicker(cached.prices, cached.updatedAtMs);
    return;
  }

  try {
    const [xau, xag, xpt] = await Promise.all([
      fetchGoldApiPrice('XAU'),
      fetchGoldApiPrice('XAG'),
      fetchGoldApiPrice('XPT'),
    ]);

    const prices = {
      XAU: xau,
      XAG: xag,
      XPT: xpt,
    };

    if (!prices.XAU || !prices.XAG || !prices.XPT) {
      throw new Error('Unable to parse one or more metal prices from GoldAPI response.');
    }

    paintMetalsTicker(prices, now);
    writeMetalsCache(prices, now);
  } catch (error) {
    if (cached) {
      paintMetalsTicker(cached.prices, cached.updatedAtMs);
      return;
    }

    setMetalsErrorState();
    console.error(error);
  }
};

updateMetalsTicker();
window.setInterval(updateMetalsTicker, METALS_REFRESH_MS);

if (reviewsTrack && dotsContainer && prevButton && nextButton) {
  const slides = Array.from(reviewsTrack.children);
  let currentIndex = 0;
  let visibleSlides = 3;

  const getVisibleSlides = () => {
    if (window.innerWidth <= 640) {
      return 1;
    }

    if (window.innerWidth <= 860) {
      return 2;
    }

    return 3;
  };

  const getPageCount = () => Math.max(1, slides.length - visibleSlides + 1);

  const buildDots = () => {
    dotsContainer.innerHTML = '';
    Array.from({ length: getPageCount() }).forEach((_, index) => {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'slider-dot';
      dot.setAttribute('aria-label', `Go to review set ${index + 1}`);
      dot.addEventListener('click', () => {
        currentIndex = index;
        updateSlider();
      });
      dotsContainer.appendChild(dot);
    });
  };

  const updateSlider = () => {
    visibleSlides = getVisibleSlides();
    const maxIndex = slides.length - visibleSlides;
    currentIndex = Math.max(0, Math.min(currentIndex, maxIndex));

    const slideWidth = slides[0].getBoundingClientRect().width;
    const gapValue = window.getComputedStyle(reviewsTrack).gap;
    const gap = Number.parseFloat(gapValue) || 0;
    const offset = currentIndex * (slideWidth + gap);
    reviewsTrack.style.transform = `translateX(-${offset}px)`;

    const dots = dotsContainer.querySelectorAll('.slider-dot');
    dots.forEach((dot, index) => {
      dot.classList.toggle('is-active', index === currentIndex);
    });

    prevButton.disabled = currentIndex === 0;
    nextButton.disabled = currentIndex >= maxIndex;
  };

  prevButton.addEventListener('click', () => {
    currentIndex -= 1;
    updateSlider();
  });

  nextButton.addEventListener('click', () => {
    currentIndex += 1;
    updateSlider();
  });

  let resizeTimer;
  window.addEventListener('resize', () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      const nextVisibleSlides = getVisibleSlides();
      if (nextVisibleSlides !== visibleSlides) {
        visibleSlides = nextVisibleSlides;
        buildDots();
      }
      updateSlider();
    }, 120);
  });

  buildDots();
  updateSlider();
}