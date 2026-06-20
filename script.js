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
const LEAD_REQUEST_TIMEOUT_MS = 20000;
const REPO_BASE_PATH = window.location.hostname.endsWith('github.io') ? '/HandsOfGold' : '';

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

const METALS_DATA_URL = `${REPO_BASE_PATH}/data/metals.json`;
const METALS_REFRESH_MS = 60 * 60 * 1000;
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
  const now = new Date();
  const nextHourDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() + 1, 0, 0, 0);
  const nextUpdateMs = nextHourDate.getTime();
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

const TROY_OZ_TO_GRAMS = 31.1035;
let goldPricePerGram = 70;

const goldPricePerGramNode = document.getElementById('gold-price-per-gram');

const paintMetalsTicker = (prices, updatedAtMs) => {
  metalPriceNodes.XAU.textContent = `${formatUsd(prices.XAU)}/oz`;
  metalPriceNodes.XAG.textContent = `${formatUsd(prices.XAG)}/oz`;
  metalPriceNodes.XPT.textContent = `${formatUsd(prices.XPT)}/oz`;
  metalsUpdatedNode.textContent = renderMetalsUpdatedLine(updatedAtMs);
  syncStickyOffsets();

  const liveGramPrice = prices.XAU / TROY_OZ_TO_GRAMS;
  if (Number.isFinite(liveGramPrice) && liveGramPrice > 0) {
    goldPricePerGram = liveGramPrice;
    if (goldPricePerGramNode) {
      goldPricePerGramNode.textContent = formatUsd(liveGramPrice);
    }
  }
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

      leadStatus.textContent = 'Success. Your 10% offer has been claimed.';
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
      leadSubmit.textContent = 'Claim My 10% Off';
      leadForm.setAttribute('aria-busy', 'false');
    }
  });
}

const productMainImage = document.getElementById('product-main-image');
const productThumbs = document.querySelectorAll('.product-thumb');

if (productMainImage && productThumbs.length) {
  productThumbs.forEach((thumb) => {
    thumb.addEventListener('click', () => {
      const image = thumb.getAttribute('data-product-image');
      const alt = thumb.getAttribute('data-product-alt') || productMainImage.alt;

      if (!image) {
        return;
      }

      productMainImage.src = image;
      productMainImage.alt = alt;

      productThumbs.forEach((item) => {
        const isActive = item === thumb;
        item.classList.toggle('is-active', isActive);
        item.setAttribute('aria-pressed', String(isActive));
      });
    });
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

const goldPuritySelect = document.getElementById('gold-purity');
const goldWeightInput = document.getElementById('gold-weight');
const goldEstimatedOfferNode = document.getElementById('gold-estimated-offer');
const goldOfferForm = document.getElementById('gold-offer-form');
const goldFormPurity = document.getElementById('gold-form-purity');
const goldFormWeight = document.getElementById('gold-form-weight');
const goldFormEstimatedOffer = document.getElementById('gold-offer-estimated');
const goldOfferSubmit = document.getElementById('gold-offer-submit');
const goldFormStatus = document.getElementById('gold-form-status');
const goldPhotoInput = document.getElementById('gold-photo');
const goldPhotoName = document.getElementById('gold-photo-name');
const goldPageUrl = document.getElementById('gold-page-url');
const goldUtmSource = document.getElementById('gold-utm-source');
const goldFormStart = document.getElementById('gold-form-start');

const GOLD_PHOTO_MAX_BYTES = 4 * 1024 * 1024;
const GOLD_PURITY_VALUES = {
  '10k': 0.417,
  '14k': 0.585,
  '18k': 0.75,
  '22k': 0.917,
  '24k': 1,
};

const formatWeightForForm = (weight) => {
  if (!Number.isFinite(weight) || weight <= 0) {
    return '';
  }

  return `${Number.isInteger(weight) ? weight : weight.toFixed(1)} grams`;
};

const updateGoldOfferEstimate = () => {
  if (!goldPuritySelect || !goldWeightInput || !goldEstimatedOfferNode) {
    return 0;
  }

  const purityKey = goldPuritySelect.value;
  const purityValue = GOLD_PURITY_VALUES[purityKey] ?? 0;
  const weight = Math.max(0, Number.parseFloat(goldWeightInput.value) || 0);
  const estimatedValue = weight * purityValue * goldPricePerGram * 0.8;
  const displayValue = formatUsd(estimatedValue);

  goldEstimatedOfferNode.textContent = displayValue;

  if (goldFormPurity) {
    goldFormPurity.value = purityKey.toUpperCase();
  }

  if (goldFormWeight) {
    goldFormWeight.value = formatWeightForForm(weight);
  }

  if (goldFormEstimatedOffer) {
    goldFormEstimatedOffer.value = displayValue;
  }

  return estimatedValue;
};

const fileToDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      resolve(String(reader.result || ''));
    };

    reader.onerror = () => {
      reject(new Error('Could not read the selected photo.'));
    };

    reader.readAsDataURL(file);
  });

if (goldPuritySelect && goldWeightInput) {
  updateGoldOfferEstimate();
  goldPuritySelect.addEventListener('change', updateGoldOfferEstimate);
  goldWeightInput.addEventListener('input', updateGoldOfferEstimate);
}

if (goldPageUrl) {
  goldPageUrl.value = window.location.href;
}

if (goldUtmSource) {
  const params = new URLSearchParams(window.location.search);
  goldUtmSource.value = params.get('utm_source') || 'direct';
}

if (goldFormStart) {
  goldFormStart.value = String(Date.now());
}

if (goldPhotoInput && goldPhotoName) {
  goldPhotoInput.addEventListener('change', () => {
    const selectedFile = goldPhotoInput.files && goldPhotoInput.files[0];
    goldPhotoName.textContent = selectedFile ? `Selected: ${selectedFile.name}` : 'No photo selected.';
  });
}

if (goldOfferForm && goldOfferSubmit && goldFormStatus) {
  goldOfferForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const estimatedValue = updateGoldOfferEstimate();
    const formData = new FormData(goldOfferForm);
    const payload = {
      name: String(formData.get('name') || '').trim(),
      email: String(formData.get('email') || '').trim(),
      phone: String(formData.get('phone') || '').trim(),
      purity: String(formData.get('purity') || '').trim(),
      weight: String(formData.get('weight') || '').trim(),
      estimatedOffer: String(formData.get('estimatedOffer') || '').trim(),
      pageUrl: String(formData.get('pageUrl') || '').trim(),
      utmSource: String(formData.get('utmSource') || '').trim(),
      formStart: String(formData.get('formStart') || '').trim(),
      website: String(formData.get('website') || '').trim(),
      leadType: String(formData.get('leadType') || 'Gold Buying Offer').trim(),
    };

    if (!payload.name || !payload.email || !payload.phone) {
      goldFormStatus.textContent = 'Please complete all required fields before submitting.';
      goldFormStatus.classList.add('is-error');
      goldFormStatus.classList.remove('is-success');
      return;
    }

    if (!emailPattern.test(payload.email)) {
      goldFormStatus.textContent = 'Please enter a valid email address.';
      goldFormStatus.classList.add('is-error');
      goldFormStatus.classList.remove('is-success');
      return;
    }

    if (!isValidPhone(payload.phone)) {
      goldFormStatus.textContent = 'Please enter a valid phone number.';
      goldFormStatus.classList.add('is-error');
      goldFormStatus.classList.remove('is-success');
      return;
    }

    if (!Number.isFinite(estimatedValue) || estimatedValue <= 0) {
      goldFormStatus.textContent = 'Please enter a valid gold weight to calculate your estimate.';
      goldFormStatus.classList.add('is-error');
      goldFormStatus.classList.remove('is-success');
      return;
    }

    const fillMs = Date.now() - Number(payload.formStart || 0);
    if (!Number.isFinite(fillMs) || fillMs < LEAD_MIN_FILL_MS) {
      goldFormStatus.textContent = 'Please review your details and try again.';
      goldFormStatus.classList.add('is-error');
      goldFormStatus.classList.remove('is-success');
      return;
    }

    let photoNameValue = '';
    let photoTypeValue = '';
    let photoDataUrlValue = '';
    const selectedPhoto = goldPhotoInput && goldPhotoInput.files && goldPhotoInput.files[0];

    if (selectedPhoto) {
      if (selectedPhoto.size > GOLD_PHOTO_MAX_BYTES) {
        goldFormStatus.textContent = 'Please upload an image under 4 MB.';
        goldFormStatus.classList.add('is-error');
        goldFormStatus.classList.remove('is-success');
        return;
      }

      photoNameValue = selectedPhoto.name;
      photoTypeValue = selectedPhoto.type || 'application/octet-stream';

      try {
        photoDataUrlValue = await fileToDataUrl(selectedPhoto);
      } catch (error) {
        goldFormStatus.textContent = 'We could not read the selected photo. Please try another image.';
        goldFormStatus.classList.add('is-error');
        goldFormStatus.classList.remove('is-success');
        console.error(error);
        return;
      }
    }

    goldOfferSubmit.disabled = true;
    goldOfferSubmit.textContent = 'Submitting...';
    goldOfferForm.setAttribute('aria-busy', 'true');
    goldFormStatus.textContent = '';
    goldFormStatus.classList.remove('is-error', 'is-success');

    try {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), LEAD_REQUEST_TIMEOUT_MS);

      const response = await fetch(LEAD_API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...payload,
          photoName: photoNameValue,
          photoType: photoTypeValue,
          photoDataUrl: photoDataUrlValue,
        }),
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

      goldFormStatus.textContent = 'Success. Your offer request has been sent.';
      goldFormStatus.classList.add('is-success');
      goldFormStatus.classList.remove('is-error');
      goldOfferForm.reset();

      if (goldPhotoName) {
        goldPhotoName.textContent = 'No photo selected.';
      }

      if (goldFormStart) {
        goldFormStart.value = String(Date.now());
      }

      updateGoldOfferEstimate();
    } catch (error) {
      const message = error instanceof Error && error.message
        ? error.message
        : 'Something went wrong. Please try again in a moment.';

      goldFormStatus.textContent = message;
      goldFormStatus.classList.add('is-error');
      goldFormStatus.classList.remove('is-success');
      console.error(error);
    } finally {
      goldOfferSubmit.disabled = false;
      goldOfferSubmit.textContent = 'Claim My Offer';
      goldOfferForm.setAttribute('aria-busy', 'false');
    }
  });
}

const setupServiceForm = ({
  formId,
  submitId,
  statusId,
  pageUrlId,
  utmSourceId,
  formStartId,
  successMessage,
  buildPayload,
}) => {
  const form = document.getElementById(formId);
  const submitButton = document.getElementById(submitId);
  const statusNode = document.getElementById(statusId);
  const pageUrlNode = document.getElementById(pageUrlId);
  const utmNode = document.getElementById(utmSourceId);
  const formStartNode = document.getElementById(formStartId);
  const emptyStateNode = form ? form.querySelector('.service-form-empty') : null;

  if (!form || !submitButton || !statusNode) {
    return;
  }

  if (pageUrlNode) {
    pageUrlNode.value = window.location.href;
  }

  if (utmNode) {
    const params = new URLSearchParams(window.location.search);
    utmNode.value = params.get('utm_source') || 'direct';
  }

  if (formStartNode) {
    formStartNode.value = String(Date.now());
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const formData = new FormData(form);
    const firstName = String(formData.get('firstName') || '').trim();
    const lastName = String(formData.get('lastName') || '').trim();
    const fullName = `${firstName} ${lastName}`.trim();
    const email = String(formData.get('email') || '').trim();
    const phone = String(formData.get('phone') || '').trim();
    const pageUrl = String(formData.get('pageUrl') || '').trim();
    const utmSource = String(formData.get('utmSource') || '').trim();
    const formStart = String(formData.get('formStart') || '').trim();
    const website = String(formData.get('website') || '').trim();
    const leadType = String(formData.get('leadType') || 'Website Lead').trim();

    if (!firstName || !lastName || !email || !phone) {
      statusNode.textContent = 'Please complete all required fields before submitting.';
      statusNode.classList.add('is-error');
      statusNode.classList.remove('is-success');
      return;
    }

    if (!emailPattern.test(email)) {
      statusNode.textContent = 'Please enter a valid email address.';
      statusNode.classList.add('is-error');
      statusNode.classList.remove('is-success');
      return;
    }

    if (!isValidPhone(phone)) {
      statusNode.textContent = 'Please enter a valid phone number.';
      statusNode.classList.add('is-error');
      statusNode.classList.remove('is-success');
      return;
    }

    const fillMs = Date.now() - Number(formStart || 0);
    if (!Number.isFinite(fillMs) || fillMs < LEAD_MIN_FILL_MS) {
      statusNode.textContent = 'Please review your details and try again.';
      statusNode.classList.add('is-error');
      statusNode.classList.remove('is-success');
      return;
    }

    const payload = {
      name: fullName,
      email,
      phone,
      pageUrl,
      utmSource,
      formStart,
      website,
      leadType,
      ...buildPayload(formData),
    };

    submitButton.disabled = true;
    submitButton.textContent = 'Submitting...';
    form.setAttribute('aria-busy', 'true');
    statusNode.textContent = '';
    statusNode.classList.remove('is-error', 'is-success');

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

      statusNode.textContent = successMessage;
      statusNode.classList.add('is-success');
      statusNode.classList.remove('is-error');
      form.reset();

      if (formStartNode) {
        formStartNode.value = String(Date.now());
      }

      if (emptyStateNode) {
        emptyStateNode.classList.add('is-hidden');
      }
    } catch (error) {
      const message = error instanceof Error && error.message
        ? error.message
        : 'Something went wrong. Please try again in a moment.';

      statusNode.textContent = message;
      statusNode.classList.add('is-error');
      statusNode.classList.remove('is-success');
      console.error(error);
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = submitButton.dataset.defaultText || 'Submit';
      form.setAttribute('aria-busy', 'false');
    }
  });
};

setupServiceForm({
  formId: 'engraving-form',
  submitId: 'engraving-submit',
  statusId: 'engraving-status',
  pageUrlId: 'engraving-page-url',
  utmSourceId: 'engraving-utm-source',
  formStartId: 'engraving-form-start',
  successMessage: 'Success. Your engraving request was sent. We will contact you shortly.',
  buildPayload: (formData) => ({
    itemType: String(formData.get('material') || '').trim(),
    textDesign: String(formData.get('textDesign') || '').trim(),
    preferredVisitDate: String(formData.get('preferredVisitDate') || '').trim(),
  }),
});

const engravingSubmitNode = document.getElementById('engraving-submit');
if (engravingSubmitNode) {
  engravingSubmitNode.dataset.defaultText = engravingSubmitNode.textContent;
}

setupServiceForm({
  formId: 'repairs-form',
  submitId: 'repairs-submit',
  statusId: 'repairs-status',
  pageUrlId: 'repairs-page-url',
  utmSourceId: 'repairs-utm-source',
  formStartId: 'repairs-form-start',
  successMessage: 'Success. Your drop-off request was sent. We will confirm your visit soon.',
  buildPayload: (formData) => ({
    repairType: String(formData.get('repairType') || '').trim(),
    description: String(formData.get('description') || '').trim(),
    preferredVisitDate: String(formData.get('preferredDropoffDate') || '').trim(),
  }),
});

const repairsSubmitNode = document.getElementById('repairs-submit');
if (repairsSubmitNode) {
  repairsSubmitNode.dataset.defaultText = repairsSubmitNode.textContent;
}

const CUBAN_CATALOG_URL = `${REPO_BASE_PATH}/data/cuban-catalog.json`;
const CUBAN_CATALOG_STORAGE_KEY = 'hog-cuban-catalog-v1';
const CUBAN_PRICING_STORAGE_KEY = 'hog-cuban-pricing-v1';

const CUBAN_PURITY = {
  '10K': 0.4167,
  '14K': 0.5833,
  '18K': 0.75,
};

const normalizeCatalogText = (value) => String(value || '').trim();

const parseWeight = (value) => {
  const parsed = Number.parseFloat(String(value || '').trim());
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
};

const roundToFive = (value) => Math.round(value / 5) * 5;

const defaultPricingConfig = {
  surchargePerGram: 10,
  marginDivisor: 0.65,
  compareMultiplier: 2.4,
};

const safePricingConfig = (config) => {
  const surchargePerGram = Number.parseFloat(config?.surchargePerGram);
  const marginDivisor = Number.parseFloat(config?.marginDivisor);
  const compareMultiplier = Number.parseFloat(config?.compareMultiplier);

  return {
    surchargePerGram: Number.isFinite(surchargePerGram) && surchargePerGram >= 0
      ? surchargePerGram
      : defaultPricingConfig.surchargePerGram,
    marginDivisor: Number.isFinite(marginDivisor) && marginDivisor > 0
      ? marginDivisor
      : defaultPricingConfig.marginDivisor,
    compareMultiplier: Number.isFinite(compareMultiplier) && compareMultiplier > 0
      ? compareMultiplier
      : defaultPricingConfig.compareMultiplier,
  };
};

const safeVariants = (variants) => {
  if (!Array.isArray(variants)) {
    return [];
  }

  return variants
    .map((variant) => ({
      product: normalizeCatalogText(variant?.product).toLowerCase(),
      width: normalizeCatalogText(variant?.width),
      length: normalizeCatalogText(variant?.length),
      karat: normalizeCatalogText(variant?.karat).toUpperCase(),
      weightGrams: parseWeight(variant?.weightGrams),
      sku: normalizeCatalogText(variant?.sku),
      availability: normalizeCatalogText(variant?.availability) || 'Made To Order',
    }))
    .filter((variant) =>
      (variant.product === 'bracelet' || variant.product === 'necklace')
      && variant.width
      && variant.length
      && variant.karat
      && variant.weightGrams
    );
};

const parseCatalogCsv = (csvRaw) => {
  const lines = String(csvRaw || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return [];
  }

  const headers = lines[0].split(',').map((item) => item.trim().toLowerCase());
  const rows = lines.slice(1);

  return rows.map((line) => {
    const values = line.split(',').map((item) => item.trim());
    const row = {};

    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });

    return {
      product: row.product,
      width: row.width,
      length: row.length,
      karat: row.karat,
      weightGrams: row.weightgrams,
      sku: row.sku,
      availability: row.availability,
    };
  });
};

const initCubanConfigurator = async () => {
  const configuratorRoot = document.getElementById('configurator-app');
  if (!configuratorRoot) {
    return;
  }

  const optionProduct = document.getElementById('option-product');
  const optionWidth = document.getElementById('option-width');
  const optionLength = document.getElementById('option-length');
  const optionKarat = document.getElementById('option-karat');
  const requiresProductBlock = document.getElementById('requires-product-block');
  const productGateNote = document.getElementById('product-gate-note');
  const catalogAlert = document.getElementById('catalog-alert');

  const summaryProduct = document.getElementById('summary-product');
  const summarySku = document.getElementById('summary-sku');
  const summaryWidth = document.getElementById('summary-width');
  const summaryLength = document.getElementById('summary-length');
  const summaryKarat = document.getElementById('summary-karat');
  const summaryWeight = document.getElementById('summary-weight');
  const summaryAvailability = document.getElementById('summary-availability');
  const summaryPrice = document.getElementById('summary-price');
  const liveSpot = document.getElementById('shop-live-spot');
  const addToCartButton = document.getElementById('add-to-cart');
  const priceLockNote = document.getElementById('price-lock-note');

  const galleryMain = document.getElementById('gallery-main');
  const galleryPlaceholder = document.getElementById('gallery-placeholder');
  const galleryThumbs = document.getElementById('gallery-thumbs');
  const galleryZoom = document.getElementById('gallery-zoom');
  const galleryFullscreen = document.getElementById('gallery-fullscreen');

  if (
    !optionProduct
    || !optionWidth
    || !optionLength
    || !optionKarat
    || !requiresProductBlock
    || !productGateNote
    || !catalogAlert
    || !summaryProduct
    || !summarySku
    || !summaryWidth
    || !summaryLength
    || !summaryKarat
    || !summaryWeight
    || !summaryAvailability
    || !summaryPrice
    || !liveSpot
    || !addToCartButton
    || !priceLockNote
  ) {
    return;
  }

  const catalogResponse = await fetch(CUBAN_CATALOG_URL, {
    method: 'GET',
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
    },
  });

  const seedCatalog = catalogResponse.ok
    ? await catalogResponse.json()
    : { products: {}, variants: [], pricingConfig: defaultPricingConfig };

  const state = {
    products: seedCatalog?.products || {},
    variants: safeVariants(seedCatalog?.variants),
    pricingConfig: safePricingConfig(seedCatalog?.pricingConfig),
    selectedProduct: '',
    selectedWidth: '',
    selectedLength: '',
    selectedKarat: '',
    selectedView: 'front',
  };

  const hasSelectedProduct = () => state.selectedProduct === 'bracelet' || state.selectedProduct === 'necklace';

  const getWidths = (product) => Object.keys(state.products?.[product]?.widths || {});

  const getLengths = (product, width) => {
    const widths = state.products?.[product]?.widths || {};
    return widths[width] || [];
  };

  const getKaratsForSelection = (product, width, length) => {
    const options = state.variants
      .filter((variant) => variant.product === product && variant.width === width && variant.length === length)
      .map((variant) => variant.karat)
      .filter(Boolean);

    return Array.from(new Set(options));
  };

  const getSelectedVariant = () => state.variants.find((variant) =>
    variant.product === state.selectedProduct
    && variant.width === state.selectedWidth
    && variant.length === state.selectedLength
    && variant.karat === state.selectedKarat
  );

  const viewLabel = {
    front: 'Front View',
    side: 'Side View',
    clasp: 'Clasp View',
    close: 'Close-Up View',
    lifestyle: 'Lifestyle View',
    wrist: 'On Wrist View',
    neck: 'On Neck View',
  };

  const renderOptionButtons = ({ root, values, activeValue, onSelect }) => {
    root.innerHTML = '';

    if (!values.length) {
      const emptyChip = document.createElement('span');
      emptyChip.className = 'option-empty';
      emptyChip.textContent = 'No options';
      root.appendChild(emptyChip);
      return;
    }

    values.forEach((value) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = value;
      button.classList.toggle('is-active', value === activeValue);
      button.addEventListener('click', () => onSelect(value));
      root.appendChild(button);
    });
  };

  const calculatePrice = (variant) => {
    if (!variant) {
      return null;
    }

    const purity = CUBAN_PURITY[variant.karat] || null;
    if (!purity) {
      return null;
    }

    const spot = goldPricePerGram;
    const retailBase = ((spot + state.pricingConfig.surchargePerGram) * purity * variant.weightGrams)
      / state.pricingConfig.marginDivisor;

    return roundToFive(retailBase);
  };

  const refreshSummary = () => {
    const variant = getSelectedVariant();
    const productName = state.products?.[state.selectedProduct]?.name || '-';

    summaryProduct.textContent = productName;
    summarySku.textContent = variant?.sku || 'Pending CSV SKU';
    summaryWidth.textContent = state.selectedWidth || '-';
    summaryLength.textContent = state.selectedLength || '-';
    summaryKarat.textContent = state.selectedKarat || '-';
    summaryWeight.textContent = variant ? `${variant.weightGrams.toFixed(2)} grams` : '-';
    summaryAvailability.textContent = variant?.availability || '-';
    liveSpot.textContent = formatUsd(goldPricePerGram);

    const price = calculatePrice(variant);
    summaryPrice.textContent = price ? formatUsd(price) : '-';
  };

  const refreshGallery = () => {
    if (!galleryPlaceholder) {
      return;
    }

    galleryPlaceholder.dataset.color = 'yellow';
    galleryPlaceholder.dataset.view = state.selectedView;
    galleryPlaceholder.innerHTML = `
      <p>Image Placeholder</p>
      <small>${viewLabel[state.selectedView]} - Yellow Gold</small>
    `;

    if (galleryThumbs) {
      const buttons = galleryThumbs.querySelectorAll('button');
      buttons.forEach((button) => {
        const isActive = button.dataset.view === state.selectedView;
        button.classList.toggle('is-active', isActive);
      });
    }
  };

  const repopulateSelections = () => {
    if (!hasSelectedProduct()) {
      state.selectedWidth = '';
      state.selectedLength = '';
      state.selectedKarat = '';
      catalogAlert.textContent = 'Pick bracelet or necklace to continue.';
      return;
    }

    const widths = getWidths(state.selectedProduct);
    if (!widths.includes(state.selectedWidth)) {
      state.selectedWidth = widths[0] || '';
    }

    const lengths = getLengths(state.selectedProduct, state.selectedWidth);
    if (!lengths.includes(state.selectedLength)) {
      state.selectedLength = lengths[0] || '';
    }

    const karats = getKaratsForSelection(state.selectedProduct, state.selectedWidth, state.selectedLength);
    if (!karats.includes(state.selectedKarat)) {
      state.selectedKarat = karats[0] || '';
    }

    catalogAlert.textContent = karats.length
      ? 'Only valid catalog karats are shown for this size.'
      : 'No karat variant found for this width/length in current catalog.';
  };

  const renderAll = () => {
    repopulateSelections();

    const productChoices = ['bracelet', 'necklace'];
    renderOptionButtons({
      root: optionProduct,
      values: productChoices.map((value) => state.products?.[value]?.name || value),
      activeValue: hasSelectedProduct() ? (state.products?.[state.selectedProduct]?.name || state.selectedProduct) : '',
      onSelect: (value) => {
        const matchedProduct = productChoices.find(
          (key) => (state.products?.[key]?.name || key) === value
        ) || 'bracelet';
        state.selectedProduct = matchedProduct;
        renderAll();
      },
    });

    const ready = hasSelectedProduct();
    requiresProductBlock.hidden = !ready;
    productGateNote.hidden = ready;

    if (!ready) {
      refreshSummary();
      refreshGallery();
      return;
    }

    renderOptionButtons({
      root: optionWidth,
      values: getWidths(state.selectedProduct),
      activeValue: state.selectedWidth,
      onSelect: (value) => {
        state.selectedWidth = value;
        renderAll();
      },
    });

    renderOptionButtons({
      root: optionLength,
      values: getLengths(state.selectedProduct, state.selectedWidth),
      activeValue: state.selectedLength,
      onSelect: (value) => {
        state.selectedLength = value;
        renderAll();
      },
    });

    renderOptionButtons({
      root: optionKarat,
      values: getKaratsForSelection(state.selectedProduct, state.selectedWidth, state.selectedLength),
      activeValue: state.selectedKarat,
      onSelect: (value) => {
        state.selectedKarat = value;
        renderAll();
      },
    });

    refreshSummary();
    refreshGallery();
  };

  if (galleryThumbs) {
    galleryThumbs.querySelectorAll('button').forEach((button) => {
      button.addEventListener('click', () => {
        state.selectedView = button.dataset.view || 'front';
        refreshGallery();
      });
    });
  }

  if (galleryZoom && galleryMain) {
    galleryZoom.addEventListener('click', () => {
      galleryMain.classList.toggle('is-zoomed');
    });
  }

  if (galleryFullscreen && galleryMain) {
    galleryFullscreen.addEventListener('click', async () => {
      try {
        if (document.fullscreenElement) {
          await document.exitFullscreen();
          return;
        }
        await galleryMain.requestFullscreen();
      } catch (error) {
        console.error(error);
      }
    });
  }

  addToCartButton.addEventListener('click', () => {
    const variant = getSelectedVariant();
    if (!variant) {
      priceLockNote.textContent = 'Cannot add to cart. Select a catalog-backed karat option first.';
      return;
    }
    priceLockNote.textContent = 'Added to cart.';
  });

  window.setInterval(refreshSummary, 2500);
  renderAll();
};

initCubanConfigurator().catch((error) => {
  console.error('Cuban configurator failed to initialize:', error);
});