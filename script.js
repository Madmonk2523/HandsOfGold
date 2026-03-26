const body = document.body;
const header = document.querySelector('.site-header');
const navToggle = document.querySelector('.nav-toggle');
const nav = document.querySelector('.site-nav');
const navLinks = document.querySelectorAll('.site-nav a, .nav-actions a');
const yearTarget = document.getElementById('year');
const leadPopup = document.getElementById('lead-popup');
const leadPopupClose = document.getElementById('lead-popup-close');
const leadForm = document.getElementById('lead-form');
const leadSubmit = document.getElementById('lead-submit');
const leadStatus = document.getElementById('lead-status');
const leadPageUrl = document.getElementById('lead-page-url');
const leadUtmSource = document.getElementById('lead-utm-source');
const leadFormStart = document.getElementById('lead-form-start');

const LEAD_POPUP_DELAY_MS = 3000;
const LEAD_POPUP_STORAGE_KEY = 'hog-lead-popup-seen-v2';
const LEAD_POPUP_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const LEAD_MIN_FILL_MS = 1200;
const LEAD_API_ENDPOINT = '/api/send-lead';
const LEAD_REQUEST_TIMEOUT_MS = 12000;

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
  const suffix = element.dataset.suffix || '';
  const duration = 1400;
  const startTime = performance.now();

  const step = (timestamp) => {
    const progress = Math.min((timestamp - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const value = Math.round(target * eased);

    element.textContent = `${value}${suffix}`;

    if (progress < 1) {
      window.requestAnimationFrame(step);
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
const metalsTicker = document.querySelector('.metals-ticker');

const metalPriceNodes = {
  XAU: document.getElementById('price-gold'),
  XAG: document.getElementById('price-silver'),
  XPT: document.getElementById('price-platinum'),
};
const metalsUpdatedNode = document.getElementById('metals-updated');

const METALS_DATA_URL = 'data/metals.json';
const METALS_REFRESH_MS = 12 * 60 * 60 * 1000;
const METALS_CACHE_KEY = 'hog-metals-cache-v2';
const METALS_DISPLAY_REFRESH_MS = 60 * 1000;

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

const formatCountdown = (remainingMs) => {
  const safeMs = Math.max(0, remainingMs);
  const totalMinutes = Math.floor(safeMs / (60 * 1000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m`;
};

const renderMetalsUpdatedLine = (updatedAtMs) => {
  const nextUpdateMs = updatedAtMs + METALS_REFRESH_MS;
  const remainingMs = nextUpdateMs - Date.now();

  return `Updated ${formatEasternTimestamp(updatedAtMs)} | Next update in ${formatCountdown(remainingMs)}`;
};

const syncStickyOffsets = () => {
  if (!metalsTicker) {
    return;
  }

  const tickerHeight = Math.max(1, Math.ceil(metalsTicker.getBoundingClientRect().height));
  document.documentElement.style.setProperty('--metals-bar-height', `${tickerHeight}px`);
};

const paintMetalsTicker = (prices, updatedAtMs) => {
  metalPriceNodes.XAU.textContent = `${formatUsd(prices.XAU)}/oz`;
  metalPriceNodes.XAG.textContent = `${formatUsd(prices.XAG)}/oz`;
  metalPriceNodes.XPT.textContent = `${formatUsd(prices.XPT)}/oz`;
  metalsUpdatedNode.textContent = renderMetalsUpdatedLine(updatedAtMs);
  syncStickyOffsets();
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

const fetchMetalsSnapshot = async () => {
  const response = await fetch(METALS_DATA_URL, {
    method: 'GET',
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Metals snapshot request failed with status ${response.status}`);
  }

  const payload = await response.json();
  const updatedAtMs = Number(payload?.updatedAtMs);
  const prices = {
    XAU: toNumber(payload?.prices?.XAU),
    XAG: toNumber(payload?.prices?.XAG),
    XPT: toNumber(payload?.prices?.XPT),
  };

  if (!Number.isFinite(updatedAtMs) || !prices.XAU || !prices.XAG || !prices.XPT) {
    throw new Error('Invalid metals snapshot payload.');
  }

  return {
    updatedAtMs,
    prices,
  };
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

  syncStickyOffsets();
};

const updateMetalsTicker = async () => {
  if (!metalPriceNodes.XAU || !metalPriceNodes.XAG || !metalPriceNodes.XPT || !metalsUpdatedNode) {
    return;
  }

  const cached = readMetalsCache();

  if (cached) {
    paintMetalsTicker(cached.prices, cached.updatedAtMs);
  }

  try {
    const snapshot = await fetchMetalsSnapshot();

    if (!cached || snapshot.updatedAtMs >= cached.updatedAtMs) {
      paintMetalsTicker(snapshot.prices, snapshot.updatedAtMs);
      writeMetalsCache(snapshot.prices, snapshot.updatedAtMs);
    }
  } catch (error) {
    if (cached) {
      return;
    }

    setMetalsErrorState();
    console.error(error);
  }
};

updateMetalsTicker();
syncStickyOffsets();
window.setInterval(updateMetalsTicker, METALS_REFRESH_MS);
window.setInterval(() => {
  const cached = readMetalsCache();
  if (cached && metalsUpdatedNode) {
    metalsUpdatedNode.textContent = renderMetalsUpdatedLine(cached.updatedAtMs);
    syncStickyOffsets();
  }
}, METALS_DISPLAY_REFRESH_MS);
window.addEventListener('resize', syncStickyOffsets, { passive: true });

const openLeadPopup = () => {
  if (!leadPopup) {
    return;
  }

  if (leadFormStart) {
    leadFormStart.value = String(Date.now());
  }

  leadPopup.classList.add('is-open');
  leadPopup.setAttribute('aria-hidden', 'false');
};

const closeLeadPopup = () => {
  if (!leadPopup) {
    return;
  }

  leadPopup.classList.remove('is-open');
  leadPopup.setAttribute('aria-hidden', 'true');

  try {
    window.localStorage.setItem(LEAD_POPUP_STORAGE_KEY, String(Date.now()));
  } catch (error) {
    console.error(error);
  }
};

if (leadPopup) {
  let popupSeen = false;

  try {
    const lastShownAt = Number(window.localStorage.getItem(LEAD_POPUP_STORAGE_KEY));
    popupSeen = Number.isFinite(lastShownAt) && Date.now() - lastShownAt < LEAD_POPUP_COOLDOWN_MS;
  } catch (error) {
    console.error(error);
  }

  if (leadPageUrl) {
    leadPageUrl.value = window.location.href;
  }

  if (leadUtmSource) {
    const params = new URLSearchParams(window.location.search);
    leadUtmSource.value = params.get('utm_source') || 'direct';
  }

  if (!popupSeen) {
    window.setTimeout(openLeadPopup, LEAD_POPUP_DELAY_MS);
  }

  leadPopup.addEventListener('click', (event) => {
    const target = event.target;
    if (target instanceof HTMLElement && target.dataset.popupClose === 'true') {
      closeLeadPopup();
    }
  });

  if (leadPopupClose) {
    leadPopupClose.addEventListener('click', closeLeadPopup);
  }

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && leadPopup.classList.contains('is-open')) {
      closeLeadPopup();
    }
  });
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const isValidPhone = (value) => {
  const digits = value.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15;
};

if (leadForm && leadSubmit && leadStatus) {
  leadForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const formData = new FormData(leadForm);
    const payload = {
      name: String(formData.get('name') || '').trim(),
      email: String(formData.get('email') || '').trim(),
      phone: String(formData.get('phone') || '').trim(),
      pageUrl: String(formData.get('pageUrl') || '').trim(),
      utmSource: String(formData.get('utmSource') || '').trim(),
      formStart: String(formData.get('formStart') || '').trim(),
      website: String(formData.get('website') || '').trim(),
    };

    if (!payload.name || !payload.email || !payload.phone) {
      leadStatus.textContent = 'Please complete all fields before submitting.';
      leadStatus.classList.add('is-error');
      leadStatus.classList.remove('is-success');
      return;
    }

    if (!emailPattern.test(payload.email)) {
      leadStatus.textContent = 'Please enter a valid email address.';
      leadStatus.classList.add('is-error');
      leadStatus.classList.remove('is-success');
      return;
    }

    if (!isValidPhone(payload.phone)) {
      leadStatus.textContent = 'Please enter a valid phone number.';
      leadStatus.classList.add('is-error');
      leadStatus.classList.remove('is-success');
      return;
    }

    const fillMs = Date.now() - Number(payload.formStart || 0);
    if (!Number.isFinite(fillMs) || fillMs < LEAD_MIN_FILL_MS) {
      leadStatus.textContent = 'Please review your details and try again.';
      leadStatus.classList.add('is-error');
      leadStatus.classList.remove('is-success');
      return;
    }

    leadSubmit.disabled = true;
    leadSubmit.textContent = 'Submitting...';
    leadForm.setAttribute('aria-busy', 'true');
    leadStatus.textContent = '';
    leadStatus.classList.remove('is-error', 'is-success');

    try {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), LEAD_REQUEST_TIMEOUT_MS);

      const response = await fetch(LEAD_API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      window.clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Lead form backend not found. Deploy with a live /api/send-lead endpoint.');
        }

        const payloadError = await response.json().catch(() => ({}));
        throw new Error(payloadError?.error || `Lead request failed with status ${response.status}`);
      }

      leadStatus.textContent = 'Success. Your 30% offer has been claimed.';
      leadStatus.classList.add('is-success');
      leadStatus.classList.remove('is-error');
      leadForm.reset();
      window.setTimeout(closeLeadPopup, 1200);
    } catch (error) {
      const message = error instanceof Error && error.message
        ? error.message
        : 'Something went wrong. Please try again in a moment.';

      leadStatus.textContent = message;
      leadStatus.classList.add('is-error');
      leadStatus.classList.remove('is-success');
      console.error(error);
    } finally {
      leadSubmit.disabled = false;
      leadSubmit.textContent = 'Claim My 30% Off';
      leadForm.setAttribute('aria-busy', 'false');
    }
  });
}

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