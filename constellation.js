import * as THREE from 'three';
import { TREE, QUALITY } from './config.js';
import { ALBUMS, THIRTEENTH } from './albums.js';
import { makeRng, lerp, clamp, rr, easeOutCubic, softSprite } from './utils.js';

/* ------------------------------------------------------------------
   Twelve stars in a slow ring around the whole sky, one for each
   record, each burning in that record's colour. Touch one and it
   sends a thread of light down to the top of the tree.

   Find all twelve and a thirteenth lights up overhead.
   ------------------------------------------------------------------ */

const TOP = new THREE.Vector3(0, TREE.height + 0.52, 0);

function albumStarTexture(size = 256) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const ctx = cv.getContext('2d');
  const h = size / 2;
  ctx.translate(h, h);

  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, h);
  g.addColorStop(0.00, 'rgba(255,255,255,1)');
  g.addColorStop(0.09, 'rgba(255,255,255,0.96)');
  g.addColorStop(0.17, 'rgba(255,255,255,0.62)');
  g.addColorStop(0.30, 'rgba(255,255,255,0.22)');
  g.addColorStop(0.58, 'rgba(255,255,255,0.05)');
  g.addColorStop(1.00, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(0, 0, h, 0, Math.PI * 2); ctx.fill();

  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 8; i++) {
    const long = i % 2 === 0;
    const len = h * (long ? 0.94 : 0.38);
    const w = h * (long ? 0.03 : 0.02);
    ctx.save();
    ctx.rotate((i / 8) * Math.PI * 2);
    const rg = ctx.createLinearGradient(0, 0, 0, -len);
    rg.addColorStop(0, 'rgba(255,255,255,0.95)');
    rg.addColorStop(0.25, 'rgba(255,255,255,0.4)');
    rg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.moveTo(-w, 0); ctx.lineTo(0, -len); ctx.lineTo(w, 0);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildConstellation() {
  const rnd = makeRng(1313);
  const group = new THREE.Group();
  group.name = 'constellation';

  const starTex = albumStarTexture(256);
  const softTex = softSprite(128, 1, 2.0);

  const RADIUS = 30;
  const stars = [];
  const pickables = [];

  /* --- the twelve, strung in a slow undulating ring around the sky --- */
  ALBUMS.forEach((album, i) => {
    const u = i / ALBUMS.length;
    const az = u * Math.PI * 2 + 0.42;
    const el = THREE.MathUtils.degToRad(13 + Math.sin(u * Math.PI * 4) * 7 + rr(rnd, -1.5, 1.5));
    const pos = new THREE.Vector3(
      Math.cos(az) * Math.cos(el) * RADIUS,
      Math.sin(el) * RADIUS + 6.0,
      Math.sin(az) * Math.cos(el) * RADIUS
    );
    stars.push(makeStar(album, pos, i));
  });

  /* --- the thirteenth, riding a little above the others and set
         between two of them, dark until it has been earned --- */
  const TH_AZ = 0.42 + Math.PI + Math.PI / 12;
  const TH_EL = THREE.MathUtils.degToRad(21.5);
  const thirteenth = makeStar(THIRTEENTH, new THREE.Vector3(
    Math.cos(TH_AZ) * Math.cos(TH_EL) * RADIUS,
    Math.sin(TH_EL) * RADIUS + 6.0,
    Math.sin(TH_AZ) * Math.cos(TH_EL) * RADIUS
  ), 12);
  thirteenth.locked = true;
  thirteenth.sprite.visible = false;
  thirteenth.halo.visible = false;
  thirteenth.sprite.scale.setScalar(0.001);

  function makeStar(album, pos, index) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: starTex, color: album.starCol, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.9,
    }));
    sprite.position.copy(pos);
    sprite.scale.setScalar(2.1);
    sprite.renderOrder = 6;
    sprite.userData = { kind: 'album', index };
    group.add(sprite);
    pickables.push(sprite);

    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: softTex, color: album.starCol, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.26,
    }));
    halo.position.copy(pos);
    halo.scale.setScalar(5.6);
    halo.renderOrder = 5;
    group.add(halo);

    return {
      album, pos, sprite, halo, index,
      phase: rr(rnd, 0, Math.PI * 2),
      rate: rr(rnd, 0.35, 0.72),
      visited: false, active: false, hover: 0, flare: 0, locked: false,
    };
  }

  /* --- a faint thread joining them, like a drawn constellation --- */
  const linePts = stars.map((s) => s.pos.clone());
  const lineGeo = new THREE.BufferGeometry().setFromPoints([...linePts, linePts[0]]);
  const lineMat = new THREE.LineBasicMaterial({
    color: 0x9fc2e8, transparent: true, opacity: 0.085, depthWrite: false,
  });
  const ring = new THREE.Line(lineGeo, lineMat);
  ring.renderOrder = 4;
  group.add(ring);

  /* --- the thread of light that runs from a star down to the topper --- */
  const N = QUALITY.tier === 'low' ? 26 : 46;
  const cometPos = new Float32Array(N * 3);
  const cometSize = new Float32Array(N);
  for (let i = 0; i < N; i++) cometSize[i] = (1 - i / N) * 0.17 + 0.02;
  const cometGeo = new THREE.BufferGeometry();
  cometGeo.setAttribute('position', new THREE.BufferAttribute(cometPos, 3));
  cometGeo.setAttribute('aSize', new THREE.BufferAttribute(cometSize, 1));
  const cometMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    uniforms: {
      uScale: { value: 1200 }, uOpacity: { value: 0 },
      uColor: { value: new THREE.Color(0xffffff) },
    },
    vertexShader: `
      attribute float aSize; uniform float uScale; varying float vF;
      void main(){
        vec4 mv = modelViewMatrix * vec4(position,1.0);
        gl_Position = projectionMatrix * mv;
        vF = aSize / 0.19;
        gl_PointSize = clamp(aSize*uScale/max(0.4,-mv.z), 0.0, 90.0);
      }`,
    fragmentShader: `
      precision highp float; varying float vF;
      uniform float uOpacity; uniform vec3 uColor;
      void main(){
        float r = length(gl_PointCoord - vec2(0.5))*2.0;
        if (r > 1.0) discard;
        gl_FragColor = vec4(uColor, pow(1.0-r,2.0)*uOpacity*pow(vF,1.2));
      }`,
  });
  const comet = new THREE.Points(cometGeo, cometMat);
  comet.frustumCulled = false;
  comet.renderOrder = 7;
  comet.visible = false;
  group.add(comet);

  let cometT = -1, cometFrom = new THREE.Vector3(), cometCtrl = new THREE.Vector3();
  let cometDone = null;
  const COMET_DUR = 1.0;

  function sendComet(star, onArrive) {
    cometFrom.copy(star.pos);
    cometCtrl.copy(star.pos).lerp(TOP, 0.5);
    cometCtrl.y += 7;
    cometMat.uniforms.uColor.value.copy(star.album.starCol);
    cometT = 0;
    cometDone = onArrive;
    comet.visible = true;
    star.flare = 1;
  }

  const bez = new THREE.Vector3();
  function bezier(out, t) {
    const mt = 1 - t;
    out.copy(cometFrom).multiplyScalar(mt * mt)
      .addScaledVector(cometCtrl, 2 * mt * t)
      .addScaledVector(TOP, t * t);
    return out;
  }

  let hovered = null;

  return {
    group, pickables,
    stars,
    thirteenth,

    starFor(object) {
      if (!object) return null;
      const all = [...stars, thirteenth];
      return all.find((s) => s.sprite === object) || null;
    },

    sendComet,

    setHovered(star) { hovered = star; },

    setActive(star) {
      [...stars, thirteenth].forEach((s) => { s.active = s === star; });
    },

    markVisited(star) {
      if (!star) return;
      star.visited = true;
    },

    visitedCount() { return stars.filter((s) => s.visited).length; },

    unlockThirteenth() {
      if (!thirteenth.locked) return false;
      thirteenth.locked = false;
      thirteenth.sprite.visible = true;
      thirteenth.halo.visible = true;
      pickables.push(thirteenth.sprite);
      return true;
    },

    update(time, dt) {
      const all = [...stars, thirteenth];
      for (const s of all) {
        if (s === thirteenth && s.locked) continue;
        const pulse = 0.5 + 0.5 * Math.sin(time * s.rate + s.phase);
        const hov = s === hovered ? 1 : 0;
        s.hover += (hov - s.hover) * Math.min(1, dt * 8);
        if (s.flare > 0) s.flare = Math.max(0, s.flare - dt * 1.3);

        const base = (s === thirteenth ? 3.1 : (s.visited ? 2.3 : 2.0)) + (s.active ? 0.8 : 0);
        const scale = base * (1 + pulse * 0.1 + s.hover * 0.38 + s.flare * 1.1);
        s.sprite.scale.setScalar(scale);
        s.sprite.material.opacity = (s.visited ? 1.0 : 0.85)
          * (0.78 + pulse * 0.22) + s.hover * 0.25 + s.flare * 0.6;
        s.halo.scale.setScalar(scale * 2.6);
        s.halo.material.opacity = (s.active ? 0.34 : 0.16) + pulse * 0.07
          + s.hover * 0.2 + s.flare * 0.5;
        s.sprite.material.rotation = Math.sin(time * 0.1 + s.phase) * 0.35;
      }

      /* the thirteenth fades in the first time it is unlocked */
      if (!thirteenth.locked && thirteenth.birth === undefined) thirteenth.birth = time;
      if (!thirteenth.locked) {
        const age = clamp((time - thirteenth.birth) / 2.4);
        const e = easeOutCubic(age);
        thirteenth.sprite.scale.multiplyScalar(e);
        thirteenth.halo.scale.multiplyScalar(e);
        thirteenth.sprite.material.opacity *= e;
        thirteenth.halo.material.opacity *= e;
      }

      lineMat.opacity = 0.06 + 0.035 * Math.sin(time * 0.3);

      if (cometT >= 0) {
        cometT += dt;
        const u = clamp(cometT / COMET_DUR);
        const e = easeOutCubic(u) * 0.35 + u * 0.65;
        cometMat.uniforms.uOpacity.value = Math.sin(Math.PI * Math.min(1, u * 1.15)) * 1.1;
        for (let i = 0; i < N; i++) {
          const lag = (i / N) * 0.16;
          bezier(bez, clamp(e - lag));
          cometPos[i * 3] = bez.x; cometPos[i * 3 + 1] = bez.y; cometPos[i * 3 + 2] = bez.z;
        }
        cometGeo.attributes.position.needsUpdate = true;
        if (u >= 1) {
          cometT = -1; comet.visible = false;
          cometMat.uniforms.uOpacity.value = 0;
          const fn = cometDone; cometDone = null;
          if (fn) fn();
        }
      }
    },

    setScale(s) { cometMat.uniforms.uScale.value = s; },
    setEffects(on) { ring.visible = on; },
  };
}
