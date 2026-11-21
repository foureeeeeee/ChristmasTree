import * as THREE from 'three';
import { TREE, QUALITY } from './config.js';
import { C } from './palette.js';
import { makeRng, lerp, clamp, rr, easeOutCubic, softSprite } from './utils.js';

/* ------------------------------------------------------------------
   The Christmas star: an unmistakable five-pointed topper, built as a
   faceted crystal so it reads as a star from every angle, with a
   luminous core, a halo of rays, orbiting sparkles and a slow pulse.
   ------------------------------------------------------------------ */

function star3D(outer = 1, inner = 0.42, depth = 0.26) {
  const pos = [], nor = [];
  const outline = [];
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 2 + (i / 10) * Math.PI * 2;
    const r = i % 2 === 0 ? outer : inner;
    outline.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0));
  }
  const front = new THREE.Vector3(0, 0, depth);
  const back = new THREE.Vector3(0, 0, -depth);
  const n = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3();
  const tri = (a, b, c) => {
    e1.subVectors(b, a); e2.subVectors(c, a);
    n.crossVectors(e1, e2).normalize();
    for (const v of [a, b, c]) { pos.push(v.x, v.y, v.z); nor.push(n.x, n.y, n.z); }
  };
  for (let i = 0; i < 10; i++) {
    const a = outline[i], b = outline[(i + 1) % 10];
    tri(a, b, front);
    tri(b, a, back);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((pos.length / 3) * 2), 2));
  return g;
}

function haloTexture(size = 512, rays = 10) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const ctx = cv.getContext('2d');
  const h = size / 2;
  ctx.translate(h, h);

  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, h);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.07, 'rgba(228,244,255,0.78)');
  g.addColorStop(0.22, 'rgba(168,223,255,0.22)');
  g.addColorStop(0.55, 'rgba(90,150,220,0.06)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(0, 0, h, 0, Math.PI * 2); ctx.fill();

  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < rays; i++) {
    const long = i % 2 === 0;
    const len = h * (long ? 0.96 : 0.46);
    const w = h * (long ? 0.028 : 0.018);
    ctx.save();
    ctx.rotate((i / rays) * Math.PI * 2 + Math.PI / 2);
    const rg = ctx.createLinearGradient(0, 0, 0, -len);
    rg.addColorStop(0, 'rgba(255,255,255,0.85)');
    rg.addColorStop(0.35, 'rgba(200,232,255,0.3)');
    rg.addColorStop(1, 'rgba(168,223,255,0)');
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

function ringTexture(size = 256) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const ctx = cv.getContext('2d');
  const h = size / 2;
  const g = ctx.createRadialGradient(h, h, h * 0.62, h, h, h);
  g.addColorStop(0, 'rgba(168,223,255,0)');
  g.addColorStop(0.55, 'rgba(230,245,255,0.85)');
  g.addColorStop(0.78, 'rgba(168,223,255,0.35)');
  g.addColorStop(1, 'rgba(168,223,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildStar() {
  const rnd = makeRng(TREE.seed + 55);
  const group = new THREE.Group();
  group.name = 'star-topper';
  const baseY = TREE.height + 0.52;
  group.position.set(0, baseY, 0);

  const R = 0.88;

  /* --- the crystal star itself --- */
  const geo = star3D(R, R * 0.4, R * 0.3);
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xeef7ff,
    metalness: 0.28,
    roughness: 0.07,
    clearcoat: 1,
    clearcoatRoughness: 0.03,
        envMapIntensity: 2.9,
    emissive: new THREE.Color(0x7fc4ff),
    emissiveIntensity: 0.55,
    ...(QUALITY.tier === 'low'
      ? {}
      : { transmission: 0.42, ior: 1.7, thickness: 0.6, specularIntensity: 1 }),
  });
  const star = new THREE.Mesh(geo, mat);
  star.name = 'star';
  star.userData.kind = 'star';
  group.add(star);

  /* a second, smaller star rotated behind it for depth */
  const star2 = new THREE.Mesh(star3D(R * 0.74, R * 0.3, R * 0.2), new THREE.MeshPhysicalMaterial({
    color: 0xcfe6ff, metalness: 1, roughness: 0.22, envMapIntensity: 2.2,
    emissive: new THREE.Color(0x15406f), emissiveIntensity: 0.6,
  }));
  star2.rotation.z = Math.PI / 5;
  star2.position.z = -0.02;
  group.add(star2);

  /* --- luminous core --- */
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(R * 0.2, 18, 14),
    new THREE.MeshBasicMaterial({ color: 0xfdf4e2 })
  );
  group.add(core);

  /* --- halo --- */
  const haloMat = new THREE.SpriteMaterial({
    map: haloTexture(512, 10), color: 0xffffff,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.6,
  });
  const halo = new THREE.Sprite(haloMat);
  halo.scale.setScalar(R * 5.2);
  group.add(halo);

  const glowMat = new THREE.SpriteMaterial({
    map: softSprite(128, 1, 2.0), color: 0xbfe4ff,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.5,
  });
  const glow = new THREE.Sprite(glowMat);
  glow.scale.setScalar(R * 3.4);
  group.add(glow);

  /* --- orbiting sparkles --- */
  const sCount = QUALITY.tier === 'low' ? 90 : 190;
  const sPos = new Float32Array(sCount * 3);
  const orbit = [];
  for (let i = 0; i < sCount; i++) {
    orbit.push({
      r: rr(rnd, R * 1.25, R * 2.7),
      speed: rr(rnd, 0.25, 1.05) * (rnd() < 0.5 ? -1 : 1),
      phase: rr(rnd, 0, 6.2831),
      tilt: rr(rnd, -0.9, 0.9),
      yaw: rr(rnd, 0, 6.2831),
      bob: rr(rnd, 0.6, 1.8),
    });
  }
  const sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
  const sparkMat = new THREE.PointsMaterial({
    size: 0.085, map: softSprite(64, 1, 2.4), color: 0xeaf6ff,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true,
  });
  const sparks = new THREE.Points(sparkGeo, sparkMat);
  sparks.frustumCulled = false;
  group.add(sparks);

  /* --- burst: shockwave ring plus a spray of light --- */
  const ringMat = new THREE.SpriteMaterial({
    map: ringTexture(256), transparent: true, blending: THREE.AdditiveBlending,
    depthWrite: false, opacity: 0,
  });
  const ring = new THREE.Sprite(ringMat);
  ring.scale.setScalar(1);
  group.add(ring);

  const bCount = QUALITY.tier === 'low' ? 260 : 520;
  const bPos = new Float32Array(bCount * 3);
  const bVel = [];
  const bCol = new Float32Array(bCount * 3);
  for (let i = 0; i < bCount; i++) {
    const v = new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize()
      .multiplyScalar(rr(rnd, 1.6, 5.4));
    v.y -= 0.6;
    bVel.push(v);
    const c = C.champagne.clone().lerp(C.ice, rnd());
    bCol[i * 3] = c.r; bCol[i * 3 + 1] = c.g; bCol[i * 3 + 2] = c.b;
  }
  const burstGeo = new THREE.BufferGeometry();
  burstGeo.setAttribute('position', new THREE.BufferAttribute(bPos, 3));
  burstGeo.setAttribute('color', new THREE.BufferAttribute(bCol, 3));
  const burstMat = new THREE.PointsMaterial({
    size: 0.14, map: softSprite(64, 1, 2.2), vertexColors: true,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    sizeAttenuation: true, opacity: 0,
  });
  const burst = new THREE.Points(burstGeo, burstMat);
  burst.frustumCulled = false;
  burst.visible = false;
  group.add(burst);

  const starLight = new THREE.PointLight(0xcfe8ff, 3.2, 9, 2);
  group.add(starLight);

  let burstT = -1;   // -1 = idle, otherwise seconds since the burst
  let morph = 0;

  function trigger() { burstT = 0; burst.visible = true; }

  function update(time, dt) {
    /* gentle pulse */
    const pulse = 0.5 + 0.5 * Math.sin(time * 1.15);
    const pulse2 = 0.5 + 0.5 * Math.sin(time * 0.43 + 1.2);
    const s = 1 + pulse * 0.035 + morph * 0.1;
    star.scale.setScalar(s);
    star2.scale.setScalar(s * (1 + pulse2 * 0.03));
    star.rotation.y = Math.sin(time * 0.22) * 0.5 + time * 0.07;
    star2.rotation.y = -star.rotation.y * 0.7;
    mat.emissiveIntensity = 0.42 + pulse * 0.35 + morph * 0.6;

    core.scale.setScalar(1 + pulse * 0.22);
    haloMat.opacity = (0.34 + pulse * 0.16 + morph * 0.3);
    halo.scale.setScalar(R * (4.8 + pulse * 0.5 + morph * 1.5));
    halo.material.rotation = time * 0.035;
    glowMat.opacity = 0.26 + pulse2 * 0.16 + morph * 0.35;
    glow.scale.setScalar(R * (3.1 + pulse * 0.35 + morph * 1.1));
    starLight.intensity = 2.4 + pulse * 1.0 + morph * 2.2;

    /* orbiting sparkles */
    for (let i = 0; i < sCount; i++) {
      const o = orbit[i];
      const a = time * o.speed + o.phase;
      const x = Math.cos(a) * o.r;
      const z = Math.sin(a) * o.r;
      const y = Math.sin(a * o.bob + o.phase) * o.r * 0.25 * o.tilt;
      const cy = Math.cos(o.yaw), sy = Math.sin(o.yaw);
      sPos[i * 3] = x * cy - y * sy * 0.4;
      sPos[i * 3 + 1] = y * cy + x * sy * 0.25;
      sPos[i * 3 + 2] = z;
    }
    sparkGeo.attributes.position.needsUpdate = true;
    sparkMat.opacity = 0.6 + pulse * 0.25 + morph * 0.3;
    sparkMat.size = 0.075 + morph * 0.05;

    /* burst */
    if (burstT >= 0) {
      burstT += dt;
      const T = 2.2;
      const u = clamp(burstT / T);
      const e = easeOutCubic(u);
      ringMat.opacity = (1 - u) * (1 - u) * 0.95;
      ring.scale.setScalar(0.7 + e * 16);
      burstMat.opacity = Math.pow(1 - u, 1.5);
      for (let i = 0; i < bCount; i++) {
        const v = bVel[i];
        const d = e * 1.0;
        bPos[i * 3] = v.x * d;
        bPos[i * 3 + 1] = v.y * d - 0.6 * d * d;
        bPos[i * 3 + 2] = v.z * d;
      }
      burstGeo.attributes.position.needsUpdate = true;
      if (u >= 1) { burstT = -1; burst.visible = false; ringMat.opacity = 0; burstMat.opacity = 0; }
    }
  }

  const SB = {
    star: new THREE.Color(0xeef7ff), starEm: new THREE.Color(0x7fc4ff),
    star2: new THREE.Color(0xcfe6ff), star2Em: new THREE.Color(0x15406f),
    core: new THREE.Color(0xfdf4e2), halo: new THREE.Color(0xffffff),
    glow: new THREE.Color(0xbfe4ff), spark: new THREE.Color(0xeaf6ff),
    light: new THREE.Color(0xcfe8ff),
  };
  const mixTo = (out, base, from, to, key, w, amt = 0.93) => {
    const a = from.amount ? base.clone().lerp(from[key], amt) : base;
    const b = to.amount ? base.clone().lerp(to[key], amt) : base;
    out.copy(a).lerp(b, w);
  };

  return {
    group, star, trigger,
    setTheme(from, to, waveY) {
      /* the topper is at the very top, so it turns the moment the wave starts */
      const w = waveY <= -900 ? 1 : clamp((TREE.height + 1.6 - waveY) / 1.2);
      mixTo(mat.color, SB.star, from, to, 'light2', w, 0.7);
      mixTo(mat.emissive, SB.starEm, from, to, 'mid', w);
      mixTo(star2.material.color, SB.star2, from, to, 'metal', w);
      mixTo(star2.material.emissive, SB.star2Em, from, to, 'glass', w);
      mixTo(core.material.color, SB.core, from, to, 'light1', w, 0.8);
      mixTo(haloMat.color, SB.halo, from, to, 'light2', w, 0.75);
      mixTo(glowMat.color, SB.glow, from, to, 'light2', w);
      mixTo(sparkMat.color, SB.spark, from, to, 'light1', w, 0.8);
      mixTo(starLight.color, SB.light, from, to, 'light2', w, 0.8);
      mixTo(burstMat.color, SB.halo, from, to, 'light1', w, 0.6);
    },
    get burstWave() { return burstT < 0 ? 0 : Math.pow(clamp(1 - burstT / 1.6), 1.2); },
    update,
    setMorph(m) { morph = m; },
    setEffects(on) {
      halo.visible = on; glow.visible = on; sparks.visible = on;
      starLight.intensity = on ? starLight.intensity : 1.2;
    },
    worldPosition() { return group.position.clone(); },
  };
}
