import * as THREE from 'three';
import { TREE, QUALITY } from './config.js';
import { C } from './palette.js';
import { makeRng, lerp, clamp, rr, waveAmount, softSprite } from './utils.js';

/* ------------------------------------------------------------------
   The foot of the tree: an elegant metal stand half buried in snow,
   a circular platform with slow decorative rings, and a quiet spiral
   galaxy of particles that only becomes prominent in cosmic mode.
   ------------------------------------------------------------------ */

function ringMaterial(r0, r1, seg, speed, color, opacity) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 }, uR0: { value: r0 }, uR1: { value: r1 },
      uSeg: { value: seg }, uSpeed: { value: speed },
      uColor: { value: new THREE.Color(color) }, uOpacity: { value: opacity },
      uMorph: { value: 0 },
    },
    vertexShader: /* glsl */`
      varying vec2 vP;
      void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: /* glsl */`
      precision highp float;
      varying vec2 vP;
      uniform float uTime, uR0, uR1, uSeg, uSpeed, uOpacity, uMorph;
      uniform vec3 uColor;
      void main(){
        float r = length(vP);
        float a = atan(vP.y, vP.x);
        float band = smoothstep(uR0, uR0 + 0.05, r) * (1.0 - smoothstep(uR1 - 0.05, uR1, r));
        float ticks = pow(0.5 + 0.5 * sin(a * uSeg + uTime * uSpeed), 5.0);
        float glow = pow(0.5 + 0.5 * sin(a * 2.0 - uTime * uSpeed * 0.4), 2.0);
        float al = band * (0.16 + 0.84 * ticks) * (0.5 + 0.5 * glow);
        al *= uOpacity * (1.0 + 1.1 * uMorph);
        if (al < 0.004) discard;
        gl_FragColor = vec4(uColor * (1.0 + 1.4 * uMorph), al);
      }`,
  });
}

export function buildBase() {
  const rnd = makeRng(1212);
  const group = new THREE.Group();
  group.name = 'base';

  /* ---------- snow-covered ground ---------- */
  const groundGeo = new THREE.CircleGeometry(16, 96, 0, Math.PI * 2);
  groundGeo.rotateX(-Math.PI / 2);
  {
    const pa = groundGeo.attributes.position;
    const colors = new Float32Array(pa.count * 3);
    const near = new THREE.Color(0xdfeaf8), far = new THREE.Color(0x061026);
    const col = new THREE.Color();
    for (let i = 0; i < pa.count; i++) {
      const x = pa.getX(i), z = pa.getZ(i);
      const r = Math.hypot(x, z);
      pa.setY(i, Math.sin(x * 1.1) * Math.cos(z * 0.9) * 0.045 - Math.min(0.25, r * 0.012));
      col.copy(near).lerp(far, clamp(Math.pow(r / 11, 0.9)));
      colors[i * 3] = col.r; colors[i * 3 + 1] = col.g; colors[i * 3 + 2] = col.b;
    }
    groundGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    groundGeo.computeVertexNormals();
  }
  const groundMat = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.88, metalness: 0.05,
    envMapIntensity: 0.35,
  });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.position.y = -0.03;
  group.add(ground);

  /* ---------- the tree stand ---------- */
  const metal = new THREE.MeshPhysicalMaterial({
    color: 0x1a2435, metalness: 0.92, roughness: 0.3, envMapIntensity: 1.5,
    clearcoat: 0.5, clearcoatRoughness: 0.25,
  });
  const stand = new THREE.Group();
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.48, 0.52, 28, 1, true), metal);
  bowl.position.y = 0.26;
  stand.add(bowl);
  const bowlFloor = new THREE.Mesh(
    new THREE.CircleGeometry(0.62, 28),
    new THREE.MeshStandardMaterial({ color: 0x0a1120, roughness: 0.95, metalness: 0.1 })
  );
  bowlFloor.rotation.x = -Math.PI / 2;
  bowlFloor.position.y = 0.5;
  stand.add(bowlFloor);
  const trim = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.045, 10, 36), metal);
  trim.rotation.x = Math.PI / 2;
  trim.position.y = 0.5;
  stand.add(trim);
  const footRing = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.055, 10, 40), metal);
  footRing.rotation.x = Math.PI / 2;
  footRing.position.y = 0.045;
  stand.add(footRing);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.065, 0.42, 8), metal);
    leg.position.set(Math.cos(a) * 0.56, 0.2, Math.sin(a) * 0.56);
    leg.rotation.z = Math.cos(a) * 0.22;
    leg.rotation.x = -Math.sin(a) * 0.22;
    stand.add(leg);
  }
  group.add(stand);

  /* ---------- snow heaped over the stand ---------- */
  const moundGeo = new THREE.SphereGeometry(1, 40, 24);
  {
    const pa = moundGeo.attributes.position;
    for (let i = 0; i < pa.count; i++) {
      const x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i);
      const n = 1 + 0.16 * Math.sin(x * 4.1 + z * 3.3) + 0.1 * Math.cos(z * 6.2 - x * 2.2);
      pa.setXYZ(i, x * n, Math.max(-0.02, y) * n, z * n);
    }
    moundGeo.computeVertexNormals();
  }
  const snowMat = new THREE.MeshStandardMaterial({
    color: 0xd6e4f7, roughness: 0.86, metalness: 0.02,
    envMapIntensity: 0.45,
    emissive: new THREE.Color(0x0a2047), emissiveIntensity: 0.22,
  });
  const mound = new THREE.Mesh(moundGeo, snowMat);
  mound.scale.set(1.3, 0.62, 1.3);
  mound.position.y = 0.0;
  group.add(mound);

  const mound2 = new THREE.Mesh(moundGeo, snowMat);
  mound2.scale.set(2.2, 0.16, 2.2);
  mound2.position.y = -0.04;
  group.add(mound2);

  /* sparkle on the snow */
  const sCount = QUALITY.tier === 'low' ? 500 : 1100;
  {
    const p = new Float32Array(sCount * 3);
    const s = new Float32Array(sCount);
    for (let i = 0; i < sCount; i++) {
      const a = rnd() * Math.PI * 2;
      const r = 0.9 + Math.pow(rnd(), 0.6) * 6.2;
      p[i * 3] = Math.cos(a) * r;
      p[i * 3 + 1] = 0.01 + rnd() * 0.03;
      p[i * 3 + 2] = Math.sin(a) * r;
      s[i] = rr(rnd, 0.008, 0.024);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(s, 1));
    const m = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uScale: { value: 1200 } },
      vertexShader: `
        attribute float aSize; uniform float uTime, uScale; varying float vB;
        void main(){
          vec4 mv = modelViewMatrix * vec4(position,1.0);
          gl_Position = projectionMatrix * mv;
          float tw = pow(max(0.0, sin(uTime*1.7 + position.x*9.0 + position.z*7.0)), 18.0);
          vB = tw;
          gl_PointSize = clamp(aSize*(0.3+tw*1.6)*uScale/max(0.1,-mv.z), 0.0, 18.0);
        }`,
      fragmentShader: `
        precision highp float; varying float vB;
        void main(){
          float r = length(gl_PointCoord - vec2(0.5))*2.0;
          if (r > 1.0) discard;
          gl_FragColor = vec4(vec3(0.85,0.93,1.0), pow(1.0-r,2.0)*vB);
        }`,
    });
    const sparkle = new THREE.Points(g, m);
    sparkle.frustumCulled = false;
    group.add(sparkle);
    group.userData.sparkleMat = m;
  }

  /* ---------- circular platform with slow rotating rings ---------- */
  const platform = new THREE.Group();
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(7.6, 96),
    new THREE.MeshPhysicalMaterial({
      color: 0x050d20, metalness: 0.75, roughness: 0.22,
      envMapIntensity: 0.8, transparent: true, opacity: 0.26,
    })
  );
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = -0.06;
  platform.add(disc);

  const ringDefs = [
    { r0: 2.9, r1: 3.16, seg: 48, speed: 0.11, color: 0xa8dfff, op: 0.34 },
    { r0: 4.3, r1: 4.5, seg: 96, speed: -0.07, color: 0xdce5ef, op: 0.26 },
    { r0: 5.5, r1: 5.8, seg: 24, speed: 0.045, color: 0x3f7fe0, op: 0.3 },
    { r0: 6.6, r1: 6.72, seg: 160, speed: -0.03, color: 0xa8dfff, op: 0.16 },
  ];
  const rings = ringDefs.map((d) => {
    const m = ringMaterial(d.r0, d.r1, d.seg, d.speed, d.color, d.op);
    const mesh = new THREE.Mesh(new THREE.RingGeometry(d.r0 - 0.1, d.r1 + 0.1, 128), m);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0.012 + d.r0 * 0.002;
    platform.add(mesh);
    return m;
  });
  group.add(platform);

  /* ---------- the quiet galaxy ---------- */
  const gCount = QUALITY.galaxy;
  const gp = new Float32Array(gCount * 3);
  const gc = new Float32Array(gCount * 3);
  const gs = new Float32Array(gCount);
  const gseed = new Float32Array(gCount);
  const ARMS = 3;
  for (let i = 0; i < gCount; i++) {
    const arm = i % ARMS;
    const t = Math.pow(rnd(), 0.62);
    const r = 1.4 + t * 10.5;
    const spin = r * 0.42;
    const a = (arm / ARMS) * Math.PI * 2 + spin + rr(rnd, -0.3, 0.3) * (1.2 - t);
    const wob = rr(rnd, -1, 1) * (0.26 + t * 0.5);
    gp[i * 3] = Math.cos(a) * r + wob;
    gp[i * 3 + 1] = rr(rnd, -1, 1) * (0.1 + t * 0.26) * Math.exp(-t * 1.2);
    gp[i * 3 + 2] = Math.sin(a) * r + wob;
    const col = (rnd() < 0.3 ? C.ice.clone() : C.royal.clone()).lerp(C.silver, Math.pow(rnd(), 2) * 0.8);
    col.lerp(C.sapphireDeep, t * 0.4);
    gc[i * 3] = col.r; gc[i * 3 + 1] = col.g; gc[i * 3 + 2] = col.b;
    gs[i] = rr(rnd, 0.012, 0.042) * (1.3 - t * 0.5);
    gseed[i] = rnd();
  }
  const galaxyGeo = new THREE.BufferGeometry();
  galaxyGeo.setAttribute('position', new THREE.BufferAttribute(gp, 3));
  galaxyGeo.setAttribute('aColor', new THREE.BufferAttribute(gc, 3));
  galaxyGeo.setAttribute('aSize', new THREE.BufferAttribute(gs, 1));
  galaxyGeo.setAttribute('aSeed', new THREE.BufferAttribute(gseed, 1));
  const galaxyMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 }, uMorph: { value: 0 }, uScale: { value: 1200 }, uAmb: { value: 1 },
      uThA: { value: new THREE.Color(0xffffff) }, uThB: { value: new THREE.Color(0xffffff) },
      uAmtA: { value: 0 }, uAmtB: { value: 0 }, uBlend: { value: 1 },
    },
    vertexShader: /* glsl */`
      precision highp float;
      attribute vec3 aColor; attribute float aSize; attribute float aSeed;
      uniform float uTime, uMorph, uScale;
      uniform vec3 uThA, uThB; uniform float uAmtA, uAmtB, uBlend;
      varying vec3 vCol; varying float vB;
      void main(){
        float r = length(position.xz);
        float a = uTime * (0.055 - r * 0.0028);
        float ca = cos(a), sa = sin(a);
        vec3 p = vec3(position.x*ca - position.z*sa, position.y, position.x*sa + position.z*ca);
        p.y += uMorph * (0.35 + aSeed * 1.1) * exp(-r * 0.1);
        vec4 mv = modelViewMatrix * vec4(p,1.0);
        gl_Position = projectionMatrix * mv;
        float tw = 0.6 + 0.4*sin(uTime*(0.4+aSeed*1.6) + aSeed*20.0);
        vB = tw * (0.42 + 1.0*uMorph);
        vCol = mix(mix(aColor, uThA, uAmtA), mix(aColor, uThB, uAmtB), uBlend);
        gl_PointSize = clamp(aSize*(0.6+0.7*uMorph)*uScale/max(0.1,-mv.z), 0.0, 26.0);
      }`,
    fragmentShader: /* glsl */`
      precision highp float; varying vec3 vCol; varying float vB;
      uniform float uAmb;
      void main(){
        float r = length(gl_PointCoord - vec2(0.5))*2.0;
        if (r > 1.0) discard;
        gl_FragColor = vec4(vCol*(0.7+1.1*vB), pow(1.0-r,2.3)*vB*uAmb);
      }`,
  });
  const galaxy = new THREE.Points(galaxyGeo, galaxyMat);
  galaxy.frustumCulled = false;
  galaxy.position.y = 0.06;
  group.add(galaxy);

  let morph = 0;
  const SNOW = new THREE.Color(0xd6e4f7);
  const EMIS = new THREE.Color(0x0a2047);
  const GROUND = new THREE.Color(0xffffff);

  return {
    group,
    update(time) {
      rings.forEach((m) => { m.uniforms.uTime.value = time; });
      galaxyMat.uniforms.uTime.value = time;
      if (group.userData.sparkleMat) group.userData.sparkleMat.uniforms.uTime.value = time;
    },
    setMorph(m) {
      morph = m;
      rings.forEach((r) => { r.uniforms.uMorph.value = m; });
      galaxyMat.uniforms.uMorph.value = m;
      const dim = lerp(1, 0.75, m);
      snowMat.emissiveIntensity = 0.22 + m * 0.45;
      groundMat.envMapIntensity = 0.35 + m * 0.4;
      disc.material.opacity = 0.26 * dim;
    },
    setScale(s) {
      galaxyMat.uniforms.uScale.value = s;
      if (group.userData.sparkleMat) group.userData.sparkleMat.uniforms.uScale.value = s;
    },
    setTheme(from, to, waveY) {
      /* everything down here is at ground level, so it is last to turn */
      const w = waveAmount(0.35, waveY);
      const gu = galaxyMat.uniforms;
      gu.uThA.value.copy(from.amount ? from.galaxyB : new THREE.Color(0xffffff));
      gu.uThB.value.copy(to.amount ? to.galaxyB : new THREE.Color(0xffffff));
      gu.uAmtA.value = from.amount ? 0.8 : 0;
      gu.uAmtB.value = to.amount ? 0.8 : 0;
      gu.uBlend.value = w;
      rings.forEach((r, i) => {
        const base = new THREE.Color(ringDefs[i].color);
        const a = from.amount ? base.clone().lerp(from.ring, 0.9) : base.clone();
        const b = to.amount ? base.clone().lerp(to.ring, 0.9) : base.clone();
        r.uniforms.uColor.value.copy(a).lerp(b, w);
      });
      const sA = from.amount ? SNOW.clone().lerp(from.light2, 0.5) : SNOW.clone();
      const sB = to.amount ? SNOW.clone().lerp(to.light2, 0.5) : SNOW.clone();
      snowMat.color.copy(sA).lerp(sB, w);
      const eA = from.amount ? from.deep : EMIS;
      const eB = to.amount ? to.deep : EMIS;
      snowMat.emissive.copy(eA).lerp(eB, w);
      const gA = from.amount ? GROUND.clone().lerp(from.deep, 0.55) : GROUND.clone();
      const gB = to.amount ? GROUND.clone().lerp(to.deep, 0.55) : GROUND.clone();
      groundMat.color.copy(gA).lerp(gB, w);
    },
    setEffects(on) {
      galaxyMat.uniforms.uAmb.value = on ? 1 : 0.25;
      rings.forEach((r, i) => { r.uniforms.uOpacity.value = (on ? 1 : 0.25) * ringDefs[i].op; });
    },
  };
}
