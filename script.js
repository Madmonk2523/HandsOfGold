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
    } else if (target === 1975) {
      element.textContent = '1975';
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