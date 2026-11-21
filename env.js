import * as THREE from 'three';
import { TREE, QUALITY } from './config.js';
import { C } from './palette.js';
import { makeRng, lerp, clamp, rr, waveAmount, softSprite } from './utils.js';

/* ------------------------------------------------------------------
   The winter night around the tree: sky, distant stars, three depths
   of falling snow, drifting mist, the occasional shooting star, and
   the procedural environment map that gives every bauble something
   worth reflecting.
   ------------------------------------------------------------------ */

const css = (c, a = 1) => `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${a})`;

/** The equirectangular surroundings the glass and metal reflect.
 *  Each album gets its own, so a gold tree reflects gold. */
export function buildEnvMap(renderer, theme) {
  const W = 1024, H = 512;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');

  const themed = theme && theme.amount;
  const top = themed ? theme.skyTop : new THREE.Color(0x07122c);
  const midC = themed ? theme.skyMid : new THREE.Color(0x0d2449);
  const horiz = themed ? theme.skyHorizon : new THREE.Color(0x13335f);
  const lowC = themed ? theme.deep : new THREE.Color(0x071428);
  const warmC = themed ? theme.light1 : new THREE.Color(0xffd698);
  const coolC = themed ? theme.light2 : new THREE.Color(0x96d7ff);
  const moonC = themed ? theme.metal : new THREE.Color(0xe2f0ff);

  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0.00, css(top));
  g.addColorStop(0.42, css(midC));
  g.addColorStop(0.54, css(horiz));
  g.addColorStop(0.70, css(lowC));
  g.addColorStop(1.00, css(top.clone().multiplyScalar(0.6)));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  const blob = (x, y, r, color, a) => {
    const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, color.replace('ALPHA', a));
    rg.addColorStop(0.45, color.replace('ALPHA', a * 0.3));
    rg.addColorStop(1, color.replace('ALPHA', '0'));
    ctx.fillStyle = rg;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  };
  ctx.globalCompositeOperation = 'lighter';

  // a soft moon high up
  blob(W * 0.18, H * 0.18, 150, css(moonC, 1).replace(/[\d.]+\)$/, 'ALPHA)'), 0.55);
  blob(W * 0.18, H * 0.18, 42, 'rgba(255,255,255,ALPHA)', 0.95);

  // warm fairy-light pools and icy pools around the horizon,
  // so glass and metal ornaments pick up both temperatures
  const rnd = makeRng(99);
  for (let i = 0; i < 16; i++) {
    const x = rnd() * W;
    const y = H * (0.42 + rnd() * 0.22);
    const warm = i % 2 === 0;
    blob(x, y, 40 + rnd() * 90,
      css(warm ? warmC : coolC, 1).replace(/[\d.]+\)$/, 'ALPHA)'),
      0.4 + rnd() * 0.45);
  }
  for (let i = 0; i < 160; i++) {
    const x = rnd() * W, y = rnd() * H * 0.55;
    blob(x, y, 2 + rnd() * 5, 'rgba(255,255,255,ALPHA)', 0.5 + rnd() * 0.5);
  }
  ctx.globalCompositeOperation = 'source-over';

  const tex = new THREE.CanvasTexture(cv);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;

  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const envRT = pmrem.fromEquirectangular(tex);
  pmrem.dispose();
  tex.dispose();
  return envRT.texture;
}

/** Lazily builds and caches one environment map per album. */
export function envFactory(renderer) {
  const cache = new Map();
  return (theme) => {
    const key = theme && theme.id ? theme.id : 'house';
    if (!cache.has(key)) cache.set(key, buildEnvMap(renderer, theme));
    return cache.get(key);
  };
}

/* ---------------- sky dome ---------------- */
export function buildSky() {
  const geo = new THREE.SphereGeometry(70, 32, 24);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: {
      uTop: { value: new THREE.Color(0x02050f) },
      uMid: { value: new THREE.Color(0x071734) },
      uHorizon: { value: new THREE.Color(0x0e2a52) },
      uGround: { value: new THREE.Color(0x030817) },
      uMorph: { value: 0 },
    },
    vertexShader: `
      varying vec3 vP;
      void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: /* glsl */`
      precision highp float;
      varying vec3 vP;
      uniform vec3 uTop, uMid, uHorizon, uGround;
      uniform float uMorph;
      void main(){
        float h = normalize(vP).y;
        vec3 c = mix(uHorizon, uMid, smoothstep(0.0, 0.42, h));
        c = mix(c, uTop, smoothstep(0.35, 1.0, h));
        c = mix(uGround, c, smoothstep(-0.28, 0.02, h));
        // a faint aurora-like lift behind the tree, stronger in cosmic mode
        float band = exp(-pow((h - 0.1) * 3.4, 2.0));
        c += vec3(0.04, 0.09, 0.17) * band * (0.35 + 1.1 * uMorph);
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'sky';
  const BASE = {
    skyTop: new THREE.Color(0x02050f),
    skyMid: new THREE.Color(0x071734),
    skyHorizon: new THREE.Color(0x0e2a52),
  };
  return {
    mesh,
    setMorph(m) { mat.uniforms.uMorph.value = m; },
    setTheme(from, to, waveY) {
      /* the sky is overhead, so it changes as the wave sets off */
      const w = waveY <= -900 ? 1 : clamp((TREE.height + 2 - waveY) / 2.6);
      const pick = (t, key) => (t.amount ? t[key].clone() : BASE[key].clone());
      mat.uniforms.uTop.value.copy(pick(from, 'skyTop')).lerp(pick(to, 'skyTop'), w);
      mat.uniforms.uMid.value.copy(pick(from, 'skyMid')).lerp(pick(to, 'skyMid'), w);
      mat.uniforms.uHorizon.value.copy(pick(from, 'skyHorizon')).lerp(pick(to, 'skyHorizon'), w);
      return w;
    },
  };
}

/* ---------------- distant stars ---------------- */
export function buildStars() {
  const rnd = makeRng(4242);
  const n = QUALITY.stars;
  const p = new Float32Array(n * 3), s = new Float32Array(n), d = new Float32Array(n);
  const c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    let v;
    do {
      v = new THREE.Vector3(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1);
    } while (v.lengthSq() > 1 || v.lengthSq() < 0.001);
    v.normalize().multiplyScalar(rr(rnd, 38, 62));
    v.y = Math.abs(v.y) * 0.9 - 4;
    p[i * 3] = v.x; p[i * 3 + 1] = v.y; p[i * 3 + 2] = v.z;
    s[i] = Math.pow(rnd(), 2.4) * 0.24 + 0.042;
    d[i] = rnd();
    const col = rnd() < 0.72 ? C.crystal.clone() : (rnd() < 0.6 ? C.ice.clone() : C.champagne.clone());
    c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(p, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(s, 1));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(d, 1));
  geo.setAttribute('aColor', new THREE.BufferAttribute(c, 3));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    uniforms: {
      uTime: { value: 0 }, uScale: { value: 1200 }, uMorph: { value: 0 },
      uTint: { value: new THREE.Color(0xffffff) }, uTintAmt: { value: 0 },
    },
    vertexShader: /* glsl */`
      attribute float aSize; attribute float aSeed; attribute vec3 aColor;
      uniform float uTime, uScale, uMorph, uTintAmt;
      uniform vec3 uTint;
      varying float vB; varying vec3 vC;
      void main(){
        vec4 mv = modelViewMatrix * vec4(position,1.0);
        gl_Position = projectionMatrix * mv;
        float tw = 0.62 + 0.38*sin(uTime*(0.3+aSeed*0.9) + aSeed*31.0);
        vB = tw * (0.75 + 0.5*uMorph);
        vC = mix(aColor, uTint, uTintAmt);
        gl_PointSize = clamp(aSize*(0.7+0.5*tw)*uScale/max(1.0,-mv.z), 0.0, 7.0);
      }`,
    fragmentShader: /* glsl */`
      precision highp float; varying float vB; varying vec3 vC;
      void main(){
        float r = length(gl_PointCoord - vec2(0.5))*2.0;
        if (r > 1.0) discard;
        gl_FragColor = vec4(vC, pow(1.0-r, 2.0)*vB);
      }`,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.renderOrder = -1;
  return {
    points,
    update(t) { mat.uniforms.uTime.value = t; },
    setMorph(m) { mat.uniforms.uMorph.value = m; },
    setScale(s) { mat.uniforms.uScale.value = s; },
    setTheme(from, to, w) {
      const a = from.amount ? from.light2 : WHITE;
      const b = to.amount ? to.light2 : WHITE;
      mat.uniforms.uTint.value.copy(a).lerp(b, w);
      mat.uniforms.uTintAmt.value = lerp(from.amount ? 0.45 : 0, to.amount ? 0.45 : 0, w);
    },
  };
}

/* ---------------- falling snow, in three depths ---------------- */
const WHITE = new THREE.Color(0xffffff);

const SNOW_VERT = /* glsl */`
precision highp float;
attribute float aSize; attribute float aSeed; attribute float aSpeed;
uniform float uTime, uScale, uSpan, uTop, uBottom, uSway;
varying float vB; varying float vSeed;
void main(){
  float h = uTop - uBottom;
  float y = uTop - mod(position.y - uBottom + uTime * aSpeed, h);
  float sw = uSway * (0.4 + aSeed);
  vec3 p = vec3(
    position.x + sin(uTime * (0.25 + aSeed * 0.5) + aSeed * 22.0) * sw,
    y,
    position.z + cos(uTime * (0.2 + aSeed * 0.45) + aSeed * 15.0) * sw
  );
  vec4 mv = modelViewMatrix * vec4(p,1.0);
  gl_Position = projectionMatrix * mv;
  vB = 0.5 + 0.5 * sin(uTime * (0.6 + aSeed) + aSeed * 40.0);
  vSeed = aSeed;
  gl_PointSize = clamp(aSize * uScale / max(0.1, -mv.z), 0.0, 110.0);
}`;

const SNOW_FRAG = /* glsl */`
precision highp float;
varying float vB; varying float vSeed;
uniform float uOpacity; uniform float uSoft; uniform vec3 uColor;
void main(){
  float r = length(gl_PointCoord - vec2(0.5)) * 2.0;
  if (r > 1.0) discard;
  float a = pow(1.0 - r, uSoft);
  gl_FragColor = vec4(uColor * (0.85 + 0.35 * vB), a * uOpacity * (0.6 + 0.5 * vB));
}`;

function snowLayer({ count, span, top, bottom, size, speed, opacity, soft, sway, color, seed }) {
  const rnd = makeRng(seed);
  const p = new Float32Array(count * 3), s = new Float32Array(count);
  const d = new Float32Array(count), v = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    p[i * 3] = rr(rnd, -span, span);
    p[i * 3 + 1] = rr(rnd, bottom, top);
    p[i * 3 + 2] = rr(rnd, -span, span);
    s[i] = rr(rnd, size[0], size[1]);
    d[i] = rnd();
    v[i] = rr(rnd, speed[0], speed[1]);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(p, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(s, 1));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(d, 1));
  geo.setAttribute('aSpeed', new THREE.BufferAttribute(v, 1));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), span * 2.2);
  const mat = new THREE.ShaderMaterial({
    vertexShader: SNOW_VERT, fragmentShader: SNOW_FRAG,
    transparent: true, depthWrite: false, blending: THREE.NormalBlending, fog: false,
    uniforms: {
      uTime: { value: 0 }, uScale: { value: 1200 }, uSpan: { value: span },
      uTop: { value: top }, uBottom: { value: bottom }, uSway: { value: sway },
      uOpacity: { value: opacity }, uSoft: { value: soft },
      uColor: { value: new THREE.Color(color) },
    },
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  return { points, mat };
}

export function buildSnowfall() {
  const base = QUALITY.snow;
  const layers = [
    snowLayer({ count: Math.round(base * 0.5), span: 14, top: 18, bottom: -1, size: [0.012, 0.030],
      speed: [0.5, 1.1], opacity: 0.5, soft: 1.9, sway: 0.4, color: 0xdceaff, seed: 1 }),
    snowLayer({ count: Math.round(base * 0.34), span: 10, top: 16, bottom: -1, size: [0.028, 0.062],
      speed: [0.9, 1.7], opacity: 0.55, soft: 1.7, sway: 0.55, color: 0xeaf3ff, seed: 2 }),
    snowLayer({ count: Math.round(base * 0.16), span: 22, top: 22, bottom: -2, size: [0.008, 0.019],
      speed: [0.3, 0.6], opacity: 0.32, soft: 2.4, sway: 0.3, color: 0xa8c8ee, seed: 3 }),
  ];
  // a very close, very soft layer that rides with the camera
  const near = snowLayer({ count: Math.round(base * 0.05), span: 4.2, top: 5, bottom: -5,
    size: [0.18, 0.52], speed: [0.5, 1.2], opacity: 0.07, soft: 1.3, sway: 0.5, color: 0xf2f8ff, seed: 4 });
  const nearGroup = new THREE.Group();
  nearGroup.add(near.points);

  const group = new THREE.Group();
  group.name = 'snowfall';
  layers.forEach((l) => group.add(l.points));

  return {
    group, nearGroup,
    update(t, camera) {
      layers.forEach((l) => { l.mat.uniforms.uTime.value = t; });
      near.mat.uniforms.uTime.value = t;
      nearGroup.position.copy(camera.position);
    },
    setScale(s) {
      layers.forEach((l) => { l.mat.uniforms.uScale.value = s; });
      near.mat.uniforms.uScale.value = s;
    },
    setMorph(m) {
      layers[0].mat.uniforms.uOpacity.value = lerp(0.55, 0.42, m);
      layers[1].mat.uniforms.uOpacity.value = lerp(0.6, 0.48, m);
    },
  };
}

/* ---------------- atmospheric mist ---------------- */
export function buildMist() {
  const rnd = makeRng(515);
  const group = new THREE.Group();
  group.name = 'mist';
  const tex = softSprite(256, 1, 1.35, 0.0);
  const items = [];
  for (let i = 0; i < 7; i++) {
    const m = new THREE.SpriteMaterial({
      map: tex, color: i % 3 === 0 ? 0x2f5f9e : 0x18365f,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      opacity: rr(rnd, 0.07, 0.17), fog: false,
    });
    const s = new THREE.Sprite(m);
    const a = rnd() * Math.PI * 2;
    const r = rr(rnd, 1.5, 7);
    s.position.set(Math.cos(a) * r, rr(rnd, 0.1, 1.9), Math.sin(a) * r);
    const sc = rr(rnd, 5, 12);
    s.scale.set(sc, sc * rr(rnd, 0.35, 0.6), 1);
    group.add(s);
    items.push({ s, m, a, r, speed: rr(rnd, -0.035, 0.035), base: m.opacity, phase: rnd() * 6.28 });
  }
  let cosmic = 0;
  let themeCols = null;
  function applyColors() {
    items.forEach((it, i) => {
      const base = themeCols
        ? themeCols[i]
        : new THREE.Color(cosmic > 0.5 ? 0x24518c : (i % 3 === 0 ? 0x2f5f9e : 0x18365f));
      it.m.color.copy(base);
    });
  }

  return {
    group,
    update(t) {
      for (const it of items) {
        const a = it.a + t * it.speed;
        it.s.position.x = Math.cos(a) * it.r;
        it.s.position.z = Math.sin(a) * it.r;
        it.m.opacity = it.base * (0.6 + 0.4 * Math.sin(t * 0.25 + it.phase));
      }
    },
    setMorph(m) { cosmic = m; applyColors(); },
    setTheme(from, to, w) {
      const pick = (t, i) => (t.amount
        ? (i % 3 === 0 ? t.glass.clone() : t.deep.clone().lerp(t.glass, 0.5))
        : new THREE.Color(i % 3 === 0 ? 0x2f5f9e : 0x18365f));
      themeCols = items.map((_, i) => pick(from, i).lerp(pick(to, i), w));
      applyColors();
    },
    setEffects(on) { group.visible = on; },
  };
}

/* ---------------- shooting stars ---------------- */
export function buildShootingStars() {
  const rnd = makeRng(808);
  const N = 36;
  const p = new Float32Array(N * 3), s = new Float32Array(N);
  for (let i = 0; i < N; i++) s[i] = (1 - i / N) * 0.085 + 0.012;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(p, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(s, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    uniforms: { uScale: { value: 1200 }, uOpacity: { value: 0 }, uColor: { value: new THREE.Color(0xeaf6ff) } },
    vertexShader: `
      attribute float aSize; uniform float uScale; varying float vF;
      void main(){
        vec4 mv = modelViewMatrix * vec4(position,1.0);
        gl_Position = projectionMatrix * mv;
        vF = aSize / 0.097;
        gl_PointSize = clamp(aSize*uScale/max(1.0,-mv.z), 0.0, 34.0);
      }`,
    fragmentShader: `
      precision highp float; varying float vF;
      uniform float uOpacity; uniform vec3 uColor;
      void main(){
        float r = length(gl_PointCoord - vec2(0.5))*2.0;
        if (r > 1.0) discard;
        gl_FragColor = vec4(uColor, pow(1.0-r,2.0)*uOpacity*pow(vF,1.4));
      }`,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;

  let timer = rr(rnd, 3, 8);
  let active = -1;
  let from = new THREE.Vector3(), dir = new THREE.Vector3();

  return {
    points,
    update(t, dt) {
      if (active < 0) {
        timer -= dt;
        if (timer <= 0) {
          active = 0;
          const a = rnd() * Math.PI * 2;
          const r = rr(rnd, 28, 46);
          from.set(Math.cos(a) * r, rr(rnd, 14, 30), Math.sin(a) * r);
          dir.set(rr(rnd, -1, 1), rr(rnd, -0.55, -0.12), rr(rnd, -1, 1)).normalize().multiplyScalar(rr(rnd, 26, 44));
          timer = rr(rnd, 9, 26);
        }
      } else {
        active += dt;
        const T = 1.5;
        const u = clamp(active / T);
        mat.uniforms.uOpacity.value = Math.sin(Math.PI * u) * 0.95;
        for (let i = 0; i < N; i++) {
          const lag = (i / N) * 0.1;
          const uu = clamp(u - lag);
          p[i * 3] = from.x + dir.x * uu;
          p[i * 3 + 1] = from.y + dir.y * uu;
          p[i * 3 + 2] = from.z + dir.z * uu;
        }
        geo.attributes.position.needsUpdate = true;
        if (u >= 1) { active = -1; mat.uniforms.uOpacity.value = 0; }
      }
    },
    setScale(s) { mat.uniforms.uScale.value = s; },
    setEffects(on) { points.visible = on; },
  };
}
