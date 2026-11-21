import * as THREE from 'three';

/** Deterministic RNG so the tree is the same beautiful tree every night. */
export function makeRng(seed = 20251224) {
  let a = seed >>> 0;
  return function rnd() {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
export const smoothstep = (t) => { t = clamp(t); return t * t * (3 - 2 * t); };
export const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
export const rr = (rnd, a, b) => a + (b - a) * rnd();

/** How far a point at height `y` has been converted by a colour wave
 *  travelling downwards through the tree. waveY = -Infinity means done. */
export const waveAmount = (y, waveY) =>
  (waveY <= -900 ? 1 : smoothstep((y - (waveY - 0.9)) / 1.8));

/** Cheap value noise, good enough for drift and twinkle. */
export function hash3(x, y, z) {
  let h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return h - Math.floor(h);
}

/** Build a tapered tube along a curve (TubeGeometry cannot taper). */
export function taperedTube(curve, tubularSegments, radialSegments, r0, r1, power = 1) {
  const frames = curve.computeFrenetFrames(tubularSegments, false);
  const pos = [], nor = [], uv = [], idx = [];
  const P = new THREE.Vector3(), N = new THREE.Vector3(), B = new THREE.Vector3();
  const v = new THREE.Vector3();

  for (let i = 0; i <= tubularSegments; i++) {
    const t = i / tubularSegments;
    curve.getPointAt(Math.min(t, 1), P);
    N.copy(frames.normals[i]); B.copy(frames.binormals[i]);
    const r = Math.max(0.0006, r0 + (r1 - r0) * Math.pow(t, power));
    for (let j = 0; j <= radialSegments; j++) {
      const a = (j / radialSegments) * Math.PI * 2;
      const sx = Math.cos(a), sy = Math.sin(a);
      v.set(N.x * sx + B.x * sy, N.y * sx + B.y * sy, N.z * sx + B.z * sy);
      pos.push(P.x + v.x * r, P.y + v.y * r, P.z + v.z * r);
      nor.push(v.x, v.y, v.z);
      uv.push(j / radialSegments, t);
    }
  }
  const stride = radialSegments + 1;
  for (let i = 0; i < tubularSegments; i++) {
    for (let j = 0; j < radialSegments; j++) {
      const a = i * stride + j, b = a + stride, c = b + 1, d = a + 1;
      idx.push(a, b, d, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

/** Radial-gradient sprite used by lights, snow and glows. */
export function softSprite(size = 64, inner = 1, falloff = 2.2, core = 0.14) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(size, size);
  const h = (size - 1) / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x - h) / h, dy = (y - h) / h;
      const d = Math.sqrt(dx * dx + dy * dy);
      let a = Math.max(0, 1 - d);
      a = Math.pow(a, falloff) * inner;
      if (d < core) a = Math.max(a, 1 - (d / core) * 0.12);
      const i = (y * size + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      img.data[i + 3] = Math.min(255, a * 255) | 0;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Six-armed snowflake texture, drawn procedurally. */
export function snowflakeTexture(size = 128, seed = 7) {
  const rnd = makeRng(seed);
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, size, size);
  ctx.translate(size / 2, size / 2);
  ctx.strokeStyle = '#ffffff';
  ctx.lineCap = 'round';
  const R = size * 0.44;
  const arms = 6;
  const spurs = [];
  const n = 3 + Math.floor(rnd() * 2);
  for (let i = 0; i < n; i++) spurs.push({ at: 0.3 + (i / n) * 0.6, len: rr(rnd, 0.14, 0.3), ang: rr(rnd, 0.5, 0.85) });
  for (let a = 0; a < arms; a++) {
    ctx.save();
    ctx.rotate((a / arms) * Math.PI * 2);
    ctx.lineWidth = size * 0.028;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -R); ctx.stroke();
    ctx.lineWidth = size * 0.019;
    for (const s of spurs) {
      const y = -R * s.at, l = R * s.len;
      ctx.beginPath();
      ctx.moveTo(0, y); ctx.lineTo(Math.sin(s.ang) * l, y - Math.cos(s.ang) * l);
      ctx.moveTo(0, y); ctx.lineTo(-Math.sin(s.ang) * l, y - Math.cos(s.ang) * l);
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(0, 0, size * 0.045, 0, Math.PI * 2); ctx.fill();
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function disposeDeep(obj) {
  obj.traverse?.((o) => {
    o.geometry?.dispose?.();
    const m = o.material;
    if (Array.isArray(m)) m.forEach((x) => x.dispose?.()); else m?.dispose?.();
  });
}
