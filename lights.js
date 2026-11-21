import * as THREE from 'three';
import { TREE, QUALITY, radiusAt } from './config.js';
import { C, pickLightColor } from './palette.js';
import { makeRng, lerp, clamp, rr } from './utils.js';

/* ------------------------------------------------------------------
   Christmas fairy lights: thousands of individual points threaded
   along garland strands that spiral the tree, plus a scattering on
   the branch tips. Each one twinkles on its own clock, and a slow
   wave of illumination travels along the strands now and then.
   ------------------------------------------------------------------ */

const VERT = /* glsl */`
precision highp float;
attribute float aSize;
attribute float aSeed;
attribute float aRate;
attribute float aStrandT;
attribute float aWarm;
attribute vec3  aColor;
attribute vec3  aTarget;

uniform float uTime;
uniform float uMorph;
uniform float uScale;
uniform float uIntensity;
uniform float uWave;
uniform float uBurst;
uniform float uHeight;

/* album recolouring, with the same downward wave as the foliage */
uniform vec3  uWarmA; uniform vec3 uCoolA; uniform float uAmtA;
uniform vec3  uWarmB; uniform vec3 uCoolB; uniform float uAmtB;
uniform float uWaveY;
uniform float uCharge;

varying vec3  vColor;
varying float vBright;

void main() {
  float hN = clamp(position.y / uHeight, 0.0, 1.0);

  /* lights intensify first, then travel to the cosmic shell */
  float drift = clamp((uMorph - 0.12) / 0.75, 0.0, 1.0);
  drift = drift * drift * (3.0 - 2.0 * drift);
  vec3 p = mix(position, aTarget, drift);

  float ang = drift * (0.5 + aSeed * 0.9) + uTime * 0.04 * drift;
  float ca = cos(ang), sa = sin(ang);
  p = vec3(p.x * ca - p.z * sa, p.y + sin(uTime * 0.5 + aSeed * 9.0) * 0.05 * drift, p.x * sa + p.z * ca);

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;

  /* --- twinkle: every bulb on its own clock --- */
  float tw = 0.56 + 0.44 * sin(uTime * aRate + aSeed * 6.2831);
  float sparkle = pow(max(0.0, sin(uTime * (0.4 + aRate * 0.7) + aSeed * 21.0)), 14.0);
  float base = 0.42 + 0.58 * fract(aSeed * 7.13);

  /* --- travelling illumination along the strand --- */
  float ph = fract(aStrandT - uTime * 0.055);
  float pulse = exp(-pow(ph * 11.0, 2.0)) + exp(-pow((1.0 - ph) * 11.0, 2.0));
  pulse *= uWave;

  /* --- wave released by the star --- */
  float burst = uBurst > 0.001
    ? exp(-pow((hN - (1.0 - uBurst * 1.3)) * 6.0, 2.0)) * uBurst : 0.0;

  float bright = base * tw + sparkle * 0.85 + pulse * 0.9 + burst * 1.6;
  bright *= uIntensity * (1.0 + 0.45 * uMorph);

  float wv = uWaveY <= -900.0 ? 1.0 : smoothstep(uWaveY - 0.9, uWaveY + 0.9, position.y);
  vec3 cA = mix(aColor, mix(uCoolA, uWarmA, aWarm), uAmtA);
  vec3 cB = mix(aColor, mix(uCoolB, uWarmB, aWarm), uAmtB);

  float front = uWaveY <= -900.0 ? 0.0 : exp(-pow((position.y - uWaveY) * 1.6, 2.0));
  bright += front * 2.2;

  if (uCharge > 0.0005) {
    float cy = uCharge * (uHeight + 0.6);
    float below = smoothstep(cy + 0.8, cy - 0.8, position.y);
    float band = exp(-pow((position.y - cy) * 1.5, 2.0));
    bright += below * 0.55 * uCharge + band * 2.4;
  }

  vBright = bright;
  vColor = mix(cA, cB, wv);

  float size = aSize * (0.82 + 0.5 * bright) * (1.0 + 0.2 * uMorph);
  gl_PointSize = clamp(size * uScale / max(0.1, -mv.z), 0.0, 64.0);
}
`;

const FRAG = /* glsl */`
precision highp float;
varying vec3  vColor;
varying float vBright;
uniform float uOpacity;

void main() {
  vec2 d = gl_PointCoord - vec2(0.5);
  float r = length(d) * 2.0;
  if (r > 1.0) discard;
  float halo = pow(1.0 - r, 2.6);
  float core = smoothstep(0.42, 0.0, r);
  float bokeh = smoothstep(0.98, 0.80, r) * 0.1;       // faint bokeh rim
  float a = (halo * 0.85 + core * 0.9 + bokeh) * uOpacity;
  vec3 col = vColor * (0.55 + 1.25 * vBright) + vec3(core) * vBright * 0.55;
  gl_FragColor = vec4(col, a * clamp(0.25 + vBright, 0.0, 1.6));
}
`;

export function buildFairyLights(tree) {
  const rnd = makeRng(TREE.seed + 77);
  const total = QUALITY.fairyLights;
  const onStrands = Math.round(total * 0.74);
  const onTips = total - onStrands;

  const pos = [], col = [], size = [], seed = [], rate = [], strandT = [], tgt = [], warmth = [];
  const STRANDS = 6;
  const yBottom = 1.25, yTop = TREE.height * 0.955;

  const push = (p, sT) => {
    pos.push(p.x, p.y, p.z);
    const c = pickLightColor(rnd);
    col.push(c.r, c.g, c.b);
    warmth.push(clamp((c.r - c.b) * 2.6 + 0.5));
    size.push(rr(rnd, 0.030, 0.072));
    seed.push(rnd());
    rate.push(rr(rnd, 0.35, 1.5));
    strandT.push(sT);
    const R = radiusAt(p.y);
    const r = Math.hypot(p.x, p.z) || 1e-4;
    const k = lerp(r, R * rr(rnd, 0.92, 1.06), 0.7);
    tgt.push(p.x / r * k, p.y + rr(rnd, -0.1, 0.1), p.z / r * k);
  };

  /* --- garland strands spiralling the tree --- */
  const perStrand = Math.ceil(onStrands / STRANDS);
  for (let s = 0; s < STRANDS; s++) {
    const a0 = (s / STRANDS) * Math.PI * 2 + rr(rnd, -0.3, 0.3);
    const turns = rr(rnd, 5.0, 6.2);
    const dir = s % 2 === 0 ? 1 : -1;
    for (let i = 0; i < perStrand; i++) {
      const u = i / (perStrand - 1);
      const y = lerp(yBottom, yTop, Math.pow(u, 0.94)) + rr(rnd, -0.07, 0.07);
      const a = a0 + dir * u * turns * Math.PI * 2;
      // the strand sags between branches
      const sag = Math.sin(u * turns * Math.PI * 2 * 1.0) * 0.045;
      const R = radiusAt(y + sag) * rr(rnd, 0.82, 1.0);
      push(new THREE.Vector3(Math.cos(a) * R, y + sag, Math.sin(a) * R), u);
    }
  }

  /* --- a scattering out on the branch tips --- */
  const tips = tree.branches.filter((b) => b.length > TREE.baseRadius * 0.3);
  for (let i = 0; i < onTips; i++) {
    const b = tips[(rnd() * tips.length) | 0];
    const useTwig = b.twigs.length && rnd() < 0.55;
    const curve = useTwig ? b.twigs[(rnd() * b.twigs.length) | 0].curve : b.curve;
    const p = curve.getPointAt(rr(rnd, 0.72, 0.99));
    p.y -= rr(rnd, 0.0, 0.05);
    push(p, rnd());
  }

  const count = size.length;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('aColor', new THREE.Float32BufferAttribute(col, 3));
  geo.setAttribute('aWarm', new THREE.Float32BufferAttribute(warmth, 1));
  geo.setAttribute('aSize', new THREE.Float32BufferAttribute(size, 1));
  geo.setAttribute('aSeed', new THREE.Float32BufferAttribute(seed, 1));
  geo.setAttribute('aRate', new THREE.Float32BufferAttribute(rate, 1));
  geo.setAttribute('aStrandT', new THREE.Float32BufferAttribute(strandT, 1));
  geo.setAttribute('aTarget', new THREE.Float32BufferAttribute(tgt, 3));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, TREE.height * 0.5, 0), TREE.height);

  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG,
    transparent: true, depthWrite: false, depthTest: true,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 }, uMorph: { value: 0 }, uScale: { value: 1200 },
      uIntensity: { value: 1 }, uWave: { value: 0 }, uBurst: { value: 0 },
      uHeight: { value: TREE.height }, uOpacity: { value: 1 },
      uWarmA: { value: new THREE.Color(0xffe6bd) }, uCoolA: { value: new THREE.Color(0xa8dfff) }, uAmtA: { value: 0 },
      uWarmB: { value: new THREE.Color(0xffe6bd) }, uCoolB: { value: new THREE.Color(0xa8dfff) }, uAmtB: { value: 0 },
      uWaveY: { value: -999 },
      uCharge: { value: 0 },
    },
  });

  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.renderOrder = 3;
  points.name = 'fairy-lights';

  /* --- a handful of real point lights so the glow spills onto
         the branches, the baubles and the snow --- */
  const spill = [];
  const SPILLS = QUALITY.tier === 'low' ? 4 : 6;
  for (let i = 0; i < SPILLS; i++) {
    const u = (i + 0.5) / SPILLS;
    const y = lerp(1.1, TREE.height * 0.9, u);
    const a = u * Math.PI * 2 * 1.7 + 0.5;
    const R = radiusAt(y) * 0.8;
    const warm = i % 2 === 0;
    const light = new THREE.PointLight(warm ? 0xffd9a0 : 0x9fd8ff, 2.6, 5.2, 2);
    light.position.set(Math.cos(a) * R, y, Math.sin(a) * R);
    light.userData = { base: 2.6, phase: rnd() * 6.28, rate: rr(rnd, 0.4, 0.9) };
    spill.push(light);
  }

  const spillPos = new Array(8).fill(0).map(() => new THREE.Vector3());
  const spillCol = new Array(8).fill(0).map(() => new THREE.Color(0, 0, 0));
  const spillInt = new Float32Array(8);
  spill.forEach((l, i) => {
    spillPos[i].copy(l.position);
    spillCol[i].copy(l.color);
  });

  let waveTimer = rr(rnd, 4, 10);
  let waveAmp = 0;
  let waveTarget = 0;

  return {
    points, spill, spillPos, spillCol, spillInt,
    update(time, dt) {
      mat.uniforms.uTime.value = time;
      // occasional travelling sequences rather than constant chasing
      waveTimer -= dt;
      if (waveTimer <= 0) {
        waveTarget = waveTarget > 0.1 ? 0 : rr(rnd, 0.5, 0.95);
        waveTimer = waveTarget > 0.1 ? rr(rnd, 5, 9) : rr(rnd, 7, 16);
      }
      waveAmp += (waveTarget - waveAmp) * Math.min(1, dt * 0.9);
      mat.uniforms.uWave.value = waveAmp;

      for (let i = 0; i < spill.length; i++) {
        const l = spill[i];
        const f = 0.6 + 0.4 * Math.sin(time * l.userData.rate + l.userData.phase);
        l.intensity = l.userData.base * f * (1 + mat.uniforms.uMorph.value * 0.6);
        spillInt[i] = 0.055 * f * (1 + mat.uniforms.uMorph.value * 1.2);
      }
    },
    setMorph(m) { mat.uniforms.uMorph.value = m; },
    setBurst(v) { mat.uniforms.uBurst.value = v; },
    setCharge(v) { mat.uniforms.uCharge.value = v; },
    setIntensity(v) { mat.uniforms.uIntensity.value = v; },
    setScale(s) { mat.uniforms.uScale.value = s; },
    setTheme(from, to, waveY) {
      const u = mat.uniforms;
      u.uWarmA.value.copy(from.light1); u.uCoolA.value.copy(from.light2); u.uAmtA.value = from.amount ? 0.85 : 0;
      u.uWarmB.value.copy(to.light1);   u.uCoolB.value.copy(to.light2);   u.uAmtB.value = to.amount ? 0.85 : 0;
      u.uWaveY.value = waveY;
      /* the real point lights follow the new palette too */
      spill.forEach((l, i) => {
        const t = to.amount ? to : from;
        const warm = i % 2 === 0;
        l.color.copy(to.amount || from.amount
          ? (warm ? t.light1 : t.light2)
          : new THREE.Color(warm ? 0xffd9a0 : 0x9fd8ff));
        spillCol[i].copy(l.color);
      });
    },
  };
}
