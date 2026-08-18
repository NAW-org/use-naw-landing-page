// V0 — behavior cloned from the original Framer build

// ===== Scale the fixed 1440px design to the viewport width =====
// `zoom` scales through layout, so position: sticky keeps working
// (a transform would turn the page into the sticky containing block).
let pageZoom = 1;
function fitPage() {
  const page = document.querySelector('.page');
  pageZoom = document.documentElement.clientWidth / 1440;
  page.style.zoom = pageZoom;
}
window.addEventListener('resize', fitPage);
fitPage();

// ===== Smooth scroll (eases native scroll, so sticky keeps working) =====
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
    if (Math.abs(target - current) < 0.4) { current = target; running = false; }
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
  function scrollTo(v) {
    if (!enabled()) { window.scrollTo({ top: clamp(v), behavior: 'smooth' }); return; }
    target = clamp(v);
    start();
  }
  if (enabled()) {
    window.addEventListener('wheel', e => {
      if (e.ctrlKey) return;
      e.preventDefault();
      const delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      target = clamp(target + delta);
      start();
    }, { passive: false });
    window.addEventListener('scroll', () => {
      if (selfScrolling || running) return;
      target = current = window.scrollY;
    }, { passive: true });
    window.addEventListener('keydown', e => {
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable) return;
      const page = window.innerHeight * 0.9;
      const moves = {
        ArrowDown: 90, ArrowUp: -90, PageDown: page, PageUp: -page,
        Home: -Infinity, End: Infinity, ' ': e.shiftKey ? -page : page,
      };
      const move = moves[e.key];
      if (move === undefined) return;
      e.preventDefault();
      scrollTo(move === Infinity ? maxScroll() : move === -Infinity ? 0 : target + move);
    });
    window.addEventListener('resize', () => { target = clamp(target); });
  }
  return { scrollTo, enabled };
})();

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

// ===== Header: solid backdrop once the hero scrolls past =====
(() => {
  const nav = document.querySelector('.nav');
  const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 40);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
})();

// ===== Language toggle (ES ⇄ EN) =====
// Only real DOM text switches; copy baked into the artwork stays as shipped.
(() => {
  const toggle = document.getElementById('langToggle');
  const label = document.getElementById('langLabel');
  if (!toggle) return;

  const items = [...document.querySelectorAll('[data-en]')];
  items.forEach(el => { el.dataset.es = el.innerHTML; });

  // Artwork with an English variant (falls back to the Spanish art if missing)
  const art = [...document.querySelectorAll('[data-en-src]')];
  art.forEach(el => { el.dataset.esSrc = el.getAttribute('src'); el.dataset.esAlt = el.alt; });

  function setLang(lang) {
    items.forEach(el => { el.innerHTML = lang === 'en' ? el.dataset.en : el.dataset.es; });

    art.forEach(el => {
      if (lang !== 'en') {
        el.src = el.dataset.esSrc;
        el.alt = el.dataset.esAlt;
        return;
      }
      // try AVIF, then the JPG fallback; if neither loads, keep the Spanish art
      const sources = [el.dataset.enSrc, el.dataset.enFallback].filter(Boolean);
      (function tryNext(i) {
        if (i >= sources.length) return;
        const probe = new Image();
        probe.onload = () => { el.src = sources[i]; el.alt = el.dataset.enAlt || el.alt; };
        probe.onerror = () => tryNext(i + 1);
        probe.src = sources[i];
      })(0);
    });
    document.documentElement.lang = lang;
    label.textContent = lang.toUpperCase();
    toggle.setAttribute('aria-label', lang === 'es' ? 'Cambiar a inglés' : 'Switch to Spanish');
    try { localStorage.setItem('naw-v0-lang', lang); } catch (e) { /* private mode */ }
  }

  toggle.addEventListener('click', () => {
    setLang(document.documentElement.lang === 'es' ? 'en' : 'es');
  });

  try {
    if (localStorage.getItem('naw-v0-lang') === 'en') setLang('en');
  } catch (e) { /* private mode */ }
})();

// ===== Carousel: autoplay + arrows + dots + drag =====
(() => {
  const track = document.getElementById('carTrack');
  const dots = [...document.querySelectorAll('#carDots .dot')];
  const SLIDE = 995; // 985px card + 10px gap
  const N = 2;
  let index = 0;
  let timer;

  // clone slides on both ends for a seamless loop
  const slides = [...track.children];
  slides.forEach(s => track.appendChild(s.cloneNode(true)));
  slides.forEach(s => track.insertBefore(s.cloneNode(true), track.firstChild));
  let pos = N; // start on the first real slide

  const setX = (animate = true) => {
    track.style.transition = animate ? 'transform 0.85s cubic-bezier(0.33, 1, 0.68, 1)' : 'none';
    track.style.transform = `translateX(${-pos * SLIDE}px)`;
  };
  setX(false);

  const paint = () => dots.forEach((d, i) => d.classList.toggle('active', i === index));

  function go(delta) {
    pos += delta;
    index = ((pos - N) % N + N) % N;
    setX(true);
    paint();
  }
  track.addEventListener('transitionend', () => {
    // snap back into the real range without a visible jump
    if (pos >= N * 2) { pos -= N; setX(false); }
    if (pos < N) { pos += N; setX(false); }
  });

  const restart = () => { clearInterval(timer); timer = setInterval(() => go(1), 4000); };
  document.getElementById('carNext').addEventListener('click', () => { go(1); restart(); });
  document.getElementById('carPrev').addEventListener('click', () => { go(-1); restart(); });
  dots.forEach((d, i) => d.addEventListener('click', () => { go(i - index); restart(); }));

  // drag
  const box = document.getElementById('carousel');
  let startX = null, startPos = 0;
  box.addEventListener('pointerdown', e => {
    if (e.target.closest('button')) return;
    startX = e.clientX; startPos = pos;
    track.style.transition = 'none';
    box.setPointerCapture(e.pointerId);
  });
  box.addEventListener('pointermove', e => {
    if (startX === null) return;
    track.style.transform = `translateX(${-startPos * SLIDE + (e.clientX - startX)}px)`;
  });
  const endDrag = e => {
    if (startX === null) return;
    const moved = e.clientX - startX;
    startX = null;
    if (moved < -60) go(1);
    else if (moved > 60) go(-1);
    else setX(true);
    restart();
  };
  box.addEventListener('pointerup', endDrag);
  box.addEventListener('pointercancel', () => { startX = null; setX(true); });
  restart();
})();

// ===== Explora: horizontal gallery driven by vertical scroll =====
(() => {
  const section = document.getElementById('explora');
  const row = document.getElementById('exploraRow');
  const RATE = 1.62;        // px of horizontal shift per px of scroll (measured)
  const MAX = 2614;         // full exit of the last card (measured)
  let ticking = false;

  function update() {
    // rects and scroll are in zoomed (visual) px; convert to design px
    const topV = section.getBoundingClientRect().top;
    const shift = Math.min(MAX, Math.max(0, RATE * (-topV + 30 * pageZoom) / pageZoom));
    row.style.transform = `translateX(${-shift}px)`;
  }
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { update(); ticking = false; });
  }, { passive: true });
  update();
})();

// ===== Download-App phones: spread apart as the section scrolls in =====
(() => {
  const wrap = document.querySelector('.phones');
  const section = document.querySelector('.download');
  let ticking = false;
  function update() {
    const top = section.getBoundingClientRect().top + window.scrollY;
    const vh = window.innerHeight;
    const p = Math.min(1, Math.max(0, (window.scrollY + vh - top) / vh));
    wrap.style.setProperty('--p', p.toFixed(4));
  }
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { update(); ticking = false; });
  }, { passive: true });
  update();
})();

// ===== Appear animations =====
(() => {
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('on');
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
  document.querySelectorAll('.fx').forEach((el, i) => {
    el.style.transitionDelay = (el.classList.contains('fx-pop') ? (i % 7) * 60 : 0) + 'ms';
    io.observe(el);
  });
})();
