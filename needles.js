import * as THREE from 'three';
import { TREE, QUALITY, radiusAt } from './config.js';
import { C } from './palette.js';
import { makeRng, lerp, clamp, rr } from './utils.js';

/* ------------------------------------------------------------------
   One instanced system holds every pine needle on the tree.
   The SAME instance positions are used for both modes: in Enchanted
   mode each instance is drawn as a short, lit, tapered needle; in
   Cosmic mode the needle shortens into a glowing round particle that
   drifts onto an idealised cone shell, so the Christmas-tree
   silhouette survives the transformation. Nothing is hidden and
   nothing is swapped — it is one mesh morphing.
   ------------------------------------------------------------------ */

const VERT = /* glsl */`
precision highp float;

attribute vec3 aPos;
attribute vec3 aDir;
attribute vec4 aData;    // x len, y width, z seed, w ao (0 deep inside -> 1 at the shell)
attribute vec3 aTint;
attribute vec3 aExtra;   // x layerT, y upness, z tipness
attribute vec3 aTarget;  // cosmic-mode settle position

uniform float uTime;
uniform float uMorph;
uniform float uHeight;
uniform float uSway;
uniform float uFrost;
uniform float uBurst;    // 0..1 light wave from the star
uniform vec3  uIce;
uniform vec3  uChampagne;
uniform vec3  uFrostCol;

/* --- album colours: A is what the tree is wearing now, B is what the
       downward colour wave is turning it into --- */
uniform vec3  uDeepA;  uniform vec3  uMidA;  uniform float uAmtA;
uniform vec3  uDeepB;  uniform vec3  uMidB;  uniform float uAmtB;
uniform vec3  uWarmA;  uniform vec3  uCoolA; uniform vec3 uCosA; uniform vec3 uFrostA;
uniform vec3  uWarmB;  uniform vec3  uCoolB; uniform vec3 uCosB; uniform vec3 uFrostB;
uniform float uWaveY;
uniform float uCharge;   // 0..1 while the tree is being held

uniform vec3  uSpillPos[8];
uniform vec3  uSpillCol[8];
uniform float uSpillInt[8];

varying vec2  vUv;
varying vec3  vColor;
varying float vMorph;
varying float vAlphaBoost;

const vec3 KEY  = vec3(0.42, 0.78, 0.68);
const vec3 FILL = vec3(-0.62, 0.42, -0.52);

void main() {
  vUv = uv;
  float len  = aData.x;
  float wid  = aData.y;
  float seed = aData.z;
  float ao   = aData.w;

  float hN = clamp(aPos.y / uHeight, 0.0, 1.0);

  /* staggered dissolve: lower, outer needles let go first */
  float delay = 0.40 * seed + 0.34 * (1.0 - hN);
  float local = clamp((uMorph * 1.92 - delay) / 0.80, 0.0, 1.0);
  local = local * local * (3.0 - 2.0 * local);
  vMorph = local;

  /* ---- enchanted position: a breath of wind ---- */
  vec3 p = aPos;
  float swayAmt = uSway * (0.22 + 0.9 * hN);
  p.x += sin(uTime * 0.52 + aPos.y * 0.62 + seed * 6.2831) * 0.016 * swayAmt;
  p.z += cos(uTime * 0.44 + aPos.y * 0.51 + seed * 6.2831) * 0.016 * swayAmt;

  /* ---- cosmic position: settle onto the shell, orbit gently ---- */
  vec3 tgt = aTarget;
  float ang = local * (0.55 + seed * 1.15) + uTime * 0.045 * local;
  float ca = cos(ang), sa = sin(ang);
  vec3 orb = vec3(tgt.x * ca - tgt.z * sa, tgt.y, tgt.x * sa + tgt.z * ca);
  float br = 1.0 + 0.045 * sin(uTime * 0.85 + seed * 6.2831 + hN * 5.0);
  orb.xz *= br;
  orb.y += sin(uTime * 0.62 + seed * 11.0) * 0.07;

  vec3 world = mix(p, orb, local);

  /* ---- build the billboard ---- */
  vec4 mv = modelViewMatrix * vec4(world, 1.0);
  vec3 axisV = normalize((modelViewMatrix * vec4(aDir, 0.0)).xyz);
  vec3 ref = vec3(0.0, 0.0, 1.0);
  vec3 sideV = cross(axisV, ref);
  float sl = length(sideV);
  sideV = sl < 1e-4 ? vec3(1.0, 0.0, 0.0) : sideV / sl;

  float nLen  = len * (1.0 - local);
  float pSize = local * wid * 2.5 * (0.45 + 0.85 * seed);
  float taper = 1.0 - pow(uv.y, 1.35);
  float along  = uv.y * nLen + (uv.y - 0.5) * pSize;
  float across = (uv.x - 0.5) * (wid * taper * (1.0 - local) + pSize);
  mv.xyz += axisV * along + sideV * across;
  gl_Position = projectionMatrix * mv;

  /* ---- shading ---- */
  vec3 outward = normalize(vec3(aPos.x, 0.0, aPos.z) + vec3(1e-4));
  vec3 nrm = normalize(mix(outward, vec3(0.0, 1.0, 0.0), 0.28 + 0.3 * aExtra.y));
  float kd = max(dot(nrm, normalize(KEY)), 0.0);
  float fd = max(dot(nrm, normalize(FILL)), 0.0);
  float shade = 0.16 + 0.74 * kd + 0.26 * fd;
  shade *= mix(0.26, 1.0, ao);            // canopy depth
  shade *= mix(0.86, 1.08, aExtra.z);     // tips catch more light

  /* recolour: keep each needle's own relative brightness, swap the hue
     for the album's deep/mid pair, and let the wave decide how far the
     change has travelled down the tree */
  float lum = dot(aTint, vec3(0.3333));
  float k = smoothstep(0.015, 0.14, lum);
  float w = uWaveY <= -900.0 ? 1.0 : smoothstep(uWaveY - 0.9, uWaveY + 0.9, aPos.y);

  /* Take the album's hue but keep this needle's own brightness, or a
     pale palette would turn the whole tree into a white cone. */
  vec3 hueA = mix(uDeepA, uMidA, k);
  vec3 hueB = mix(uDeepB, uMidB, k);
  hueA *= lum / max(0.025, dot(hueA, vec3(0.3333))) * 1.55;
  hueB *= lum / max(0.025, dot(hueB, vec3(0.3333))) * 1.55;
  vec3 tintA = mix(aTint, hueA, uAmtA);
  vec3 tintB = mix(aTint, hueB, uAmtB);
  vec3 tint  = mix(tintA, tintB, w);
  vec3 warm  = mix(uWarmA, uWarmB, w);
  vec3 cool  = mix(uCoolA, uCoolB, w);
  vec3 cosm  = mix(uCosA,  uCosB,  w);
  vec3 frostC = mix(uFrostA, uFrostB, w);

  vec3 base = mix(tint, frostC, aExtra.y * uFrost * 0.42 * ao);
  vec3 lit = base * shade;
  lit += warm * 0.055 * aExtra.z * shade;
  lit += cool * 0.035 * (1.0 - ao);

  /* the bright line of the wavefront itself */
  float front = uWaveY <= -900.0 ? 0.0 : exp(-pow((aPos.y - uWaveY) * 1.5, 2.0));
  lit += mix(cool, warm, 0.35) * front * 1.25;

  /* holding the tree fills it with light from the roots upward */
  float chg = 0.0;
  if (uCharge > 0.0005) {
    float cy = uCharge * (uHeight + 0.6);
    float below = smoothstep(cy + 0.8, cy - 0.8, aPos.y);
    float band = exp(-pow((aPos.y - cy) * 1.7, 2.0));
    chg = below * 0.3 * uCharge + band * 1.5;
    lit += mix(cool, warm, 0.45) * chg;
  }

  /* glow spilling off the nearest fairy lights */
  vec3 spill = vec3(0.0);
  for (int i = 0; i < 8; i++) {
    float inten = uSpillInt[i];
    if (inten <= 0.0) continue;
    vec3 dv = uSpillPos[i] - aPos;
    float d2 = dot(dv, dv);
    float nd = max(dot(nrm, dv / max(0.001, sqrt(d2))), 0.0);
    spill += uSpillCol[i] * inten * (0.30 + 0.70 * nd) / (1.0 + d2 * 2.6);
  }
  lit += spill;

  /* light wave travelling down from the star */
  float wave = uBurst > 0.001
    ? exp(-pow((hN - (1.0 - uBurst * 1.25)) * 7.0, 2.0)) * uBurst
    : 0.0;
  lit += mix(cool, warm, 0.4) * wave * 1.3;

  /* in cosmic mode most particles are deep sapphire and quiet;
     only a few burn champagne-bright, so the sculpture keeps its
     facets instead of turning into one solid glowing cone */
  vec3 glow = mix(cosm, cool, smoothstep(0.18, 0.72, seed));
  glow = mix(glow, warm, smoothstep(0.88, 1.0, seed) * 0.85);
  glow *= 0.16 + 1.15 * pow(seed, 3.0) + 0.3 * aExtra.z;
  vColor = mix(lit, glow, local) * (1.0 + 0.25 * local + wave * 0.7 + front * 0.5 + chg * 0.35);

  /* a third of the needles simply let go, which opens the sculpture up */
  float keep = smoothstep(0.20, 0.36, seed);
  vAlphaBoost = mix(1.0, 0.14 + 0.66 * keep, local);
}
`;

const FRAG = /* glsl */`
precision highp float;
varying vec2  vUv;
varying vec3  vColor;
varying float vMorph;
varying float vAlphaBoost;
uniform float uOpacity;

void main() {
  float ex = abs(vUv.x - 0.5) * 2.0;
  float needleA = smoothstep(1.0, 0.55, ex) * smoothstep(1.0, 0.82, vUv.y);
  float r = length(vUv - vec2(0.5)) * 2.0;
  float partA = pow(max(0.0, 1.0 - r), 2.1);
  float a = mix(needleA, partA, vMorph) * uOpacity * vAlphaBoost;
  if (a < 0.035) discard;
  gl_FragColor = vec4(vColor, a);
}
`;

export function buildNeedles(tree) {
  const rnd = makeRng(TREE.seed + 991);

  /* gather every limb (branches and twigs) with its own length */
  const limbs = [];
  let total = 0;
  for (const b of tree.branches) {
    limbs.push({ curve: b.curve, length: b.length, layer: b.layer, w: 0.55, rad: 0.03 });
    total += b.length * 0.55;
    for (const tw of b.twigs) {
      limbs.push({ curve: tw.curve, length: tw.length, layer: b.layer, w: 1.0, rad: 0.012 });
      total += tw.length;
    }
  }

  const target = QUALITY.needles;
  const perUnit = target / Math.max(0.001, total);

  const aPos = [], aDir = [], aData = [], aTint = [], aExtra = [], aTarget = [];
  const P = new THREE.Vector3(), T = new THREE.Vector3();
  const n1 = new THREE.Vector3(), n2 = new THREE.Vector3(), d = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const tints = [C.needleDark, C.needleMid, C.needleBlue, C.needleLight];

  for (const limb of limbs) {
    const want = limb.length * limb.w * perUnit;
    let count = Math.floor(want);
    if (rnd() < want - count) count++;
    if (count <= 0) continue;

    for (let k = 0; k < count; k++) {
      const t = clamp(0.04 + (k + rr(rnd, 0, 1)) / count * 0.96, 0, 1);
      limb.curve.getPointAt(t, P);
      limb.curve.getTangent(t, T).normalize();

      /* an orthonormal frame around the limb */
      n1.set(-T.z, 0, T.x);
      if (n1.lengthSq() < 1e-6) n1.set(1, 0, 0);
      n1.normalize();
      n2.crossVectors(T, n1).normalize();

      const roll = rr(rnd, 0, Math.PI * 2);
      const cr = Math.cos(roll), sr = Math.sin(roll);
      const radial = n1.clone().multiplyScalar(cr).addScaledVector(n2, sr);

      // jitter the needle root around the limb surface
      P.addScaledVector(radial, limb.rad * rr(rnd, 0.2, 1.0));

      const spread = rr(rnd, 0.72, 1.3);  // angle away from the limb axis
      d.copy(T).multiplyScalar(Math.cos(spread)).addScaledVector(radial, Math.sin(spread));

      // bias needles outward and slightly up so none point into the trunk
      const outward = new THREE.Vector3(P.x, 0, P.z);
      if (outward.lengthSq() < 1e-6) outward.set(1, 0, 0);
      outward.normalize();
      d.addScaledVector(outward, 0.3).addScaledVector(up, 0.14).normalize();

      const hN = clamp(P.y / TREE.height);
      const R = radiusAt(P.y);
      const r = Math.hypot(P.x, P.z);
      const ao = clamp(Math.pow(clamp(r / Math.max(0.06, R)), 0.72) * 1.04);

      const len = lerp(0.175, 0.095, hN) * rr(rnd, 0.72, 1.22);
      const wid = len * rr(rnd, 0.105, 0.16);

      aPos.push(P.x, P.y, P.z);
      aDir.push(d.x, d.y, d.z);
      aData.push(len, wid, rnd(), ao);

      /* foliage colour: deep evergreen inside, muted blue-green and a
         touch of icy light towards the outside and the top */
      const col = tints[Math.min(tints.length - 1, Math.floor(rnd() * tints.length))].clone();
      col.lerp(C.needleBlue, 0.12 + 0.22 * hN * rnd());
      col.lerp(C.needleLight, 0.36 * Math.pow(ao, 2.0) * rnd());
      col.lerp(C.ice, 0.05 * ao * hN);
      col.multiplyScalar(lerp(0.78, 1.1, ao));
      aTint.push(col.r, col.g, col.b);

      const upness = clamp(d.y * 0.5 + 0.5);
      aExtra.push(limb.layer / Math.max(1, tree.whorls - 1), upness, clamp(t * 1.05));

      /* cosmic settle target: drift onto a clean cone shell */
      const shellR = R * rr(rnd, 0.80, 1.0);
      const kr = lerp(r, shellR, 0.62);
      const inv = r < 1e-4 ? 0 : kr / r;
      aTarget.push(
        r < 1e-4 ? rr(rnd, -0.05, 0.05) : P.x * inv,
        P.y + rr(rnd, -0.08, 0.08),
        r < 1e-4 ? rr(rnd, -0.05, 0.05) : P.z * inv
      );
    }
  }

  const count = aData.length / 4;

  const quad = new THREE.PlaneGeometry(1, 1);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = quad.index;
  geo.setAttribute('position', quad.attributes.position);
  geo.setAttribute('uv', quad.attributes.uv);
  geo.instanceCount = count;
  geo.setAttribute('aPos', new THREE.InstancedBufferAttribute(new Float32Array(aPos), 3));
  geo.setAttribute('aDir', new THREE.InstancedBufferAttribute(new Float32Array(aDir), 3));
  geo.setAttribute('aData', new THREE.InstancedBufferAttribute(new Float32Array(aData), 4));
  geo.setAttribute('aTint', new THREE.InstancedBufferAttribute(new Float32Array(aTint), 3));
  geo.setAttribute('aExtra', new THREE.InstancedBufferAttribute(new Float32Array(aExtra), 3));
  geo.setAttribute('aTarget', new THREE.InstancedBufferAttribute(new Float32Array(aTarget), 3));
  geo.boundingSphere = new THREE.Sphere(
    new THREE.Vector3(0, TREE.height * 0.5, 0), TREE.height * 0.85
  );

  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: true,
    depthTest: true,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uMorph: { value: 0 },
      uHeight: { value: TREE.height },
      uSway: { value: 1 },
      uFrost: { value: 1 },
      uBurst: { value: 0 },
      uOpacity: { value: 1 },
      uIce: { value: C.ice.clone() },
      uChampagne: { value: C.champagne.clone() },
      uFrostCol: { value: C.needleFrost.clone() },
      uDeepA: { value: new THREE.Color(0x08301f) }, uMidA: { value: new THREE.Color(0x12532f) }, uAmtA: { value: 0 },
      uDeepB: { value: new THREE.Color(0x08301f) }, uMidB: { value: new THREE.Color(0x12532f) }, uAmtB: { value: 0 },
      uWarmA: { value: new THREE.Color(0xffe6bd) }, uCoolA: { value: new THREE.Color(0xa8dfff) },
      uCosA: { value: new THREE.Color(0x113f86) }, uFrostA: { value: C.needleFrost.clone() },
      uWarmB: { value: new THREE.Color(0xffe6bd) }, uCoolB: { value: new THREE.Color(0xa8dfff) },
      uCosB: { value: new THREE.Color(0x113f86) }, uFrostB: { value: C.needleFrost.clone() },
      uWaveY: { value: -999 },
      uCharge: { value: 0 },
      uSpillPos: { value: new Array(8).fill(0).map(() => new THREE.Vector3()) },
      uSpillCol: { value: new Array(8).fill(0).map(() => new THREE.Color(0, 0, 0)) },
      uSpillInt: { value: new Float32Array(8) },
    },
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 1;
  mesh.name = 'needles';

  return {
    mesh,
    count,
    update(time) { mat.uniforms.uTime.value = time; },
    setMorph(m) {
      mat.uniforms.uMorph.value = m;
      mat.depthWrite = m < 0.32;
    },
    setBurst(v) { mat.uniforms.uBurst.value = v; },
    setCharge(v) { mat.uniforms.uCharge.value = v; },
    setEffects(on) { mat.uniforms.uFrost.value = on ? 1 : 0.45; },
    setTheme(from, to, waveY) {
      const u = mat.uniforms;
      u.uDeepA.value.copy(from.deep); u.uMidA.value.copy(from.mid); u.uAmtA.value = from.amount;
      u.uDeepB.value.copy(to.deep);   u.uMidB.value.copy(to.mid);   u.uAmtB.value = to.amount;
      u.uWarmA.value.copy(from.light1); u.uCoolA.value.copy(from.light2); u.uCosA.value.copy(from.glass);
      u.uWarmB.value.copy(to.light1);   u.uCoolB.value.copy(to.light2);   u.uCosB.value.copy(to.glass);
      u.uFrostA.value.copy(from.amount > 0 ? from.light2 : C.needleFrost);
      u.uFrostB.value.copy(to.amount > 0 ? to.light2 : C.needleFrost);
      u.uWaveY.value = waveY;
    },
    refreshSpill(spillCol) {
      for (let i = 0; i < 8; i++) mat.uniforms.uSpillCol.value[i].copy(spillCol[i]);
    },
    bindSpill({ spillPos, spillCol, spillInt }) {
      for (let i = 0; i < 8; i++) {
        mat.uniforms.uSpillPos.value[i].copy(spillPos[i]);
        mat.uniforms.uSpillCol.value[i].copy(spillCol[i]);
      }
      mat.uniforms.uSpillInt.value = spillInt;
    },
  };
}
