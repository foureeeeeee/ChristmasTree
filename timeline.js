import { TIMELINE, TIMELINE_INTRO } from './content.js';
import { memoryPlate } from './ui.js';
import { clamp } from './utils.js';

/* ------------------------------------------------------------------
   The picture wall.

   When the tree breaks open, the light settles into a thread and this
   hangs off it: September to Christmas Day, cards alternating above
   and below the line, photographs where there are photographs and a
   hand-drawn winter plate where there are not yet.

   Wide screens get the thread running left to right and drag to
   scroll; narrow screens get it running down the side instead.
   ------------------------------------------------------------------ */

export function createTimeline({ onClose } = {}) {
  const $ = (id) => document.getElementById(id);
  const root = $('timeline');
  const scroll = $('tl-scroll');
  const track = $('tl-track');
  const rail = $('tl-rail');
  const closeBtn = $('tl-close');

  $('tl-kicker').textContent = TIMELINE_INTRO.kicker;
  $('tl-title').textContent = TIMELINE_INTRO.title;
  const hintEl = $('tl-hint');
  const setHint = () => {
    hintEl.textContent = window.innerWidth <= 760
      ? (TIMELINE_INTRO.hintTouch || 'Scroll down to Christmas Day')
      : TIMELINE_INTRO.hint;
  };
  setHint();
  window.addEventListener('resize', setHint);

  let open = false;
  let built = false;
  let accent = null;
  const cards = [];

  /* ---------------- build ---------------- */
  function build() {
    if (built) return;
    built = true;
    let month = null;
    let i = 0;

    for (const entry of TIMELINE) {
      if (entry.month !== month) {
        month = entry.month;
        const m = document.createElement('div');
        m.className = 'tl-month';
        m.innerHTML = '<b></b><i></i>';
        m.querySelector('b').textContent = month;
        track.appendChild(m);
      }

      const card = document.createElement('article');
      card.className = `tl-card ${i % 2 === 0 ? 'up' : 'down'}${entry.finale ? ' finale' : ''}`;
      card.tabIndex = 0;

      const inner = document.createElement('div');
      inner.className = 'tl-inner';

      const shots = document.createElement('div');
      const n = Math.min(3, Math.max(1, (entry.photos || []).length || 1));
      shots.className = `tl-shots n${n}`;
      for (let k = 0; k < n; k++) {
        const fig = document.createElement('figure');
        const src = (entry.photos || [])[k];
        if (src) {
          const img = document.createElement('img');
          img.loading = 'lazy';
          img.decoding = 'async';
          img.alt = entry.title;
          img.src = src;
          img.onerror = () => { fig.replaceChildren(plate(i * 7 + k)); };
          fig.appendChild(img);
        } else {
          fig.dataset.plate = String(i * 7 + k);
        }
        shots.appendChild(fig);
      }
      inner.appendChild(shots);

      const text = document.createElement('div');
      text.className = 'tl-text';
      const date = document.createElement('p');
      date.className = 'tl-date';
      date.textContent = entry.date;
      const h = document.createElement('h3');
      h.textContent = entry.title;
      const p = document.createElement('p');
      p.className = 'tl-body';
      p.textContent = entry.body;
      text.append(date, h, p);
      if (entry.song) {
        const song = document.createElement('p');
        song.className = 'tl-song';
        song.textContent = entry.song;
        text.appendChild(song);
      }
      inner.appendChild(text);

      card.appendChild(inner);
      track.appendChild(card);
      cards.push(card);
      i++;
    }
  }

  function plate(seed) {
    return memoryPlate(seed + 31, accent);
  }

  /** Draw the stand-in winter plates only once the wall is first opened. */
  function fillPlates() {
    track.querySelectorAll('figure[data-plate]').forEach((fig) => {
      const seed = Number(fig.dataset.plate);
      delete fig.dataset.plate;
      fig.appendChild(plate(seed));
    });
  }

  /* ---------------- rail geometry ---------------- */
  function layoutRail() {
    if (window.innerWidth > 760) {
      rail.style.width = `${track.scrollWidth}px`;
      rail.style.height = '1px';
    } else {
      rail.style.width = '1px';
      rail.style.height = `${track.scrollHeight}px`;
    }
  }

  /* ---------------- drag to scroll ---------------- */
  let dragging = false, startX = 0, startY = 0, startLeft = 0, startTop = 0, moved = 0;

  scroll.addEventListener('pointerdown', (e) => {
    if (window.innerWidth <= 760) return;
    dragging = true; moved = 0;
    startX = e.clientX; startY = e.clientY;
    startLeft = scroll.scrollLeft; startTop = scroll.scrollTop;
    scroll.classList.add('dragging');
    scroll.setPointerCapture?.(e.pointerId);
  });
  scroll.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    moved = Math.max(moved, Math.abs(dx) + Math.abs(e.clientY - startY));
    scroll.scrollLeft = startLeft - dx;
    scroll.scrollTop = startTop - (e.clientY - startY) * 0.3;
  });
  const endDrag = () => { dragging = false; scroll.classList.remove('dragging'); };
  scroll.addEventListener('pointerup', endDrag);
  scroll.addEventListener('pointercancel', endDrag);
  scroll.addEventListener('pointerleave', endDrag);

  scroll.addEventListener('wheel', (e) => {
    if (window.innerWidth <= 760) return;
    if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
    e.preventDefault();
    scroll.scrollLeft += e.deltaY;
  }, { passive: false });

  scroll.addEventListener('keydown', (e) => {
    const step = window.innerWidth > 760 ? 340 : 260;
    if (e.key === 'ArrowRight') { scroll.scrollBy({ left: step, behavior: 'smooth' }); e.preventDefault(); }
    else if (e.key === 'ArrowLeft') { scroll.scrollBy({ left: -step, behavior: 'smooth' }); e.preventDefault(); }
    else if (e.key === 'ArrowDown') { scroll.scrollBy({ top: step, left: window.innerWidth > 760 ? step : 0, behavior: 'smooth' }); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { scroll.scrollBy({ top: -step, left: window.innerWidth > 760 ? -step : 0, behavior: 'smooth' }); e.preventDefault(); }
    else if (e.key === 'Home') { scroll.scrollTo({ left: 0, top: 0, behavior: 'smooth' }); }
    else if (e.key === 'End') { scroll.scrollTo({ left: scroll.scrollWidth, top: scroll.scrollHeight, behavior: 'smooth' }); }
  });

  closeBtn.addEventListener('click', () => hide());
  window.addEventListener('resize', () => { if (open) layoutRail(); });

  /* ---------------- show / hide ---------------- */
  function show() {
    build();
    fillPlates();
    open = true;
    scroll.scrollLeft = 0;
    scroll.scrollTop = 0;
    root.classList.add('on');
    root.setAttribute('aria-hidden', 'false');
    document.body.classList.add('wall');
    cards.forEach((c, k) => {
      c.style.transitionDelay = `${0.12 + k * 0.055}s`;
    });
    requestAnimationFrame(() => requestAnimationFrame(layoutRail));
    setTimeout(() => scroll.focus({ preventScroll: true }), 420);
  }

  function hide() {
    if (!open) return;
    open = false;
    root.classList.remove('on');
    root.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('wall');
    cards.forEach((c) => { c.style.transitionDelay = '0s'; });
    onClose?.();
  }

  return {
    show, hide,
    isOpen: () => open,
    /** Tint the rail, the dots and the stand-in plates with the album
     *  colour. Three.js keeps colours in linear space, so they have to
     *  come back through sRGB before CSS or canvas sees them. */
    setAccent(color) {
      const hex = color && color.getHexString ? color.getHexString() : 'a8dfff';
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      accent = { r: r / 255, g: g / 255, b: b / 255 };
      document.documentElement.style.setProperty('--accent', `rgb(${r}, ${g}, ${b})`);
      document.documentElement.style.setProperty('--accent-soft', `rgba(${r}, ${g}, ${b}, .38)`);
    },
  };
}
