import * as THREE from 'three';
import { QUALITY } from './config.js';
import { C } from './palette.js';
import { makeRng, lerp, clamp, rr, waveAmount, softSprite, snowflakeTexture } from './utils.js';
import { PRESENTS } from './content.js';

/* ------------------------------------------------------------------
   Christmas presents: midnight-blue, silver and frosted-white
   wrapping, satin ribbons, bows and little hand-written gift tags.
   One of them is the special gift and keeps the whole winter inside.
   ------------------------------------------------------------------ */

function paper(kind, seed = 3) {
  const rnd = makeRng(seed);
  const S = 256;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const ctx = cv.getContext('2d');

  if (kind === 'midnight') {
    ctx.fillStyle = '#8e8e8e'; ctx.fillRect(0, 0, S, S);
    const g = ctx.createLinearGradient(0, 0, S, S);
    g.addColorStop(0, 'rgba(255,255,255,.22)'); g.addColorStop(1, 'rgba(0,0,0,.22)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
    ctx.strokeStyle = 'rgba(255,255,255,.62)';
    for (let i = 0; i < 46; i++) {
      const x = rnd() * S, y = rnd() * S, r = 3 + rnd() * 7;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      for (let a = 0; a < 6; a++) {
        const t = (a / 6) * Math.PI * 2;
        ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(t) * r, y + Math.sin(t) * r);
      }
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,255,255,.65)';
    for (let i = 0; i < 120; i++) { ctx.beginPath(); ctx.arc(rnd() * S, rnd() * S, 0.9, 0, 6.3); ctx.fill(); }
  } else if (kind === 'silver') {
    ctx.fillStyle = '#d8d8d8'; ctx.fillRect(0, 0, S, S);
    for (let i = -S; i < S * 2; i += 11) {
      ctx.strokeStyle = i % 22 === 0 ? 'rgba(255,255,255,.8)' : 'rgba(90,90,90,.3)';
      ctx.lineWidth = i % 22 === 0 ? 3.5 : 2;
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i - S, S); ctx.stroke();
    }
  } else if (kind === 'frost') {
    ctx.fillStyle = '#f4f4f4'; ctx.fillRect(0, 0, S, S);
    ctx.strokeStyle = 'rgba(110,110,110,.38)';
    for (let i = 0; i < 26; i++) {
      const x = rnd() * S, y = rnd() * S, r = 8 + rnd() * 14;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      for (let a = 0; a < 6; a++) {
        const t = (a / 6) * Math.PI * 2;
        ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(t) * r, y + Math.sin(t) * r);
        const mx = x + Math.cos(t) * r * 0.6, my = y + Math.sin(t) * r * 0.6;
        ctx.moveTo(mx, my);
        ctx.lineTo(mx + Math.cos(t + 0.7) * r * 0.3, my + Math.sin(t + 0.7) * r * 0.3);
        ctx.moveTo(mx, my);
        ctx.lineTo(mx + Math.cos(t - 0.7) * r * 0.3, my + Math.sin(t - 0.7) * r * 0.3);
      }
      ctx.stroke();
    }
  } else { /* royal */
    ctx.fillStyle = '#bcbcbc'; ctx.fillRect(0, 0, S, S);
    for (let i = 0; i < S; i += 16) {
      ctx.fillStyle = (i / 16) % 2 ? 'rgba(255,255,255,.26)' : 'rgba(0,0,0,.2)';
      ctx.fillRect(i, 0, 8, S);
    }
    ctx.fillStyle = 'rgba(255,255,255,.55)';
    for (let i = 0; i < 90; i++) { ctx.beginPath(); ctx.arc(rnd() * S, rnd() * S, 1.1, 0, 6.3); ctx.fill(); }
  }

  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function tagTexture(label) {
  const W = 256, H = 160;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#f4ebdd'; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(16,43,89,.3)'; ctx.lineWidth = 3;
  ctx.strokeRect(7, 7, W - 14, H - 14);
  ctx.fillStyle = 'rgba(16,43,89,.85)';
  ctx.font = 'italic 34px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText('for you', W / 2, 66);
  ctx.font = '18px Georgia, serif';
  ctx.fillStyle = 'rgba(16,43,89,.6)';
  ctx.fillText(label, W / 2, 104);
  ctx.beginPath(); ctx.arc(W / 2, 26, 7, 0, 6.3);
  ctx.fillStyle = '#0a1d40'; ctx.fill();
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildPresents() {
  const rnd = makeRng(777);
  const group = new THREE.Group();
  group.name = 'presents';

  const papers = {
    midnight: paper('midnight', 11),
    silver: paper('silver', 22),
    frost: paper('frost', 33),
    royal: paper('royal', 44),
  };
  /* the paper pattern is greyscale; this colour is the paper itself */
  const PAPER_HOUSE = {
    midnight: new THREE.Color(0x12305e),
    silver: new THREE.Color(0xc3d2e6),
    frost: new THREE.Color(0xe7f0fb),
    royal: new THREE.Color(0x1b4f93),
  };
  const PAPER_SLOT = { midnight: 'ribbonB', silver: 'metal', frost: 'light1', royal: 'mid' };

  const paperMats = Object.fromEntries(Object.entries(papers).map(([k, tex]) => [k,
    new THREE.MeshStandardMaterial({
      map: tex, color: PAPER_HOUSE[k].clone(),
      roughness: k === 'silver' ? 0.34 : 0.56, metalness: k === 'silver' ? 0.52 : 0.14,
      envMapIntensity: 0.9, transparent: true,
    })]));

  const ribbonMats = {
    silver: new THREE.MeshPhysicalMaterial({ color: 0xdfe8f5, roughness: 0.3, metalness: 0.45, sheen: 1, sheenColor: new THREE.Color(0xffffff), envMapIntensity: 1.3, transparent: true }),
    navy: new THREE.MeshPhysicalMaterial({ color: 0x0b2149, roughness: 0.26, metalness: 0.35, sheen: 1, sheenColor: new THREE.Color(0x5f9ee6), envMapIntensity: 1.5, transparent: true }),
    ice: new THREE.MeshPhysicalMaterial({ color: 0x9ed4f5, roughness: 0.28, metalness: 0.3, sheen: 1, sheenColor: new THREE.Color(0xdff2ff), envMapIntensity: 1.4, transparent: true }),
  };

  const layout = [
    { pos: [-2.72, 0, 1.92], size: [1.15, 0.78, 1.15], rot: 0.35, paper: 'midnight', ribbon: 'silver' },
    { pos: [2.42, 0, 2.52], size: [0.92, 0.92, 0.92], rot: -0.6, paper: 'silver', ribbon: 'navy' },
    { pos: [3.45, 0, -1.35], size: [1.35, 0.55, 0.88], rot: 0.9, paper: 'frost', ribbon: 'ice' },
    { pos: [-3.5, 0, -1.75], size: [0.8, 1.25, 0.8], rot: -0.25, paper: 'royal', ribbon: 'silver' },
    { pos: [0.45, 0, 3.55], size: [1.05, 0.62, 0.75], rot: 0.15, paper: 'silver', ribbon: 'navy' },
    { pos: [-0.75, 0, -3.65], size: [0.98, 0.7, 0.98], rot: -0.9, paper: 'midnight', ribbon: 'ice' },
    { pos: [2.42, 0.92, 2.52], size: [0.6, 0.45, 0.6], rot: 0.5, paper: 'frost', ribbon: 'silver' },
    { pos: [-2.72, 0.78, 1.92], size: [0.68, 0.5, 0.68], rot: -0.4, paper: 'royal', ribbon: 'navy' },
  ];

  const WHITE = new THREE.Color(0xffffff);
  const GLOW_BASE = new THREE.Color(0x9fd8ff);
  const RB = {
    silver: new THREE.Color(0xdfe8f5),
    navy: new THREE.Color(0x0b2149),
    ice: new THREE.Color(0x9ed4f5),
  };
  const SH = {
    silver: new THREE.Color(0xffffff),
    navy: new THREE.Color(0x5f9ee6),
    ice: new THREE.Color(0xdff2ff),
  };
  const items = [];
  const pickables = [];
  const boxMats = [];
  const boxGeo = new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);

  layout.forEach((cfg, i) => {
    const content = PRESENTS[i % PRESENTS.length];
    const special = !!content.special;
    const g = new THREE.Group();
    const [w, h, d] = cfg.size;
    g.position.set(cfg.pos[0], cfg.pos[1] + h / 2 - 0.02, cfg.pos[2]);
    g.rotation.y = cfg.rot;

    const box = new THREE.Mesh(boxGeo, paperMats[cfg.paper].clone());
    box.scale.set(w, h, d);
    box.material.map = papers[cfg.paper];
    boxMats.push({ mat: box.material, kind: cfg.paper });
    box.userData.kind = 'present';
    g.add(box);
    pickables.push(box);

    const rm = ribbonMats[cfg.ribbon];
    const rw = Math.min(w, d) * 0.16;
    const bandA = new THREE.Mesh(boxGeo, rm);
    bandA.scale.set(rw, h * 1.012, d * 1.012);
    g.add(bandA);
    const bandB = new THREE.Mesh(boxGeo, rm);
    bandB.scale.set(w * 1.012, h * 1.012, rw);
    g.add(bandB);

    /* bow: two loops and two tails */
    const loopGeo = new THREE.TorusGeometry(rw * 1.5, rw * 0.42, 7, 14);
    for (const s of [-1, 1]) {
      const loop = new THREE.Mesh(loopGeo, rm);
      loop.position.set(s * rw * 1.5, h / 2 + rw * 0.5, 0);
      loop.rotation.set(Math.PI / 2, 0, s * 0.5);
      loop.scale.set(1, 1, 1.5);
      g.add(loop);
      const tail = new THREE.Mesh(boxGeo, rm);
      tail.scale.set(rw * 0.7, rw * 3.0, rw * 0.3);
      tail.position.set(s * rw * 1.1, h / 2 - rw * 0.6, rw * 0.4);
      tail.rotation.z = s * 0.5;
      g.add(tail);
    }
    const knot = new THREE.Mesh(new THREE.SphereGeometry(rw * 0.75, 10, 8), rm);
    knot.position.y = h / 2 + rw * 0.5;
    g.add(knot);

    /* gift tag hanging off the ribbon */
    const tagTex = tagTexture(content.title.length > 18 ? content.title.slice(0, 17) + '…' : content.title);
    const tag = new THREE.Mesh(
      new THREE.PlaneGeometry(0.34, 0.21),
      new THREE.MeshStandardMaterial({ map: tagTex, roughness: 0.75, side: THREE.DoubleSide, transparent: true })
    );
    tag.position.set(w / 2 + 0.015, h / 2 - 0.2, d * 0.1);
    tag.rotation.set(-0.12, Math.PI / 2 + 0.25, 0.1);
    g.add(tag);
    const string = new THREE.Mesh(
      new THREE.CylinderGeometry(0.005, 0.005, 0.2, 4),
      new THREE.MeshBasicMaterial({ color: 0xb6c6dc })
    );
    string.position.set(w / 2 + 0.01, h / 2 - 0.02, d * 0.1);
    string.rotation.z = 0.2;
    g.add(string);

    if (special) {
      const glowSprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: softSprite(128, 1, 2.1), color: 0xbfe4ff,
        transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.5,
      }));
      glowSprite.scale.setScalar(Math.max(w, h, d) * 3.4);
      g.add(glowSprite);
      const light = new THREE.PointLight(0x9fd8ff, 1.6, 3.2, 2);
      light.position.y = h * 0.6;
      g.add(light);
      items.push({ group: g, box, content, special, glowSprite, light, h, phase: rnd() * 6.28 });
    } else {
      items.push({ group: g, box, content, special, h, phase: rnd() * 6.28 });
    }

    group.add(g);
  });

  items.forEach((it) => { it.box.userData.present = it; });

  let morph = 0;

  return {
    group, items, pickables,
    update(time) {
      for (const it of items) {
        if (it.special) {
          const p = 0.5 + 0.5 * Math.sin(time * 1.5 + it.phase);
          it.glowSprite.material.opacity = (0.32 + p * 0.3) * (1 - morph * 0.4);
          it.glowSprite.scale.setScalar(Math.max(it.h, 1) * (3.0 + p * 0.5));
          it.light.intensity = 1.1 + p * 1.1;
        }
        // everything lifts a touch and dims while the tree is cosmic
        it.group.position.y = it.h / 2 - 0.02 + morph * 0.08 * (1 + Math.sin(time * 0.6 + it.phase) * 0.3);
      }
    },
    setMorph(m) {
      morph = m;
      const dim = lerp(1, 0.62, m);
      for (const mat of [...boxMats.map((b) => b.mat), ...Object.values(ribbonMats)]) {
        mat.opacity = dim; mat.transparent = true;
      }
      items.forEach((it) => { it.box.material.opacity = dim; });
    },
    setEffects(on) {
      items.forEach((it) => { if (it.special) it.glowSprite.visible = on; });
    },
    setTheme(from, to, waveY) {
      /* the gifts are at the foot of the tree, so they turn last */
      const w = waveAmount(0.6, waveY);
      const pick = (t, key, strength) => (t.amount ? WHITE.clone().lerp(t[key], strength) : WHITE.clone());
      for (const b of boxMats) {
        const house = PAPER_HOUSE[b.kind];
        const slot = PAPER_SLOT[b.kind];
        const a = from.amount ? house.clone().lerp(from[slot], 0.94) : house.clone();
        const col = to.amount ? house.clone().lerp(to[slot], 0.94) : house.clone();
        b.mat.color.copy(a).lerp(col, w);
      }
      ribbonMats.silver.color.copy(RB.silver.clone().lerp(from.amount ? from.ribbonA : RB.silver, 0.93))
        .lerp(RB.silver.clone().lerp(to.amount ? to.ribbonA : RB.silver, 0.93), w);
      ribbonMats.navy.color.copy(RB.navy.clone().lerp(from.amount ? from.ribbonB : RB.navy, 0.93))
        .lerp(RB.navy.clone().lerp(to.amount ? to.ribbonB : RB.navy, 0.93), w);
      ribbonMats.ice.color.copy(RB.ice.clone().lerp(from.amount ? from.light2 : RB.ice, 0.93))
        .lerp(RB.ice.clone().lerp(to.amount ? to.light2 : RB.ice, 0.93), w);
      /* the satin sheen is a strong blue by default — retune it too */
      const sheen = (t, base) => (t.amount ? base.clone().lerp(t.light2, 0.9) : base.clone());
      ribbonMats.silver.sheenColor.copy(sheen(from, SH.silver)).lerp(sheen(to, SH.silver), w);
      ribbonMats.navy.sheenColor.copy(sheen(from, SH.navy)).lerp(sheen(to, SH.navy), w);
      ribbonMats.ice.sheenColor.copy(sheen(from, SH.ice)).lerp(sheen(to, SH.ice), w);
      items.forEach((it) => {
        if (!it.special) return;
        const a = from.amount ? from.light2 : GLOW_BASE;
        const b = to.amount ? to.light2 : GLOW_BASE;
        it.glowSprite.material.color.copy(a).lerp(b, w);
        it.light.color.copy(a).lerp(b, w);
      });
    },
    findPresent(mesh) { return mesh?.userData?.present || null; },
  };
}
