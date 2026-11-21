import * as THREE from 'three';
import * as BGU from 'three/addons/utils/BufferGeometryUtils.js';
import { TREE, QUALITY, radiusAt } from './config.js';
import { C } from './palette.js';
import { makeRng, lerp, rr, clamp, taperedTube } from './utils.js';

/* ------------------------------------------------------------------
   A procedural fir: distinct whorls of branches, each with its own
   geometry and its own slightly different wood colour, plus a looser
   set of infill branches so the foliage reads dense and irregular
   rather than stacked and tidy.
   ------------------------------------------------------------------ */

const UP = new THREE.Vector3(0, 1, 0);

function buildBranch(rnd, { y, angle, layer, lengthScale, droopBias }) {
  const t = clamp(y / TREE.height);
  const L = radiusAt(y) * lengthScale * rr(rnd, 0.88, 1.12);

  const dir = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
  const side = new THREE.Vector3().crossVectors(UP, dir).normalize();

  // Lower branches lift a little then droop; upper branches sweep up.
  const riseA = lerp(0.07, 0.15, t);
  const riseB = lerp(0.04, 0.21, t);
  const tipY = lerp(-0.17, 0.16, Math.pow(t, 1.1)) + droopBias;

  const root = new THREE.Vector3(
    dir.x * TREE.trunkRadius * 0.85,
    y + rr(rnd, -0.05, 0.05),
    dir.z * TREE.trunkRadius * 0.85
  );
  const sweep = rr(rnd, -0.11, 0.11);
  const p1 = root.clone().addScaledVector(dir, L * 0.33).addScaledVector(UP, L * riseA)
    .addScaledVector(side, L * sweep * 0.35);
  const p2 = root.clone().addScaledVector(dir, L * 0.71).addScaledVector(UP, L * riseB)
    .addScaledVector(side, L * sweep * 0.8);
  const p3 = root.clone().addScaledVector(dir, L).addScaledVector(UP, L * tipY)
    .addScaledVector(side, L * sweep);

  const curve = new THREE.CatmullRomCurve3([root, p1, p2, p3], false, 'catmullrom', 0.5);
  curve.arcLengthDivisions = 24;

  const branch = { curve, length: L, layer, y, angle, dir, side, t, twigs: [] };

  // --- side twigs, alternating left and right along the branch ---
  const nTwigs = Math.round(lerp(3, 7, clamp(L / TREE.baseRadius)) * rr(rnd, 0.8, 1.25));
  for (let k = 0; k < nTwigs; k++) {
    const tp = lerp(0.16, 0.94, (k + rr(rnd, 0.1, 0.9)) / Math.max(1, nTwigs));
    const at = curve.getPoint(tp);
    const tan = curve.getTangent(tp).normalize();
    const localSide = new THREE.Vector3().crossVectors(UP, tan).normalize();
    const flip = k % 2 === 0 ? 1 : -1;
    const spread = rr(rnd, 0.62, 1.05) * flip;
    const tl = L * (1 - tp) * rr(rnd, 0.34, 0.62) + 0.06;

    const d = tan.clone().multiplyScalar(0.62)
      .addScaledVector(localSide, spread)
      .addScaledVector(UP, rr(rnd, -0.18, 0.22))
      .normalize();

    const q0 = at.clone();
    const q1 = q0.clone().addScaledVector(d, tl * 0.52).addScaledVector(UP, tl * 0.08);
    const q2 = q0.clone().addScaledVector(d, tl).addScaledVector(UP, -tl * rr(rnd, 0.05, 0.2));
    const tc = new THREE.CatmullRomCurve3([q0, q1, q2], false, 'catmullrom', 0.5);
    tc.arcLengthDivisions = 12;
    branch.twigs.push({ curve: tc, length: tl, layer, parentT: tp });
  }
  return branch;
}

export function buildTree() {
  const rnd = makeRng(TREE.seed);
  const branches = [];
  const n = TREE.whorls;

  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const y = lerp(TREE.firstWhorlY, TREE.lastWhorlY, Math.pow(t, 0.88));
    const count = Math.max(3, Math.round(lerp(11, 4, Math.pow(t, 0.8))));
    const baseRot = i * 2.39996 + rr(rnd, 0, 0.6);

    for (let j = 0; j < count; j++) {
      const angle = baseRot + (j / count) * Math.PI * 2 + rr(rnd, -0.3, 0.3) / count * Math.PI * 2;
      branches.push(buildBranch(rnd, {
        y, angle, layer: i, lengthScale: rr(rnd, 0.96, 1.06), droopBias: 0,
      }));
    }

    // --- infill: shorter branches half a whorl up, filling the gaps ---
    if (i < n - 1) {
      const y2 = lerp(y, lerp(TREE.firstWhorlY, TREE.lastWhorlY, Math.pow((i + 1) / (n - 1), 0.88)), 0.5);
      const c2 = Math.max(2, Math.round(count * 0.8));
      const rot2 = baseRot + Math.PI / count;
      for (let j = 0; j < c2; j++) {
        const angle = rot2 + (j / c2) * Math.PI * 2 + rr(rnd, -0.4, 0.4) / c2 * Math.PI * 2;
        branches.push(buildBranch(rnd, {
          y: y2, angle, layer: i, lengthScale: rr(rnd, 0.58, 0.82),
          droopBias: rr(rnd, -0.06, 0.02),
        }));
      }
    }
  }

  // --- inner sprigs: short growth close to the trunk so the canopy
  //     has depth and the trunk never shows through a gap ---
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const y0 = lerp(TREE.firstWhorlY, TREE.lastWhorlY, Math.pow(t, 0.88));
    const per = Math.max(3, Math.round(lerp(7, 3, t)));
    for (let j = 0; j < per; j++) {
      branches.push(buildBranch(rnd, {
        y: y0 + rr(rnd, -0.25, 0.55),
        angle: rr(rnd, 0, Math.PI * 2),
        layer: i,
        lengthScale: rr(rnd, 0.26, 0.52),
        droopBias: rr(rnd, -0.1, 0.06),
      }));
    }
  }

  // --- the leader: a few short sprigs right at the pointed top ---
  for (let j = 0; j < 7; j++) {
    const y = lerp(TREE.lastWhorlY, TREE.height - 0.22, j / 7);
    branches.push(buildBranch(rnd, {
      y, angle: j * 2.39996 + 1.1, layer: n - 1,
      lengthScale: rr(rnd, 0.7, 1.0), droopBias: 0.22,
    }));
  }

  /* ---------------- woody geometry ---------------- */
  const parts = [];
  const layerColor = (layer, kind) => {
    const t = layer / (n - 1);
    const col = C.bark.clone().lerp(C.barkLight, t * 0.55 + (kind === 'twig' ? 0.25 : 0));
    col.lerp(C.needleBlue, 0.14 + t * 0.12);
    return col;
  };

  for (const b of branches) {
    const r0 = 0.016 + 0.032 * clamp(b.length / TREE.baseRadius);
    const g = taperedTube(b.curve, QUALITY.branchSegs, 5, r0, r0 * 0.16, 1.1);
    paint(g, layerColor(b.layer, 'branch'));
    parts.push(g);
    for (const tw of b.twigs) {
      const tg = taperedTube(tw.curve, QUALITY.twigSegs, 3, 0.0085, 0.0018, 1.0);
      paint(tg, layerColor(b.layer, 'twig'));
      parts.push(tg);
    }
  }

  // trunk, slightly tapered, with a stump below the branches
  const trunkCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -0.1, 0),
    new THREE.Vector3(0.02, TREE.height * 0.35, 0.01),
    new THREE.Vector3(-0.02, TREE.height * 0.7, -0.015),
    new THREE.Vector3(0, TREE.height - 0.05, 0),
  ], false, 'catmullrom', 0.5);
  trunkCurve.arcLengthDivisions = 32;
  const trunkG = taperedTube(trunkCurve, 26, 10, TREE.trunkRadius, 0.01, 0.6);
  paint(trunkG, C.bark.clone().lerp(C.needleDark, 0.25));
  parts.push(trunkG);

  const wood = BGU.mergeGeometries(parts, false);
  wood.computeBoundingSphere();
  parts.forEach((p) => p.dispose());

  return { branches, wood, radiusAt, whorls: n };
}

function paint(g, color) {
  const count = g.attributes.position.count;
  const arr = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) { arr[i * 3] = color.r; arr[i * 3 + 1] = color.g; arr[i * 3 + 2] = color.b; }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
}

export function woodMaterial() {
  return new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.84,
    metalness: 0.04,
    transparent: true,
    opacity: 1,
  });
}
