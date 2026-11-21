import { ABOUT } from './content.js';
import { makeRng, rr } from './utils.js';

/* ------------------------------------------------------------------
   The discreet interface: one glass card for memories, a small
   tooltip, and a cluster of controls in the corner.
   ------------------------------------------------------------------ */

export function memoryPlate(seed = 1, accent = null) {
  const rnd = makeRng(seed * 7919 + 13);
  const tint = accent || { r: 0.66, g: 0.87, b: 1 };
  const T = `${Math.round(tint.r * 255)},${Math.round(tint.g * 255)},${Math.round(tint.b * 255)}`;
  const W = 640, H = 480;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');

  const g = ctx.createLinearGradient(0, 0, W * 0.3, H);
  g.addColorStop(0, `rgba(${T},.16)`);
  g.addColorStop(0.55, `rgba(${T},.34)`);
  g.addColorStop(1, 'rgba(3,10,28,.9)');
  ctx.fillStyle = '#060e22'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

  ctx.globalCompositeOperation = 'lighter';
  // soft bokeh, as though shot wide open through a lit window
  for (let i = 0; i < 46; i++) {
    const x = rnd() * W, y = rnd() * H * 0.9;
    const r = 6 + Math.pow(rnd(), 2) * 54;
    const warm = rnd() < 0.55;
    const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
    const c = warm ? '255,222,170' : T;
    rg.addColorStop(0, `rgba(${c},${0.22 + rnd() * 0.3})`);
    rg.addColorStop(0.7, `rgba(${c},0.05)`);
    rg.addColorStop(1, `rgba(${c},0)`);
    ctx.fillStyle = rg;
    ctx.beginPath(); ctx.arc(x, y, r, 0, 6.3); ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';

  // a suggestion of a tree and a horizon
  ctx.fillStyle = 'rgba(2,8,20,.74)';
  ctx.beginPath();
  const cx = W * (0.22 + rnd() * 0.56), base = H * 0.86, hh = H * (0.4 + rnd() * 0.22);
  ctx.moveTo(cx, base - hh);
  for (let i = 0; i < 7; i++) {
    const t = (i + 1) / 7;
    const w = (W * 0.1) * t;
    ctx.lineTo(cx + w, base - hh * (1 - t) - 8);
    ctx.lineTo(cx + w * 0.6, base - hh * (1 - t) - 8);
  }
  ctx.lineTo(cx + W * 0.03, base);
  ctx.lineTo(cx - W * 0.03, base);
  for (let i = 6; i >= 0; i--) {
    const t = (i + 1) / 7;
    const w = (W * 0.1) * t;
    ctx.lineTo(cx - w * 0.6, base - hh * (1 - t) - 8);
    ctx.lineTo(cx - w, base - hh * (1 - t) - 8);
  }
  ctx.closePath(); ctx.fill();

  ctx.fillStyle = 'rgba(3,10,24,.8)';
  ctx.fillRect(0, H * 0.855, W, H * 0.145);

  // falling snow and a little grain
  ctx.fillStyle = 'rgba(234,243,255,.75)';
  for (let i = 0; i < 260; i++) {
    const r = rnd() < 0.9 ? 1 + rnd() * 1.6 : 2.4 + rnd() * 2.2;
    ctx.globalAlpha = 0.25 + rnd() * 0.6;
    ctx.beginPath(); ctx.arc(rnd() * W, rnd() * H, r, 0, 6.3); ctx.fill();
  }
  ctx.globalAlpha = 1;
  const img = ctx.getImageData(0, 0, W, H);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 11;
    img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);

  const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.78);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(2,6,16,.6)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);

  return cv;
}

export function createUI(handlers) {
  const $ = (id) => document.getElementById(id);
  const card = $('card'), cardTitle = $('card-title'), cardBody = $('card-body');
  const cardKicker = $('card-kicker'), cardFoot = $('card-foot'), cardMedia = $('card-media');
  const tooltip = $('tooltip'), loader = $('loader'), loaderSub = $('loader-sub');
  const modeLabel = $('mode-label'), btnModeTxt = $('btn-mode-txt');
  const btnMode = $('btn-mode'), btnSpin = $('btn-spin'), btnReset = $('btn-reset');
  const btnLights = $('btn-lights'), btnHelp = $('btn-help'), cardClose = $('card-close');

  let plateSeed = 0;
  let isCosmic = false;
  let albumName = null;
  let foundCount = 0;

  const WORDS = ['none', 'one', 'two', 'three', 'four', 'five', 'six',
    'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];

  function renderLabel() {
    const mode = isCosmic ? 'Cosmic mode' : 'Enchanted mode';
    if (albumName) {
      const tail = foundCount >= 12
        ? 'all twelve found'
        : `${WORDS[foundCount] || foundCount} of twelve found`;
      modeLabel.textContent = `${mode} · ${albumName} · ${tail}`;
    } else {
      modeLabel.textContent = isCosmic
        ? `${mode} · the same tree, in particles`
        : `${mode} · twelve stars are out in the sky`;
    }
  }

  btnMode.addEventListener('click', () => handlers.onMode());
  btnSpin.addEventListener('click', () => handlers.onSpin());
  btnReset.addEventListener('click', () => handlers.onReset());
  btnLights.addEventListener('click', () => handlers.onEffects());
  btnHelp.addEventListener('click', () => showCard(ABOUT, { media: false }));
  cardClose.addEventListener('click', () => { hideCard(); handlers.onCardClose?.(); });

  function showCard(content, opts = {}) {
    cardKicker.textContent = content.kicker || '';
    cardTitle.textContent = content.title || '';
    cardBody.textContent = content.body || '';
    cardFoot.textContent = content.foot || '';
    card.classList.toggle('easter', !!content.easter);

    cardMedia.innerHTML = '';
    if (opts.media) {
      if (content.photo) {
        const img = document.createElement('img');
        img.alt = content.title || '';
        img.src = content.photo;
        img.onerror = () => { cardMedia.innerHTML = ''; cardMedia.appendChild(memoryPlate(++plateSeed)); };
        cardMedia.appendChild(img);
      } else {
        cardMedia.appendChild(memoryPlate(++plateSeed));
      }
      cardMedia.classList.add('on');
    } else {
      cardMedia.classList.remove('on');
    }
    card.classList.add('on');
    document.body.classList.add('focused');
  }

  function hideCard() {
    card.classList.remove('on');
    document.body.classList.remove('focused');
  }

  let tipTimer = 0;
  function setTooltip(text, x, y) {
    if (!text) { tooltip.classList.remove('on'); return; }
    tooltip.textContent = text;
    tooltip.style.left = `${x}px`;
    tooltip.style.top = `${y}px`;
    tooltip.classList.add('on');
    clearTimeout(tipTimer);
    tipTimer = setTimeout(() => tooltip.classList.remove('on'), 2600);
  }

  return {
    showCard, hideCard, setTooltip,
    cardIsOpen: () => card.classList.contains('on'),
    setLoaderText(t) { loaderSub.textContent = t; },
    finishLoading() {
      loader.classList.add('gone');
      document.body.classList.add('ready');
      setTimeout(() => { loader.style.display = 'none'; }, 1400);
    },
    setMode(cosmic) {
      isCosmic = cosmic;
      btnMode.setAttribute('aria-pressed', String(cosmic));
      btnModeTxt.textContent = cosmic ? 'Enchanted mode' : 'Cosmic mode';
      renderLabel();
    },
    setAlbum(name, found) {
      albumName = name;
      if (typeof found === 'number') foundCount = found;
      renderLabel();
    },
    setSpin(on) { btnSpin.setAttribute('aria-pressed', String(on)); },
    setEffects(on) {
      btnLights.setAttribute('aria-pressed', String(on));
      btnLights.title = on ? 'Turn the special effects off' : 'Turn the special effects on';
    },
    setCursor(c) { document.body.style.cursor = c; },
  };
}
