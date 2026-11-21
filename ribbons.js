import * as THREE from 'three';
import { TREE, QUALITY, radiusAt } from './config.js';
import { C } from './palette.js';
import { makeRng, lerp, clamp, rr, waveAmount, softSprite } from './utils.js';

/* ------------------------------------------------------------------
   Ribbons and garlands. The main spiral ribbon lies ON the branches:
   it is a real strip of satin with width, twist and a little ruffle,
   wrapped from the base to the top. In cosmic mode the strip fades
   while a luminous trail of particles sampled from the SAME path
   takes over, so the spiral never leaves the tree.
   ------------------------------------------------------------------ */

function ribbonPath(rnd, { turns, y0, y1, radiusScale, phase, dir = 1, samples = 420 }) {
  const pts = [];
  for (let i = 0; i <= samples; i++) {
    const u = i / samples;
    const y = lerp(y0, y1, Math.pow(u, 0.97));
    const a = phase + dir * u * turns * Math.PI * 2;
    const sag = Math.sin(u * turns * Math.PI * 2) * 0.03;
    const R = radiusAt(y) * radiusScale + 0.045;
    pts.push({
      u,
      p: new THREE.Vector3(Math.cos(a) * R, y + sag, Math.sin(a) * R),
      out: new THREE.Vector3(Math.cos(a), 0.22, Math.sin(a)).normalize(),
    });
  }
  return pts;
}

function ribbonGeometry(path, widthAt, twistAmp, ruffle, twistBase = 0.3, twistFreq = 13.0) {
  const pos = [], nor = [], uv = [], idx = [];
  const T = new THREE.Vector3(), W = new THREE.Vector3(), N = new THREE.Vector3();
  const tmp = new THREE.Vector3();

  for (let i = 0; i < path.length; i++) {
    const a = path[Math.max(0, i - 1)].p, b = path[Math.min(path.length - 1, i + 1)].p;
    T.subVectors(b, a).normalize();
    const out = path[i].out;
    W.crossVectors(T, out).normalize();            // across the ribbon, flat on the cone
    const twist = twistBase + Math.sin(path[i].u * twistFreq) * twistAmp;
    W.applyAxisAngle(T, twist).normalize();
    N.crossVectors(W, T).normalize();

    const w = widthAt(path[i].u) * 0.5;
    const puff = Math.sin(path[i].u * 58.0) * ruffle;
    for (let s = -1; s <= 1; s += 2) {
      tmp.copy(path[i].p).addScaledVector(W, w * s).addScaledVector(N, puff * (1 - Math.abs(s) * 0.0));
      pos.push(tmp.x, tmp.y, tmp.z);
      nor.push(N.x, N.y, N.z);
      uv.push((s + 1) * 0.5, path[i].u * 30);
    }
  }
  for (let i = 0; i < path.length - 1; i++) {
    const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
    idx.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

export function buildRibbons() {
  const rnd = makeRng(TREE.seed + 303);
  const group = new THREE.Group();
  group.name = 'ribbons';

  const satin = new THREE.MeshPhysicalMaterial({
    color: 0xd6e2f2, roughness: 0.32, metalness: 0.22,
    sheen: 1, sheenColor: new THREE.Color(0xf0f8ff), sheenRoughness: 0.28,
    clearcoat: 0.45, clearcoatRoughness: 0.2,
    envMapIntensity: 1.5, side: THREE.DoubleSide,
    transparent: true,
  });
  const midnight = new THREE.MeshPhysicalMaterial({
    color: 0x0c2450, roughness: 0.28, metalness: 0.3,
    sheen: 1, sheenColor: new THREE.Color(0x5a9ae4), sheenRoughness: 0.35,
    clearcoat: 0.6, clearcoatRoughness: 0.15,
    envMapIntensity: 1.7, side: THREE.DoubleSide,
    transparent: true,
  });

  /* --- the main silver satin spiral, bottom to top --- */
  const mainPath = ribbonPath(rnd, {
    turns: 5.4, y0: 1.75, y1: TREE.height * 0.9, radiusScale: 0.95, phase: 0.4, dir: 1,
  });
  const mainGeo = ribbonGeometry(mainPath, (u) => lerp(0.23, 0.09, Math.pow(u, 0.8)), 0.95, 0.016, 0.35, 11.0);
  const mainRibbon = new THREE.Mesh(mainGeo, satin);
  group.add(mainRibbon);

  /* --- a midnight-blue counter-spiral --- */
  const altPath = ribbonPath(rnd, {
    turns: 4.3, y0: 2.1, y1: TREE.height * 0.84, radiusScale: 0.91, phase: 3.1, dir: -1,
  });
  const altGeo = ribbonGeometry(altPath, (u) => lerp(0.145, 0.06, Math.pow(u, 0.8)), 1.1, 0.012, 0.55, 9.0);
  const altRibbon = new THREE.Mesh(altGeo, midnight);
  group.add(altRibbon);

  /* --- delicate beaded metallic garland --- */
  const garlandPath = ribbonPath(rnd, {
    turns: 5.8, y0: 1.35, y1: TREE.height * 0.88, radiusScale: 0.97, phase: 1.9, dir: 1, samples: 260,
  });
  const beadGeo = new THREE.SphereGeometry(1, 8, 6);
  const beadMat = new THREE.MeshPhysicalMaterial({
    color: 0xe7eef8, metalness: 1, roughness: 0.18, envMapIntensity: 2.2, transparent: true,
  });
  const beadCount = QUALITY.tier === 'low' ? 180 : 300;
  const beads = new THREE.InstancedMesh(beadGeo, beadMat, beadCount);
  {
    const o = new THREE.Object3D();
    for (let i = 0; i < beadCount; i++) {
      const g = garlandPath[Math.min(garlandPath.length - 1, Math.floor((i / beadCount) * garlandPath.length))];
      const drop = 0.03 + 0.03 * Math.abs(Math.sin(i * 0.9));
      o.position.copy(g.p).add(new THREE.Vector3(0, -drop, 0));
      const s = (i % 7 === 0 ? 0.042 : 0.026) * rr(rnd, 0.85, 1.2);
      o.scale.setScalar(s);
      o.rotation.set(rnd() * 6, rnd() * 6, rnd() * 6);
      o.updateMatrix();
      beads.setMatrixAt(i, o.matrix);
    }
    beads.instanceMatrix.needsUpdate = true;
    beads.computeBoundingSphere();
  }
  group.add(beads);

  /* --- sparkling trails sampled from the same ribbon paths --- */
  const trailPaths = [mainPath, altPath, garlandPath];
  const tCount = QUALITY.tier === 'low' ? 1400 : 2600;
  const tp = new Float32Array(tCount * 3);
  const tt = new Float32Array(tCount * 3);   // cosmic target (expanded spiral)
  const tc = new Float32Array(tCount * 3);
  const ts = new Float32Array(tCount);
  const td = new Float32Array(tCount);       // seed
  for (let i = 0; i < tCount; i++) {
    const path = trailPaths[i % trailPaths.length];
    const u = rnd();
    const node = path[Math.min(path.length - 1, Math.floor(u * path.length))];
    const jitterAcross = rr(rnd, -0.2, 0.2);
    const px = node.p.x, py = node.p.y, pz = node.p.z;
    const r = Math.hypot(px, pz) || 1e-4;
    tp[i * 3] = px + (px / r) * jitterAcross * 0.3;
    tp[i * 3 + 1] = py + rr(rnd, -0.06, 0.06);
    tp[i * 3 + 2] = pz + (pz / r) * jitterAcross * 0.3;

    const k = (radiusAt(py) * rr(rnd, 1.02, 1.2)) / r;
    tt[i * 3] = px * k; tt[i * 3 + 1] = py + rr(rnd, -0.12, 0.12); tt[i * 3 + 2] = pz * k;

    const col = (i % trailPaths.length === 1)
      ? C.ice.clone().lerp(C.royal, rnd() * 0.5)
      : C.silver.clone().lerp(C.champagne, rnd() * 0.7);
    tc[i * 3] = col.r; tc[i * 3 + 1] = col.g; tc[i * 3 + 2] = col.b;
    ts[i] = rr(rnd, 0.010, 0.032);
    td[i] = rnd();
  }
  const trailGeo = new THREE.BufferGeometry();
  trailGeo.setAttribute('position', new THREE.BufferAttribute(tp, 3));
  trailGeo.setAttribute('aTarget', new THREE.BufferAttribute(tt, 3));
  trailGeo.setAttribute('aColor', new THREE.BufferAttribute(tc, 3));
  trailGeo.setAttribute('aSize', new THREE.BufferAttribute(ts, 1));
  trailGeo.setAttribute('aSeed', new THREE.BufferAttribute(td, 1));
  trailGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, TREE.height * 0.5, 0), TREE.height);

  const trailMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 }, uMorph: { value: 0 }, uScale: { value: 1200 }, uAmb: { value: 0.22 },
      uThA: { value: new THREE.Color(0xffffff) }, uThB: { value: new THREE.Color(0xffffff) },
      uAmtA: { value: 0 }, uAmtB: { value: 0 }, uWaveY: { value: -999 },
    },
    vertexShader: /* glsl */`
      precision highp float;
      attribute vec3 aTarget; attribute vec3 aColor; attribute float aSize; attribute float aSeed;
      uniform float uTime, uMorph, uScale, uAmb;
      uniform vec3 uThA, uThB; uniform float uAmtA, uAmtB, uWaveY;
      varying vec3 vCol; varying float vB;
      void main(){
        float d = clamp((uMorph - 0.1) / 0.8, 0.0, 1.0);
        d = d*d*(3.0-2.0*d);
        vec3 p = mix(position, aTarget, d);
        float a = uTime * (0.05 + 0.1 * d) + aSeed * 6.2831 * 0.0;
        float ca = cos(a), sa = sin(a);
        p = vec3(p.x*ca - p.z*sa, p.y, p.x*sa + p.z*ca);
        p.y += sin(uTime*0.6 + aSeed*12.0) * 0.05 * d;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float flow = pow(max(0.0, sin(uTime*0.9 + aSeed*25.0)), 6.0);
        float wv = uWaveY <= -900.0 ? 1.0 : smoothstep(uWaveY - 0.9, uWaveY + 0.9, position.y);
        float front = uWaveY <= -900.0 ? 0.0 : exp(-pow((position.y - uWaveY) * 1.6, 2.0));
        vB = (uAmb + flow * 0.8) * (1.0 + 1.3 * uMorph) + front * 1.8;
        vCol = mix(mix(aColor, uThA, uAmtA), mix(aColor, uThB, uAmtB), wv);
        gl_PointSize = clamp(aSize * (0.6 + vB) * uScale / max(0.1, -mv.z), 0.0, 48.0);
      }`,
    fragmentShader: /* glsl */`
      precision highp float;
      varying vec3 vCol; varying float vB;
      void main(){
        float r = length(gl_PointCoord - vec2(0.5)) * 2.0;
        if (r > 1.0) discard;
        float a = pow(1.0 - r, 2.4);
        gl_FragColor = vec4(vCol * (0.6 + 1.5 * vB), a * clamp(vB, 0.0, 1.4));
      }`,
  });
  const trails = new THREE.Points(trailGeo, trailMat);
  trails.frustumCulled = false;
  trails.renderOrder = 3;
  group.add(trails);

  const SHEEN = {
    satin: new THREE.Color(0xf0f8ff),
    midnight: new THREE.Color(0x5a9ae4),
  };
  const BASE = {
    ribbonA: new THREE.Color(0xd6e2f2),
    ribbonB: new THREE.Color(0x0c2450),
    metal: new THREE.Color(0xe7eef8),
  };
  const solids = [mainRibbon, altRibbon, beads];
  let morph = 0;

  return {
    group,
    update(time) {
      trailMat.uniforms.uTime.value = time;
      const sh = 1 + Math.sin(time * 0.4) * 0.01;
      mainRibbon.scale.set(sh, 1, sh);
    },
    setMorph(m) {
      morph = m;
      trailMat.uniforms.uMorph.value = m;
      const fade = 1 - Math.min(1, m * 1.25);
      for (const mat of [satin, midnight, beadMat]) {
        mat.opacity = fade;
        mat.transparent = true;
      }
      const vis = fade > 0.01;
      solids.forEach((s) => { s.visible = vis; });
      const push = 1 + m * 0.06;
      solids.forEach((s) => s.scale.set(push, 1, push));
    },
    setScale(s) { trailMat.uniforms.uScale.value = s; },
    setEffects(on) { trailMat.uniforms.uAmb.value = on ? 0.22 : 0.08; },
    setTheme(from, to, waveY) {
      const u = trailMat.uniforms;
      u.uThA.value.copy(from.amount ? from.light2 : new THREE.Color(0xffffff));
      u.uThB.value.copy(to.amount ? to.light2 : new THREE.Color(0xffffff));
      u.uAmtA.value = from.amount ? 0.85 : 0;
      u.uAmtB.value = to.amount ? 0.85 : 0;
      u.uWaveY.value = waveY;
      const w = waveAmount(TREE.height * 0.46, waveY);
      const pick = (t, key, base) => (t.amount ? BASE[key].clone().lerp(t[key], 0.93) : BASE[key].clone());
      satin.color.copy(pick(from, 'ribbonA')).lerp(pick(to, 'ribbonA'), w);
      midnight.color.copy(pick(from, 'ribbonB')).lerp(pick(to, 'ribbonB'), w);
      beadMat.color.copy(pick(from, 'metal')).lerp(pick(to, 'metal'), w);
      const sheen = (t, base) => (t.amount ? base.clone().lerp(t.light2, 0.9) : base.clone());
      satin.sheenColor.copy(sheen(from, SHEEN.satin)).lerp(sheen(to, SHEEN.satin), w);
      midnight.sheenColor.copy(sheen(from, SHEEN.midnight)).lerp(sheen(to, SHEEN.midnight), w);
    },
  };
}
