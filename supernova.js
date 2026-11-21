import * as THREE from 'three';
import { TREE, QUALITY, radiusAt } from './config.js';
import { makeRng, lerp, clamp, rr, easeOutCubic, smoothstep } from './utils.js';

/* ------------------------------------------------------------------
   The tree breaking open.

   Every particle starts on the tree's own shell, flies outward, then
   gathers onto a single thread hung across the view — the thread the
   picture wall hangs from. Closing the wall sends them home again.
   ------------------------------------------------------------------ */

const VERT = /* glsl */`
precision highp float;
attribute float aSize;
attribute float aSeed;
attribute vec3 aColor;
uniform float uScale, uTime, uBright;
varying vec3 vCol; varying float vB;
void main(){
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  float tw = 0.55 + 0.45 * sin(uTime * (0.8 + aSeed * 2.2) + aSeed * 30.0);
  vB = tw * uBright;
  vCol = aColor;
  gl_PointSize = clamp(aSize * (0.6 + 0.8 * tw) * uScale / max(0.2, -mv.z), 0.0, 70.0);
}`;

const FRAG = /* glsl */`
precision highp float;
varying vec3 vCol; varying float vB;
uniform float uOpacity;
void main(){
  float r = length(gl_PointCoord - vec2(0.5)) * 2.0;
  if (r > 1.0) discard;
  float a = pow(1.0 - r, 2.2);
  gl_FragColor = vec4(vCol * (0.7 + 1.6 * vB), a * uOpacity * clamp(vB, 0.0, 1.5));
}`;

export function buildSupernova() {
  const rnd = makeRng(2512);
  const N = QUALITY.tier === 'low' ? 900 : QUALITY.tier === 'mid' ? 1500 : 2100;

  const pos = new Float32Array(N * 3);
  const col = new Float32Array(N * 3);
  const size = new Float32Array(N);
  const seed = new Float32Array(N);

  const home = [];      // where each particle sits on the tree
  const vel = [];       // its outward kick
  const blown = [];     // where the explosion leaves it
  const target = [];    // its place on the thread

  for (let i = 0; i < N; i++) {
    const u = Math.pow(rnd(), 0.75);
    const y = lerp(0.9, TREE.height * 0.98, u);
    const a = rnd() * Math.PI * 2;
    const r = radiusAt(y) * rr(rnd, 0.35, 1.02);
    const p = new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r);
    home.push(p);
    const out = new THREE.Vector3(p.x, 0, p.z).normalize();
    vel.push(out.multiplyScalar(rr(rnd, 6, 17))
      .add(new THREE.Vector3(rr(rnd, -3, 3), rr(rnd, 1.5, 9), rr(rnd, -3, 3))));
    blown.push(new THREE.Vector3());
    target.push(new THREE.Vector3());
    size[i] = rr(rnd, 0.018, 0.058);
    seed[i] = rnd();
    const c = new THREE.Color(0xffffff);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));

  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    uniforms: {
      uScale: { value: 1200 }, uTime: { value: 0 },
      uOpacity: { value: 0 }, uBright: { value: 1 },
    },
  });

  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.renderOrder = 8;
  points.visible = false;

  /* out -> form -> hold -> home */
  let phase = 'idle';
  let t = 0;
  const OUT = 0.85, FORM = 1.25, HOME = 1.1;

  const fwd = new THREE.Vector3(), right = new THREE.Vector3(), up = new THREE.Vector3();
  const tmp = new THREE.Vector3();

  /** Lay the thread across the camera's view, so it reads as one line. */
  function planThread(camera) {
    camera.getWorldDirection(fwd);
    right.set(1, 0, 0).applyQuaternion(camera.quaternion).normalize();
    up.set(0, 1, 0).applyQuaternion(camera.quaternion).normalize();

    const dist = 15;
    const centre = camera.position.clone().addScaledVector(fwd, dist);
    const vertical = window.innerWidth <= 760;
    const axis = vertical ? up : right;
    const cross = vertical ? right : up;
    const half = vertical ? 13 : 21;
    if (vertical) centre.addScaledVector(right, -3.2);

    for (let i = 0; i < N; i++) {
      const s = (i / (N - 1)) * 2 - 1;
      target[i].copy(centre)
        .addScaledVector(axis, s * half + rr(rnd, -0.35, 0.35))
        .addScaledVector(cross, rr(rnd, -0.5, 0.5) * (0.35 + Math.abs(s) * 0.5))
        .addScaledVector(fwd, rr(rnd, -1.2, 1.2));
    }
  }

  function setColor(color) {
    const c = color || new THREE.Color(0xa8dfff);
    for (let i = 0; i < N; i++) {
      tmp.set(c.r, c.g, c.b);
      const k = Math.pow(rnd(), 2);
      col[i * 3] = lerp(tmp.x, 1, k);
      col[i * 3 + 1] = lerp(tmp.y, 1, k);
      col[i * 3 + 2] = lerp(tmp.z, 1, k);
    }
    geo.attributes.aColor.needsUpdate = true;
  }

  function burst(camera, color) {
    setColor(color);
    planThread(camera);
    for (let i = 0; i < N; i++) blown[i].copy(home[i]).add(vel[i]);
    phase = 'out';
    t = 0;
    points.visible = true;
    mat.uniforms.uOpacity.value = 1;
  }

  function sendHome() {
    if (phase === 'idle') return;
    phase = 'home';
    t = 0;
  }

  function update(time, dt) {
    mat.uniforms.uTime.value = time;
    if (phase === 'idle') return;
    t += dt;

    if (phase === 'out') {
      const u = clamp(t / OUT);
      const e = easeOutCubic(u);
      for (let i = 0; i < N; i++) {
        const h = home[i], b = blown[i];
        pos[i * 3] = lerp(h.x, b.x, e);
        pos[i * 3 + 1] = lerp(h.y, b.y, e) - 2.2 * e * e;
        pos[i * 3 + 2] = lerp(h.z, b.z, e);
      }
      mat.uniforms.uBright.value = 1 + (1 - u) * 2.4;
      if (u >= 1) { phase = 'form'; t = 0; }
    } else if (phase === 'form') {
      const u = clamp(t / FORM);
      const e = smoothstep(u);
      for (let i = 0; i < N; i++) {
        const b = blown[i], g = target[i];
        pos[i * 3] = lerp(b.x, g.x, e);
        pos[i * 3 + 1] = lerp(b.y - 2.2, g.y, e);
        pos[i * 3 + 2] = lerp(b.z, g.z, e);
      }
      mat.uniforms.uBright.value = 1 + (1 - u) * 0.6;
      if (u >= 1) { phase = 'hold'; t = 0; }
    } else if (phase === 'hold') {
      for (let i = 0; i < N; i++) {
        const g = target[i];
        const w = Math.sin(time * 0.7 + seed[i] * 24) * 0.1;
        pos[i * 3] = g.x + up.x * w;
        pos[i * 3 + 1] = g.y + up.y * w;
        pos[i * 3 + 2] = g.z + up.z * w;
      }
      mat.uniforms.uBright.value = 1;
    } else if (phase === 'home') {
      const u = clamp(t / HOME);
      const e = smoothstep(u);
      for (let i = 0; i < N; i++) {
        const g = target[i], h = home[i];
        pos[i * 3] = lerp(g.x, h.x, e);
        pos[i * 3 + 1] = lerp(g.y, h.y, e);
        pos[i * 3 + 2] = lerp(g.z, h.z, e);
      }
      mat.uniforms.uOpacity.value = 1 - e;
      if (u >= 1) { phase = 'idle'; points.visible = false; mat.uniforms.uOpacity.value = 0; }
    }
    geo.attributes.position.needsUpdate = true;
  }

  return {
    points, burst, sendHome, update,
    replan(camera) { if (phase === 'hold' || phase === 'form') planThread(camera); },
    isActive: () => phase !== 'idle',
    setScale(s) { mat.uniforms.uScale.value = s; },
  };
}
