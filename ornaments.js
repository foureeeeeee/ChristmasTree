import * as THREE from 'three';
import { TREE, QUALITY, radiusAt } from './config.js';
import { C } from './palette.js';
import { makeRng, lerp, clamp, rr, smoothstep, waveAmount, snowflakeTexture, softSprite } from './utils.js';
import { ORNAMENT_MEMORIES, WISHES } from './content.js';

/* ------------------------------------------------------------------
   Traditional ornaments, hung on real branches.
   Every ornament knows the branch point it hangs from, so it swings
   from that pivot like a pendulum and its wire hook follows it.
   ------------------------------------------------------------------ */

const DOWN = new THREE.Vector3(0, -1, 0);
const WHITE = new THREE.Color(0xffffff);

function starShape(outer = 1, inner = 0.44) {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i / 10) * Math.PI * 2;
    const r = i % 2 === 0 ? outer : inner;
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    i === 0 ? s.moveTo(x, y) : s.lineTo(x, y);
  }
  s.closePath();
  return s;
}

function snowflakeOrnamentGeometry() {
  const g = new THREE.PlaneGeometry(1, 1);
  return g;
}

export function buildOrnaments(tree) {
  const rnd = makeRng(TREE.seed + 404);
  const group = new THREE.Group();
  group.name = 'ornaments';

  /* ---------- pick hanging points on the actual branches ---------- */
  const candidates = [];
  for (const b of tree.branches) {
    if (b.length < TREE.baseRadius * 0.42) continue;      // too short to carry one
    if (b.y > TREE.height * 0.93) continue;               // keep the very tip clear
    const n = b.length > TREE.baseRadius * 0.8 ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const t = rr(rnd, 0.5, 0.93);
      const p = b.curve.getPointAt(t);
      candidates.push({ p, branch: b, t, score: rnd() + clamp(b.length / TREE.baseRadius) * 0.4 });
    }
  }
  candidates.sort((a, b2) => b2.score - a.score);

  const wantBaubles = QUALITY.baubles;
  const wantFlakes = QUALITY.flakes;
  const wantStars = Math.round(wantFlakes * 0.5);
  const wantTotal = wantBaubles + wantFlakes + wantStars;

  // spread the chosen points out so ornaments never bunch together
  const chosen = [];
  const minDist = TREE.baseRadius * 0.22;
  for (const c of candidates) {
    if (chosen.length >= wantTotal) break;
    let ok = true;
    for (const o of chosen) { if (o.p.distanceToSquared(c.p) < minDist * minDist) { ok = false; break; } }
    if (ok) chosen.push(c);
  }
  while (chosen.length < wantTotal && candidates.length) chosen.push(candidates[(rnd() * candidates.length) | 0]);

  /* ---------- materials: a variety of traditional finishes ---------- */
  const mk = (o) => new THREE.MeshPhysicalMaterial({ ...o });
  const BAUBLE_TYPES = [
    { name: 'Sapphire bauble', slot: 'glass', base: 0x113f86, w: 0.26, size: [0.145, 0.235],
      mat: mk({ metalness: 0.42, roughness: 0.055, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 2.5, transparent: true }) },
    { name: 'Silver bauble', slot: 'metal', base: 0xd7e2f0, w: 0.22, size: [0.14, 0.225],
      mat: mk({ metalness: 1.0, roughness: 0.13, envMapIntensity: 2.1, transparent: true }) },
    { name: 'Crystal bauble', slot: 'light2', base: 0xe8f4ff, w: 0.16, size: [0.13, 0.205],
      mat: mk({ metalness: 0.12, roughness: 0.02, clearcoat: 1, envMapIntensity: 3.1, transparent: true, opacity: 0.46 }) },
    { name: 'Frosted glass', slot: 'metal', base: 0xc8dcee, w: 0.16, size: [0.145, 0.225],
      mat: mk({ metalness: 0.06, roughness: 0.66, clearcoat: 0.4, envMapIntensity: 1.1, transparent: true, opacity: 0.93 }) },
    { name: 'Mirrored ornament', slot: 'light1', base: 0xf2f7ff, w: 0.1, size: [0.075, 0.115],
      mat: mk({ metalness: 1.0, roughness: 0.015, envMapIntensity: 2.8, transparent: true }) },
    { name: 'Midnight bauble', slot: 'ribbonB', base: 0x08203f, w: 0.1, size: [0.15, 0.24],
      mat: mk({ metalness: 0.55, roughness: 0.09, clearcoat: 1, envMapIntensity: 2.2, transparent: true }) },
  ];
  BAUBLE_TYPES.forEach((t) => { t.mat.color.set(0xffffff); t.baseColor = new THREE.Color(t.base); });

  const sphereGeo = new THREE.SphereGeometry(1, QUALITY.tier === 'low' ? 14 : 22, QUALITY.tier === 'low' ? 10 : 15);
  const capGeo = new THREE.CylinderGeometry(0.33, 0.4, 0.42, 10);
  capGeo.translate(0, 1.08, 0);
  const ringGeo = new THREE.TorusGeometry(0.26, 0.055, 6, 12);
  ringGeo.rotateY(Math.PI / 2);
  ringGeo.translate(0, 1.44, 0);
  const capMerged = mergeTwo(capGeo, ringGeo);

  const flakeTexA = snowflakeTexture(160, 11);
  const flakeTexB = snowflakeTexture(160, 29);
  const flakeMatA = new THREE.MeshStandardMaterial({
    map: flakeTexA, alphaMap: flakeTexA, transparent: true, alphaTest: 0.08,
    color: 0xffffff, metalness: 0.75, roughness: 0.28, envMapIntensity: 1.8,
    side: THREE.DoubleSide, emissive: new THREE.Color(0x12406e), emissiveIntensity: 0.4,
  });
  const flakeMatB = flakeMatA.clone();
  flakeMatB.map = flakeMatB.alphaMap = flakeTexB;
  const FLAKE_BASE_A = new THREE.Color(0xeaf4ff);
  const FLAKE_BASE_B = new THREE.Color(0xbfe4ff);

  const miniStarGeo = new THREE.ExtrudeGeometry(starShape(1, 0.44), {
    depth: 0.17, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.06, bevelSegments: 2, curveSegments: 1,
  });
  miniStarGeo.center();
  const miniStarMat = mk({ color: 0xffffff, metalness: 0.95, roughness: 0.17, envMapIntensity: 2.3, transparent: true, emissive: new THREE.Color(0x1d4f8c), emissiveIntensity: 0.5 });
  const MINISTAR_BASE = new THREE.Color(0xe6eef9);

  /* ---------- build the instanced meshes ---------- */
  const meshes = [];
  const items = [];

  const bauCounts = BAUBLE_TYPES.map(() => 0);
  const assign = [];
  for (let i = 0; i < wantBaubles; i++) {
    let r = rnd(), k = 0;
    for (let j = 0; j < BAUBLE_TYPES.length; j++) { r -= BAUBLE_TYPES[j].w; if (r <= 0) { k = j; break; } }
    assign.push(k); bauCounts[k]++;
  }

  const bauMeshes = BAUBLE_TYPES.map((tp, k) => {
    const m = new THREE.InstancedMesh(sphereGeo, tp.mat, Math.max(1, bauCounts[k]));
    m.count = bauCounts[k];
    m.name = `bauble-${k}`;
    m.userData.kind = 'bauble';
    group.add(m);
    meshes.push(m);
    return m;
  });
  const capMat = mk({ color: 0xffffff, metalness: 1, roughness: 0.3, envMapIntensity: 1.6, transparent: true });
  const CAP_BASE = new THREE.Color(0xcfdbea);
  const capMesh = new THREE.InstancedMesh(capMerged, capMat, Math.max(1, wantBaubles));
  capMesh.count = wantBaubles;
  capMesh.userData.kind = 'cap';
  group.add(capMesh);

  const flakeGeo = snowflakeOrnamentGeometry();
  const flakeMeshA = new THREE.InstancedMesh(flakeGeo, flakeMatA, Math.max(1, Math.ceil(wantFlakes / 2)));
  const flakeMeshB = new THREE.InstancedMesh(flakeGeo, flakeMatB, Math.max(1, Math.floor(wantFlakes / 2)));
  flakeMeshA.count = Math.ceil(wantFlakes / 2);
  flakeMeshB.count = Math.floor(wantFlakes / 2);
  [flakeMeshA, flakeMeshB].forEach((m, i) => { m.name = `flake-${i}`; m.userData.kind = 'flake'; group.add(m); meshes.push(m); });

  const starMesh = new THREE.InstancedMesh(miniStarGeo, miniStarMat, Math.max(1, wantStars));
  starMesh.count = wantStars;
  starMesh.name = 'ministar';
  starMesh.userData.kind = 'ministar';
  group.add(starMesh);
  meshes.push(starMesh);

  /* ---------- lay them out ---------- */
  const bauIdx = BAUBLE_TYPES.map(() => 0);
  let flakeA = 0, flakeB = 0, starI = 0;
  let memI = 0, wishI = 0;

  for (let i = 0; i < chosen.length; i++) {
    const c = chosen[i];
    const common = {
      pivot: c.p.clone(),
      hang: rr(rnd, 0.1, 0.25),
      phase: rr(rnd, 0, Math.PI * 2),
      freq: rr(rnd, 0.5, 0.95),
      amp: rr(rnd, 0.035, 0.11),
      spin: rr(rnd, -0.22, 0.22),
      stagger: rnd(),
      branchT: c.t,
    };

    if (i < wantBaubles) {
      const k = assign[i];
      const tp = BAUBLE_TYPES[k];
      const radius = rr(rnd, tp.size[0], tp.size[1]);
      const mem = ORNAMENT_MEMORIES[memI % ORNAMENT_MEMORIES.length];
      memI++;
      items.push({
        ...common, mesh: bauMeshes[k], idx: bauIdx[k]++, radius,
        capIdx: i, kind: 'bauble', typeName: tp.name,
        slot: tp.slot, baseColor: tp.baseColor,
        content: { ...mem, kicker: mem.kicker || tp.name },
        hover: mem.title,
        lucky: memI === 13,
      });
    } else if (i < wantBaubles + wantFlakes) {
      const useA = (i - wantBaubles) % 2 === 0;
      const radius = rr(rnd, 0.1, 0.165);
      const w = WISHES[wishI % WISHES.length]; wishI++;
      items.push({
        ...common, mesh: useA ? flakeMeshA : flakeMeshB,
        idx: useA ? flakeA++ : flakeB++, radius: radius * 2.1, flat: true,
        slot: 'metal', baseColor: useA ? FLAKE_BASE_A : FLAKE_BASE_B,
        kind: 'flake', content: w, hover: 'A Christmas wish', spin: rr(rnd, -0.5, 0.5),
      });
    } else {
      const radius = rr(rnd, 0.085, 0.13);
      const mem = ORNAMENT_MEMORIES[memI % ORNAMENT_MEMORIES.length]; memI++;
      items.push({
        ...common, mesh: starMesh, idx: starI++, radius: radius * 1.5, flat: true,
        slot: 'light1', baseColor: MINISTAR_BASE,
        kind: 'ministar', content: { ...mem, kicker: 'Star ornament' }, hover: mem.title,
      });
    }
  }

  /* ---------- hook wires ---------- */
  const wirePos = new Float32Array(items.length * 6);
  const wireGeo = new THREE.BufferGeometry();
  wireGeo.setAttribute('position', new THREE.BufferAttribute(wirePos, 3));
  const wireMat = new THREE.LineBasicMaterial({ color: 0x8fa6c4, transparent: true, opacity: 0.55 });
  const wires = new THREE.LineSegments(wireGeo, wireMat);
  wires.frustumCulled = false;
  group.add(wires);

  /* ---------- snow resting on some branches ---------- */
  const snowGeo = new THREE.SphereGeometry(1, 9, 6);
  {
    const pa = snowGeo.attributes.position;
    for (let i = 0; i < pa.count; i++) {
      const x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i);
      const n = 0.82 + 0.3 * Math.abs(Math.sin(x * 7.3 + z * 5.1 + y * 3.7));
      pa.setXYZ(i, x * n * 1.5, Math.max(-0.18, y * n * 0.5), z * n * 1.5);
    }
    snowGeo.computeVertexNormals();
  }
  const snowMat = new THREE.MeshStandardMaterial({
    color: 0xeef5ff, roughness: 0.82, metalness: 0.02,
    envMapIntensity: 0.5, transparent: true,
    emissive: new THREE.Color(0x0b2246), emissiveIntensity: 0.4,
  });
  const clumps = [];
  const snowMesh = new THREE.InstancedMesh(snowGeo, snowMat, Math.max(1, QUALITY.snowClumps));
  snowMesh.count = 0;
  group.add(snowMesh);
  {
    const tmp = new THREE.Object3D();
    let n = 0;
    const pool = [];
    for (const b of tree.branches) {
      const steps = 4;
      for (let s = 1; s <= steps; s++) {
        const t = s / (steps + 1);
        const p = b.curve.getPointAt(t);
        const tan = b.curve.getTangent(t);
        const flatness = 1 - Math.abs(tan.y);          // flat stretches hold snow
        pool.push({ p, w: flatness * (0.4 + rnd()), t, len: b.length });
      }
    }
    pool.sort((a, b2) => b2.w - a.w);
    for (const c of pool) {
      if (n >= QUALITY.snowClumps) break;
      if (rnd() > 0.72) continue;
      const sc = rr(rnd, 0.04, 0.095) * (0.6 + clamp(c.len / TREE.baseRadius));
      tmp.position.copy(c.p).add(new THREE.Vector3(0, sc * 0.35, 0));
      tmp.rotation.set(rr(rnd, -0.2, 0.2), rr(rnd, 0, 6.28), rr(rnd, -0.2, 0.2));
      tmp.scale.setScalar(sc);
      tmp.updateMatrix();
      snowMesh.setMatrixAt(n, tmp.matrix);
      clumps.push({ m: tmp.matrix.clone(), stagger: rnd() });
      n++;
    }
    snowMesh.count = n;
    snowMesh.instanceMatrix.needsUpdate = true;
    snowMesh.computeBoundingSphere();
  }

  /* ---------- particles the ornaments emit while transforming ---------- */
  const per = QUALITY.tier === 'low' ? 10 : 16;
  const pCount = items.length * per;
  const pPos = new Float32Array(pCount * 3);
  const pCol = new Float32Array(pCount * 3);
  const pSize = new Float32Array(pCount);
  const pSeed = new Float32Array(pCount * 3);
  for (let i = 0; i < pCount; i++) {
    const dir = new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize()
      .multiplyScalar(rr(rnd, 0.5, 1));
    pSeed[i * 3] = dir.x; pSeed[i * 3 + 1] = dir.y; pSeed[i * 3 + 2] = dir.z;
    pSize[i] = rr(rnd, 0.025, 0.075);
    const col = C.ice.clone().lerp(C.champagne, rnd() * 0.8);
    pCol[i * 3] = col.r; pCol[i * 3 + 1] = col.g; pCol[i * 3 + 2] = col.b;
  }
  const emitGeo = new THREE.BufferGeometry();
  emitGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  emitGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
  emitGeo.setAttribute('aSize', new THREE.BufferAttribute(pSize, 1));
  const emitMat = new THREE.PointsMaterial({
    size: 0.09, map: softSprite(48, 1, 2.6), transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, vertexColors: true, sizeAttenuation: true, opacity: 0,
  });
  const emitter = new THREE.Points(emitGeo, emitMat);
  emitter.frustumCulled = false;
  emitter.visible = false;
  group.add(emitter);

  /* ---------- per-frame update ---------- */
  const tmpO = new THREE.Object3D();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const off = new THREE.Vector3();
  const tmpC = new THREE.Color();
  let morph = 0;
  let boundsDone = false;

  /* ---------- album colours ---------- */
  const SNOW_BASE = new THREE.Color(0xd9e7fb);
  const WIRE_BASE = new THREE.Color(0x8fa6c4);
  let thFrom = null, thTo = null, waveY = -999, themeDirty = true;

  /** what this ornament becomes under a given album */
  function resolve(item, theme) {
    if (!theme || !theme.amount) return item.baseColor.clone();
    const target = theme[item.slot] || theme.metal;
    return item.baseColor.clone().lerp(target, 0.93);
  }

  function setTheme(from, to, y) {
    const changed = from !== thFrom || to !== thTo;
    thFrom = from; thTo = to; waveY = y;
    if (changed) {
      for (const it of items) { it.colA = resolve(it, from); it.colB = resolve(it, to); }
      capA = from && from.amount ? CAP_BASE.clone().lerp(from.metal, 0.93) : CAP_BASE.clone();
      capB = to && to.amount ? CAP_BASE.clone().lerp(to.metal, 0.93) : CAP_BASE.clone();
      snowA = from && from.amount ? SNOW_BASE.clone().lerp(from.light2, 0.55) : SNOW_BASE.clone();
      snowB = to && to.amount ? SNOW_BASE.clone().lerp(to.light2, 0.55) : SNOW_BASE.clone();
      wireA = from && from.amount ? WIRE_BASE.clone().lerp(from.metal, 0.8) : WIRE_BASE.clone();
      wireB = to && to.amount ? WIRE_BASE.clone().lerp(to.metal, 0.8) : WIRE_BASE.clone();
    }
    themeDirty = true;
  }
  let capA = CAP_BASE.clone(), capB = CAP_BASE.clone();
  let snowA = SNOW_BASE.clone(), snowB = SNOW_BASE.clone();
  let wireA = WIRE_BASE.clone(), wireB = WIRE_BASE.clone();
  for (const it of items) { it.colA = it.baseColor.clone(); it.colB = it.baseColor.clone(); }

  function update(time) {
    const base = 1 - morph;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const local = smoothstep(clamp((morph * 1.7 - it.stagger * 0.55) / 0.7));
      const shrink = 1 - local;

      const ax = Math.sin(time * it.freq + it.phase) * it.amp;
      const az = Math.cos(time * it.freq * 0.81 + it.phase * 1.7) * it.amp * 0.72;
      e.set(ax, time * it.spin, az);
      q.setFromEuler(e);
      off.copy(DOWN).multiplyScalar(it.hang + it.radius).applyQuaternion(q);

      tmpO.position.copy(it.pivot).add(off);
      // ornaments drift outward a little as they dissolve
      if (local > 0.001) {
        const r = Math.hypot(tmpO.position.x, tmpO.position.z) || 1;
        tmpO.position.x += (tmpO.position.x / r) * local * 0.25;
        tmpO.position.z += (tmpO.position.z / r) * local * 0.25;
      }
      it.world = it.world || new THREE.Vector3();
      it.world.copy(tmpO.position);
      it.localMorph = local;

      tmpO.quaternion.copy(q);
      if (it.flat) tmpO.rotateX(Math.sin(time * 0.3 + it.phase) * 0.12);

      /* the colour wave gives each ornament a little shiver as it passes */
      const wAmt = waveAmount(it.pivot.y, waveY);
      const pop = waveY <= -900 ? 0 : Math.exp(-Math.pow((it.pivot.y - waveY) * 1.3, 2));
      if (themeDirty || pop > 0.002) {
        tmpC.copy(it.colA).lerp(it.colB, wAmt);
        if (pop > 0.002) tmpC.lerp(WHITE, pop * 0.55);
        it.mesh.setColorAt(it.idx, tmpC);
        it.mesh.instanceColor.needsUpdate = true;
        if (it.kind === 'bauble') {
          tmpC.copy(capA).lerp(capB, wAmt);
          capMesh.setColorAt(it.capIdx, tmpC);
          capMesh.instanceColor.needsUpdate = true;
        }
      }

      const s = it.radius * Math.max(0.0001, shrink) * (it.lucky ? 1.12 : 1) * (1 + pop * 0.3);
      tmpO.scale.set(s, s, it.flat ? s * 0.12 : s);
      tmpO.updateMatrix();
      it.mesh.setMatrixAt(it.idx, tmpO.matrix);

      if (it.kind === 'bauble') {
        tmpO.scale.set(s, s, s);
        tmpO.updateMatrix();
        capMesh.setMatrixAt(it.capIdx, tmpO.matrix);
      }

      // hook wire from branch to ornament cap
      const o = i * 6;
      wirePos[o] = it.pivot.x; wirePos[o + 1] = it.pivot.y; wirePos[o + 2] = it.pivot.z;
      const topY = it.pivot.y + (tmpO.position.y - it.pivot.y) * 0.84;
      wirePos[o + 3] = it.pivot.x + (tmpO.position.x - it.pivot.x) * 0.84;
      wirePos[o + 4] = topY;
      wirePos[o + 5] = it.pivot.z + (tmpO.position.z - it.pivot.z) * 0.84;
    }

    for (const m of [...bauMeshes, flakeMeshA, flakeMeshB, starMesh, capMesh]) {
      m.instanceMatrix.needsUpdate = true;
    }
    wires.geometry.attributes.position.needsUpdate = true;
    wireMat.opacity = 0.55 * base;
    if (themeDirty) {
      const mid = waveAmount(TREE.height * 0.45, waveY);
      wireMat.color.copy(wireA).lerp(wireB, mid);
      snowMat.color.copy(snowA).lerp(snowB, mid);
      if (waveY <= -900) themeDirty = false;
    }

    if (!boundsDone) {
      [...bauMeshes, flakeMeshA, flakeMeshB, starMesh].forEach((m) => m.count && m.computeBoundingSphere());
      boundsDone = true;
    }

    // snow clumps melt away in cosmic mode
    if (snowMesh.count) {
      const sm = 1 - smoothstep(clamp(morph * 1.5));
      snowMesh.visible = sm > 0.02;
      snowMat.opacity = sm;
      snowMat.transparent = sm < 0.995;
    }

    // emitted sparks
    if (morph > 0.002 && morph < 0.999) {
      emitter.visible = true;
      const amp = Math.sin(Math.PI * clamp(morph * 1.15)) ;
      emitMat.opacity = clamp(amp * 1.15);
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        const w = it.world; if (!w) continue;
        const spread = 0.12 + it.localMorph * 0.9;
        for (let k = 0; k < per; k++) {
          const j = i * per + k;
          const ph = (time * 0.55 + k * 0.137 + it.stagger) % 1;
          const d = spread * ph;
          pPos[j * 3] = w.x + pSeed[j * 3] * d;
          pPos[j * 3 + 1] = w.y + pSeed[j * 3 + 1] * d + ph * 0.18;
          pPos[j * 3 + 2] = w.z + pSeed[j * 3 + 2] * d;
        }
      }
      emitGeo.attributes.position.needsUpdate = true;
    } else {
      emitter.visible = false;
    }
  }

  return {
    group,
    items,
    pickables: [...bauMeshes, flakeMeshA, flakeMeshB, starMesh],
    update,
    setMorph(m) { morph = m; },
    setTheme,
    setEffects(on) { if (!on) emitter.visible = false; },
    findItem(mesh, instanceId) {
      return items.find((it) => it.mesh === mesh && it.idx === instanceId) || null;
    },
  };
}

function mergeTwo(a, b) {
  const g = new THREE.BufferGeometry();
  const pa = a.attributes.position.array, pb = b.attributes.position.array;
  const na = a.attributes.normal.array, nb = b.attributes.normal.array;
  const ia = a.index ? Array.from(a.index.array) : null;
  const ib = b.index ? Array.from(b.index.array) : null;
  const pos = new Float32Array(pa.length + pb.length);
  pos.set(pa); pos.set(pb, pa.length);
  const nor = new Float32Array(na.length + nb.length);
  nor.set(na); nor.set(nb, na.length);
  const offset = pa.length / 3;
  const idx = (ia || []).concat((ib || []).map((v) => v + offset));
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  const uvCount = (pa.length + pb.length) / 3;
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvCount * 2), 2));
  if (idx.length) g.setIndex(idx);
  return g;
}
