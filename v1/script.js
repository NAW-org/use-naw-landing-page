// ===== Mobile menu =====
const burger = document.getElementById('burger');
const navMobile = document.getElementById('navMobile');
burger.addEventListener('click', () => navMobile.classList.toggle('open'));
navMobile.querySelectorAll('a').forEach(a =>
  a.addEventListener('click', () => navMobile.classList.remove('open'))
);

// Fall back to the frame's own background when an image is missing.
document.querySelectorAll('img').forEach(img =>
  img.addEventListener('error', () => { img.style.display = 'none'; })
);

// ===== Headlines split into words for the staggered reveal =====
function splitWords(el) {
  const walk = node => {
    [...node.childNodes].forEach(child => {
      if (child.nodeType === Node.TEXT_NODE) {
        const frag = document.createDocumentFragment();
        child.textContent.split(/(\s+)/).forEach(part => {
          if (/^\s+$/.test(part) || part === '') {
            frag.appendChild(document.createTextNode(part));
          } else {
            const w = document.createElement('span');
            w.className = 'w';
            w.textContent = part;
            frag.appendChild(w);
          }
        });
        node.replaceChild(frag, child);
      } else if (child.nodeType === Node.ELEMENT_NODE && child.tagName !== 'BR' && !child.classList.contains('w')) {
        walk(child);
      }
    });
  };
  walk(el);
  el.querySelectorAll('.w').forEach((w, i) => w.style.setProperty('--wi', i));
}
document.querySelectorAll('.split-words').forEach(splitWords);

// ===== Scroll reveal =====
const revealEls = document.querySelectorAll('.reveal, .split-words');
revealEls.forEach(el => {
  const d = el.dataset.delay;
  if (d) el.style.setProperty('--d', d + 'ms');
});
const io = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add('visible');
      io.unobserve(e.target);
    }
  });
}, { threshold: 0.01, rootMargin: '100000px 0px -40px 0px' });
revealEls.forEach(el => io.observe(el));

// ===== Smooth scroll =====
// Eases the native scroll position rather than transforming a wrapper, so
// position: sticky (the pinned hero) keeps working.
const smooth = (() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const coarse = matchMedia('(pointer: coarse)');
  const EASE = 0.11;

  let target = window.scrollY;
  let current = window.scrollY;
  let running = false;
  let selfScrolling = false;

  const enabled = () => !reduce.matches && !coarse.matches;
  const maxScroll = () => Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  const clamp = v => Math.min(maxScroll(), Math.max(0, v));

  function frame() {
    current += (target - current) * EASE;
    if (Math.abs(target - current) < 0.4) {
      current = target;
      running = false;
    }
    selfScrolling = true;
    window.scrollTo(0, current);
    selfScrolling = false;
    if (running) requestAnimationFrame(frame);
  }

  function start() {
    if (running) return;
    running = true;
    requestAnimationFrame(frame);
  }

  function scrollTo(value) {
    if (!enabled()) {
      window.scrollTo({ top: clamp(value), behavior: 'smooth' });
      return;
    }
    target = clamp(value);
    start();
  }

  function init() {
    if (!enabled()) return;
    document.documentElement.style.scrollBehavior = 'auto';

    window.addEventListener('wheel', e => {
      if (e.ctrlKey) return; // leave pinch-zoom alone
      e.preventDefault();
      const delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      target = clamp(target + delta);
      start();
    }, { passive: false });

    // Keep in sync when the scrollbar, keyboard or the browser moves the page.
    window.addEventListener('scroll', () => {
      if (selfScrolling || running) return;
      target = current = window.scrollY;
    }, { passive: true });

    window.addEventListener('keydown', e => {
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable) return;
      const page = window.innerHeight * 0.9;
      const moves = {
        ArrowDown: 90, ArrowUp: -90,
        PageDown: page, PageUp: -page,
        Home: -Infinity, End: Infinity,
        ' ': e.shiftKey ? -page : page,
      };
      const move = moves[e.key];
      if (move === undefined) return;
      e.preventDefault();
      scrollTo(move === Infinity ? maxScroll() : move === -Infinity ? 0 : target + move);
    });

    window.addEventListener('resize', () => { target = clamp(target); });
  }

  init();
  return { scrollTo, enabled };
})();

// Anchor links ride the same easing.
document.querySelectorAll('a[href^="#"]').forEach(link => {
  link.addEventListener('click', e => {
    const id = link.getAttribute('href');
    if (id === '#') return;
    const el = document.querySelector(id);
    if (!el) return;
    e.preventDefault();
    smooth.scrollTo(el.getBoundingClientRect().top + window.scrollY);
  });
});

// ===== Hero pin: the photo panel grows to full width before the page moves on =====
const heroStage = document.getElementById('heroStage');
const heroEl = document.querySelector('.hero');
const prefersReducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

function updateHeroExpand() {
  if (!heroStage || !heroEl) return;
  if (matchMedia('(max-width: 900px)').matches || prefersReducedMotion.matches) {
    heroEl.style.setProperty('--expand', '0');
    return;
  }
  const travel = heroStage.offsetHeight - window.innerHeight;
  if (travel <= 0) return;
  const scrolled = -heroStage.getBoundingClientRect().top;
  const p = Math.min(1, Math.max(0, scrolled / travel));
  heroEl.style.setProperty('--expand', p.toFixed(4));
}

let expandTicking = false;
const queueHeroExpand = () => {
  if (expandTicking) return;
  expandTicking = true;
  requestAnimationFrame(() => { updateHeroExpand(); expandTicking = false; });
};
window.addEventListener('scroll', queueHeroExpand, { passive: true });
window.addEventListener('resize', queueHeroExpand);
updateHeroExpand();

// ===== Language toggle (ES ⇄ EN) =====
const langToggle = document.getElementById('langToggle');
const langLabel = document.getElementById('langLabel');
const translatable = [...document.querySelectorAll('[data-en]')];

const translatablePlaceholders = [...document.querySelectorAll('[data-en-placeholder]')];

// Capture the Spanish copy as authored, before any swap.
translatable.forEach(el => { el.dataset.es = el.innerHTML; });
translatablePlaceholders.forEach(el => { el.dataset.esPlaceholder = el.placeholder; });

function setLang(lang) {
  translatable.forEach(el => {
    el.innerHTML = lang === 'en' ? el.dataset.en : el.dataset.es;
  });
  translatablePlaceholders.forEach(el => {
    el.placeholder = lang === 'en' ? el.dataset.enPlaceholder : el.dataset.esPlaceholder;
  });

  // Re-split headlines and replay their stagger with the new words.
  document.querySelectorAll('.split-words').forEach(el => {
    splitWords(el);
    if (el.classList.contains('visible')) {
      el.classList.remove('visible');
      void el.offsetWidth;
      el.classList.add('visible');
    }
  });

  document.documentElement.lang = lang;
  langLabel.textContent = lang.toUpperCase();
  langToggle.setAttribute('aria-label', lang === 'es' ? 'Cambiar a inglés' : 'Switch to Spanish');
  localStorage.setItem('naw-lang', lang);
}

langToggle.addEventListener('click', () => {
  setLang(document.documentElement.lang === 'es' ? 'en' : 'es');
});

const savedLang = localStorage.getItem('naw-lang');
if (savedLang === 'en') setLang('en');
