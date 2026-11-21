import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { TREE, QUALITY, CAM } from './config.js';
import { C } from './palette.js';
import { clamp, lerp, easeInOut } from './utils.js';
import { buildTree, woodMaterial } from './tree.js';
import { buildNeedles } from './needles.js';
import { buildOrnaments } from './ornaments.js';
import { buildFairyLights } from './lights.js';
import { buildRibbons } from './ribbons.js';
import { buildStar } from './star.js';
import { buildPresents } from './presents.js';
import { buildBase } from './base.js';
import { envFactory, buildSky, buildStars, buildSnowfall, buildMist, buildShootingStars } from './env.js';
import { createUI } from './ui.js';
import { createInteractions } from './interactions.js';
import { buildConstellation } from './constellation.js';
import { buildSupernova } from './supernova.js';
import { createTimeline } from './timeline.js';
import { HOUSE, ALBUMS } from './albums.js';
import { THIRTEENTH_MESSAGE } from './content.js';

/* Yield to the browser so the loader can paint between build steps.
   requestAnimationFrame alone stalls in a throttled background tab,
   so whichever comes first wins. */
const nextFrame = () => new Promise((r) => {
  let done = false;
  const fin = () => { if (!done) { done = true; r(); } };
  requestAnimationFrame(fin);
  setTimeout(fin, 90);
});
const remap = (v, a, b) => clamp((v - a) / (b - a));

const GRADE = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uVignette: { value: 0.9 },
    uGrain: { value: 0.035 },
    uMorph: { value: 0 },
    uTint: { value: new THREE.Color(0xffffff) },
    uTintAmt: { value: 0 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: /* glsl */`
    precision highp float;
    uniform sampler2D tDiffuse;
    uniform float uTime, uVignette, uGrain, uMorph, uTintAmt;
    uniform vec3 uTint;
    varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
    void main(){
      vec2 uv = vUv;
      vec3 col = texture2D(tDiffuse, uv).rgb;

      /* a whisper of chromatic separation towards the corners */
      vec2 d = uv - 0.5;
      float r2 = dot(d, d);
      float ab = (0.0012 + 0.0018 * uMorph) * r2 * 6.0;
      col.r = texture2D(tDiffuse, uv + d * ab).r;
      col.b = texture2D(tDiffuse, uv - d * ab).b;

      /* cold shadows, warm highlights — and when an album is on, its
         own colour takes over the shadow end instead of the house blue */
      float l = dot(col, vec3(0.299, 0.587, 0.114));
      vec3 cold = mix(vec3(0.90, 0.97, 1.12), uTint, clamp(uTintAmt * 3.2, 0.0, 1.0));
      col = mix(col * cold, col * vec3(1.05, 1.0, 0.95), smoothstep(0.25, 0.95, l));

      /* the album's own colour, breathed over the whole frame */
      col = mix(col, col * uTint * 1.25, uTintAmt);

      col *= mix(1.0, 1.0 - r2 * 1.35, uVignette);
      col += (h(uv * 1024.0 + fract(uTime) * 100.0) - 0.5) * uGrain;
      gl_FragColor = vec4(col, 1.0);
    }`,
};

async function boot() {
  const canvas = document.getElementById('scene');

  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: QUALITY.tier !== 'low',
    powerPreference: 'high-performance', alpha: false, stencil: false,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, QUALITY.dpr));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.06;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x030817, 0.017);

  const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 200);
  camera.position.set(...CAM.start.pos);
  camera.aspect = window.innerWidth / window.innerHeight;

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(...CAM.start.target);
  controls.enableDamping = true;
  controls.dampingFactor = 0.055;
  controls.rotateSpeed = 0.62;
  controls.zoomSpeed = 0.75;
  controls.panSpeed = 0.5;
  controls.enablePan = false;
  controls.minDistance = CAM.minDist;
  controls.maxDistance = CAM.maxDist;
  controls.minPolarAngle = CAM.minPolar;
  controls.maxPolarAngle = CAM.maxPolar;
  controls.autoRotate = true;
  controls.autoRotateSpeed = CAM.autoSpeed;
  controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_ROTATE };

  const state = { morph: 0, spin: true, effects: true, wall: false };

  const ui = createUI({
    onMode: () => setMode(state.morphTarget !== 1),
    onSpin: () => { state.spin = !state.spin; controls.autoRotate = state.spin; ui.setSpin(state.spin); },
    onReset: () => resetCamera(),
    onEffects: () => setEffects(!state.effects),
    onCardClose: () => interactions.release(),
  });

  /* ---------------- build the world ---------------- */
  ui.setLoaderText('weaving the winter sky…');
  await nextFrame();
  const envFor = envFactory(renderer);
  scene.environment = envFor(HOUSE);

  const sky = buildSky();
  scene.add(sky.mesh);
  const stars = buildStars();
  scene.add(stars.points);

  ui.setLoaderText('growing the branches…');
  await nextFrame();
  const tree = buildTree();
  const wood = new THREE.Mesh(tree.wood, woodMaterial());
  wood.name = 'wood';
  scene.add(wood);

  ui.setLoaderText('threading the pine needles…');
  await nextFrame();
  const needles = buildNeedles(tree);
  scene.add(needles.mesh);

  ui.setLoaderText('hanging the baubles…');
  await nextFrame();
  const ornaments = buildOrnaments(tree);
  scene.add(ornaments.group);

  ui.setLoaderText('stringing the fairy lights…');
  await nextFrame();
  const fairy = buildFairyLights(tree);
  scene.add(fairy.points);
  fairy.spill.forEach((l) => scene.add(l));
  needles.bindSpill(fairy);

  ui.setLoaderText('tying the ribbons…');
  await nextFrame();
  const ribbons = buildRibbons();
  scene.add(ribbons.group);

  ui.setLoaderText('lifting the star…');
  await nextFrame();
  const star = buildStar();
  scene.add(star.group);

  ui.setLoaderText('wrapping the presents…');
  await nextFrame();
  const presents = buildPresents();
  scene.add(presents.group);
  const base = buildBase();
  scene.add(base.group);

  ui.setLoaderText('letting it snow…');
  await nextFrame();
  const snowfall = buildSnowfall();
  scene.add(snowfall.group);
  scene.add(snowfall.nearGroup);
  const mist = buildMist();
  scene.add(mist.group);
  const shooting = buildShootingStars();
  scene.add(shooting.points);

  ui.setLoaderText('hanging twelve stars in the sky\u2026');
  await nextFrame();
  const constellation = buildConstellation();
  scene.add(constellation.group);
  const supernova = buildSupernova();
  scene.add(supernova.points);

  /* ---------------- scene lighting ---------------- */
  const hemi = new THREE.HemisphereLight(0x1d4477, 0x070e1c, 0.55);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xc4dcff, 1.15);
  key.position.set(6.5, 11, 8.5);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x5f92d8, 0.42);
  fill.position.set(-8, 5.5, -7);
  scene.add(fill);
  const warm = new THREE.DirectionalLight(0xffd2a0, 0.34);
  warm.position.set(0.5, 2.2, 9);
  scene.add(warm);

  /* the house colours of each lamp, to tween away from and back to */
  const LB = {
    key: new THREE.Color(0xc4dcff),
    fill: new THREE.Color(0x5f92d8),
    warm: new THREE.Color(0xffd2a0),
    hemi: new THREE.Color(0x1d4477),
    hemiG: new THREE.Color(0x070e1c),
  };

  /* ---------------- post-processing ---------------- */
  const composer = new EffectComposer(renderer);
  composer.setPixelRatio(renderer.getPixelRatio());
  composer.setSize(window.innerWidth, window.innerHeight);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight), 0.52, 0.72, 0.64
  );
  composer.addPass(bloom);
  const grade = new ShaderPass(GRADE);
  composer.addPass(grade);
  composer.addPass(new OutputPass());

  /* ---------------- interactions ---------------- */
  const interactions = createInteractions({
    dom: renderer.domElement, camera, controls, ornaments, presents, star,
    constellation, ui, state, onAlbum: (s) => pickAlbum(s),
    canHold: () => !state.wall && !wallBusy && state.morph < 0.12,
  });

  /* ---------------- hold the tree, open the picture wall ----------------
     Holding fills the tree with light from the roots up. When the light
     reaches the star the whole thing breaks open, and the pieces gather
     into the thread the wall hangs from. */
  const timeline = createTimeline({ onClose: () => closeWall() });
  const flashEl = document.getElementById('flash');
  const chargeEl = document.getElementById('charge');
  const CHARGE_TIME = 1.5;
  let charge = 0;
  let wallBusy = false;
  let wallTimers = [];

  function flashScreen(strength = 1, outMs = 1100) {
    flashEl.style.transition = 'none';
    flashEl.style.opacity = '0';
    requestAnimationFrame(() => {
      flashEl.style.transition = 'opacity .2s ease-out';
      flashEl.style.opacity = String(strength);
      wallTimers.push(setTimeout(() => {
        flashEl.style.transition = `opacity ${outMs}ms ease-in`;
        flashEl.style.opacity = '0';
      }, 220));
    });
  }

  const TREE_PARTS = () => [
    wood, needles.mesh, ornaments.group, fairy.points,
    ribbons.group, star.group, presents.group,
  ];
  function setTreeVisible(on) {
    TREE_PARTS().forEach((o) => { if (o) o.visible = on; });
    fairy.spill.forEach((l) => { l.visible = on; });
  }

  function accentColor() {
    /* an album's signature colour, the one its star burns */
    const t = themeState.to;
    return (t.amount ? t.starCol : new THREE.Color(0xa8dfff)).clone();
  }

  function openWall() {
    if (state.wall || wallBusy) return;
    wallBusy = true;
    charge = 0;
    needles.setCharge(0); fairy.setCharge(0);
    interactions.swallowClick();
    ui.hideCard();
    ui.setTooltip(null);
    chargeEl.classList.remove('on');

    const accent = accentColor();
    star.trigger();
    themeFlash = 1;
    supernova.burst(camera, accent);
    flashScreen(1, 1200);

    controls.enabled = false;
    state.spin = false; controls.autoRotate = false; ui.setSpin(false);

    wallTimers.push(setTimeout(() => { setTreeVisible(false); state.wall = true; }, 230));
    wallTimers.push(setTimeout(() => {
      timeline.setAccent(accent);
      timeline.show();
      wallBusy = false;
    }, 1450));
  }

  function closeWall() {
    wallTimers.forEach(clearTimeout);
    wallTimers = [];
    supernova.sendHome();
    flashScreen(0.5, 900);
    wallTimers.push(setTimeout(() => {
      setTreeVisible(true);
      state.wall = false;
      controls.enabled = true;
      state.spin = true; controls.autoRotate = true; ui.setSpin(true);
      wallBusy = false;
    }, 300));
  }

  /* ---------------- the twelve albums ----------------
     Clicking a star sends a thread of light down to the topper; when
     it lands, the star bursts and a wave of that record's colour runs
     all the way down the tree, recolouring everything it passes. */
  const themeState = {
    from: HOUSE, to: HOUSE, waveY: -999, t: 1, dur: 2.1, active: false,
  };
  let themeFlash = 0;
  let themeExposure = 1;

  function pushTheme() {
    const { from, to, waveY } = themeState;
    needles.setTheme(from, to, waveY);
    fairy.setTheme(from, to, waveY);
    needles.refreshSpill(fairy.spillCol);
    ornaments.setTheme(from, to, waveY);
    ribbons.setTheme(from, to, waveY);
    star.setTheme(from, to, waveY);
    presents.setTheme(from, to, waveY);
    base.setTheme(from, to, waveY);
    const w = sky.setTheme(from, to, waveY);
    stars.setTheme(from, to, w);
    mist.setTheme(from, to, w);
    scene.fog.color.copy(from.fog).lerp(to.fog, w);
    const tintA = from.amount ? from.mid : new THREE.Color(0xffffff);
    const tintB = to.amount ? to.mid : new THREE.Color(0xffffff);
    grade.uniforms.uTint.value.copy(tintA).lerp(tintB, w).lerp(new THREE.Color(0xffffff), 0.5);
    grade.uniforms.uTintAmt.value = lerp(from.amount ? 0.2 : 0, to.amount ? 0.2 : 0, w);

    /* pale palettes carry far more light than deep evergreen, so pull
       the exposure back in proportion to how bright the album is */
    /* the room light itself takes the album's temperature, so the snow,
       the gifts and the ground stop reading as blue */
    const L = (t, key, base, k) => (t.amount ? base.clone().lerp(t[key], k) : base.clone());
    key.color.copy(L(from, 'light2', LB.key, 0.8)).lerp(L(to, 'light2', LB.key, 0.8), w);
    fill.color.copy(L(from, 'mid', LB.fill, 0.8)).lerp(L(to, 'mid', LB.fill, 0.8), w);
    warm.color.copy(L(from, 'light1', LB.warm, 0.75)).lerp(L(to, 'light1', LB.warm, 0.75), w);
    hemi.color.copy(L(from, 'mid', LB.hemi, 0.7)).lerp(L(to, 'mid', LB.hemi, 0.7), w);
    hemi.groundColor.copy(L(from, 'deep', LB.hemiG, 0.8)).lerp(L(to, 'deep', LB.hemiG, 0.8), w);

    const lumOf = (t) => (t.amount ? (t.mid.r + t.mid.g + t.mid.b) / 3 : 0.12);
    themeExposure = lerp(1, 0.78, clamp((lerp(lumOf(from), lumOf(to), w) - 0.1) / 0.45));
  }

  function startTheme(next) {
    if (themeState.active) {           // finish whatever is in flight
      themeState.from = themeState.to;
      themeState.waveY = -999;
      themeState.active = false;
      pushTheme();
    }
    if (next === themeState.to) return;
    themeState.from = themeState.to;
    themeState.to = next;
    themeState.t = 0;
    themeState.active = true;
    themeState.waveY = TREE.height + 2.4;
    pushTheme();
  }

  function pickAlbum(skyStar) {
    const goingHome = skyStar.active && themeState.to === skyStar.album;
    constellation.sendComet(skyStar, () => {
      star.trigger();
      themeFlash = 1;
      const next = goingHome ? HOUSE : skyStar.album;
      /* swap what the glass and metal reflect, hidden inside the flash */
      scene.environment = envFor(next);
      startTheme(next);
    });
    if (goingHome) {
      constellation.setActive(null);
      ui.setAlbum(null);
      ui.hideCard();
      return;
    }
    constellation.setActive(skyStar);
    constellation.markVisited(skyStar);
    const found = constellation.visitedCount();
    ui.setAlbum(skyStar.album.name, found);
    const content = skyStar === constellation.thirteenth
      ? THIRTEENTH_MESSAGE : skyStar.album.note;
    if (content) ui.showCard(content);
    if (found >= 12 && constellation.unlockThirteenth()) revealThirteenth();
  }

  /* when all twelve have been found, the sky is worth looking up at */
  function revealThirteenth() {
    setTimeout(() => {
      /* stand opposite it, but off to one side, so the new star sits
         beside the tree rather than hiding behind its own topper */
      const p = constellation.thirteenth.pos;
      const camAz = Math.atan2(p.z, p.x) + Math.PI + 0.45;
      const d = 18.5 * framing;
      flyTo([Math.cos(camAz) * d, 7.4, Math.sin(camAz) * d], [0, 8.4, 0], 3.2);
      ui.setTooltip(null);
      state.spin = false; ui.setSpin(false);
    }, 3400);
  }

  function cycleAlbum(dir = 1) {
    const list = constellation.stars;
    const i = list.findIndex((s) => s.active);
    pickAlbum(list[(i + dir + list.length) % list.length] || list[0]);
  }

  /* ---------------- mode transition ---------------- */
  state.morphTarget = 0;
  let baseBloom = 0.52;
  let baseExposure = 1.06;
  const tween = { from: 0, to: 0, t: 1, dur: 1 };
  let burstFired = false;

  function setMode(cosmic) {
    state.morphTarget = cosmic ? 1 : 0;
    tween.from = state.morph;
    tween.to = state.morphTarget;
    tween.t = 0;
    tween.dur = cosmic ? 3.8 : 3.3;
    burstFired = false;
    ui.setMode(cosmic);
  }

  function applyMorph(m) {
    state.morph = m;
    /* the transformation happens in order:
       lights intensify, ornaments give off sparks, branches dissolve,
       ribbons become spirals, the galaxy rises, the star sends out a
       wave, and everything settles into the tree's own silhouette. */
    fairy.setMorph(remap(m, 0.00, 0.55));
    ornaments.setMorph(remap(m, 0.07, 0.62));
    needles.setMorph(remap(m, 0.16, 1.00));
    ribbons.setMorph(remap(m, 0.28, 0.86));
    base.setMorph(remap(m, 0.22, 1.00));
    presents.setMorph(remap(m, 0.30, 0.95));
    star.setMorph(remap(m, 0.10, 0.90));
    sky.setMorph(m);
    stars.setMorph(m);
    mist.setMorph(m);
    snowfall.setMorph(m);
    grade.uniforms.uMorph.value = m;
    baseBloom = lerp(0.52, 0.26, m);
    baseExposure = lerp(1.06, 0.88, m);

    const woodFade = 1 - remap(m, 0.18, 0.68);
    wood.material.opacity = woodFade;
    wood.visible = woodFade > 0.012;

    if (!burstFired && state.morphTarget === 1 && m > 0.58) { star.trigger(); burstFired = true; }
  }

  /* ---------------- camera ----------------
     Tall, narrow viewports need the camera further out or the tree
     runs off both edges, so every framing distance is scaled by the
     aspect ratio. */
  let framing = 1;
  const framingFor = (aspect) => (aspect >= 1 ? 1 : 1 + (1 - aspect) * 1.25);
  const scaleAbout = (pos, tgt, k) => {
    const t = new THREE.Vector3(...tgt);
    return new THREE.Vector3(...pos).sub(t).multiplyScalar(k).add(t).toArray();
  };
  /* on a tall screen, look a little higher so the tree sits centred
     above the controls rather than floating in the upper half */
  const homeTarget = () => [CAM.home.target[0], CAM.home.target[1] + (framing - 1) * 1.15, CAM.home.target[2]];
  const homePos = () => scaleAbout(CAM.home.pos, homeTarget(), framing);

  framing = framingFor(camera.aspect);
  camera.position.set(...scaleAbout(CAM.start.pos, CAM.start.target, framing));
  controls.target.set(...homeTarget());
  const camTween = { active: false, t: 0, dur: 2.6, fromPos: new THREE.Vector3(), toPos: new THREE.Vector3(), fromTgt: new THREE.Vector3(), toTgt: new THREE.Vector3() };
  function flyTo(pos, tgt, dur = 2.0) {
    camTween.fromPos.copy(camera.position);
    camTween.fromTgt.copy(controls.target);
    camTween.toPos.set(...pos);
    camTween.toTgt.set(...tgt);
    camTween.t = 0; camTween.dur = dur; camTween.active = true;
  }
  function resetCamera() {
    ui.hideCard();
    interactions.release();
    flyTo(homePos(), homeTarget(), 1.5);
    state.spin = true; controls.autoRotate = true; ui.setSpin(true);
  }

  /* ---------------- special effects toggle ---------------- */
  function setEffects(on) {
    state.effects = on;
    bloom.enabled = on;
    grade.uniforms.uGrain.value = on ? 0.035 : 0.012;
    mist.setEffects(on);
    shooting.setEffects(on);
    base.setEffects(on);
    ribbons.setEffects(on);
    needles.setEffects(on);
    star.setEffects(on);
    constellation.setEffects(on);
    fairy.setIntensity(on ? 1 : 0.72);
    ui.setEffects(on);
  }

  /* ---------------- resize ---------------- */
  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();

    const next = framingFor(camera.aspect);
    if (Math.abs(next - framing) > 0.001) {
      const k = next / framing;
      camera.position.sub(controls.target).multiplyScalar(k).add(controls.target);
      framing = next;
      if (!camTween.active && !interactions.isFocused()) controls.target.set(...homeTarget());
      if (camTween.active) {
        camTween.toPos.copy(new THREE.Vector3(...scaleAbout(camTween.toPos.toArray(), camTween.toTgt.toArray(), k)));
      }
    }
    controls.maxDistance = CAM.maxDist * framing;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, QUALITY.dpr));
    renderer.setSize(w, h, false);
    composer.setPixelRatio(renderer.getPixelRatio());
    composer.setSize(w, h);
    bloom.setSize(w, h);
    const projScale = (h * renderer.getPixelRatio()) * 0.5
      / Math.tan(THREE.MathUtils.degToRad(camera.fov) * 0.5);
    fairy.setScale(projScale); ribbons.setScale(projScale); base.setScale(projScale);
    stars.setScale(projScale); snowfall.setScale(projScale); shooting.setScale(projScale);
    constellation.setScale(projScale);
    supernova.setScale(projScale);
    supernova.replan(camera);
  }
  window.addEventListener('resize', resize);
  resize();

  /* the hint retires once you have clearly got the idea */
  const dismissHint = () => document.body.classList.add('touched');
  setTimeout(dismissHint, 22000);
  renderer.domElement.addEventListener('pointerdown', dismissHint, { once: true });
  window.addEventListener('keydown', dismissHint, { once: true });

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    state.spin = false;
    controls.autoRotate = false;
  }

  window.addEventListener('keydown', (e) => {
    if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
    if (state.wall || wallBusy) {
      if (e.key === 'Escape') timeline.hide();
      return;
    }
    if (e.code === 'Space') { e.preventDefault(); setMode(state.morphTarget !== 1); }
    else if (e.key === 'r' || e.key === 'R') resetCamera();
    else if (e.key === 'a' || e.key === 'A') {
      state.spin = !state.spin; controls.autoRotate = state.spin; ui.setSpin(state.spin);
    } else if (e.key === 'c' || e.key === 'C') {
      cycleAlbum(e.shiftKey ? -1 : 1);
    }
  });

  /* ---------------- loop ---------------- */
  const clock = new THREE.Clock();
  let time = 0;

  function frame() {
    const dt = Math.min(0.05, clock.getDelta());
    time += dt;

    if (tween.t < 1) {
      tween.t = Math.min(1, tween.t + dt / tween.dur);
      applyMorph(lerp(tween.from, tween.to, easeInOut(tween.t)));
    }

    if (themeState.active) {
      themeState.t = Math.min(1, themeState.t + dt / themeState.dur);
      const e = easeInOut(themeState.t);
      themeState.waveY = lerp(TREE.height + 2.4, -2.4, e);
      if (themeState.t >= 1) {
        themeState.waveY = -999;
        themeState.active = false;
        themeState.from = themeState.to;
      }
      pushTheme();
    }
    if (themeFlash > 0) themeFlash = Math.max(0, themeFlash - dt * 0.8);
    bloom.strength = baseBloom * lerp(1, 0.72, 1 - themeExposure) + themeFlash * 0.28;
    renderer.toneMappingExposure = baseExposure * themeExposure + themeFlash * themeFlash * 0.12;

    if (camTween.active) {
      camTween.t = Math.min(1, camTween.t + dt / camTween.dur);
      const e = easeInOut(camTween.t);
      camera.position.lerpVectors(camTween.fromPos, camTween.toPos, e);
      controls.target.lerpVectors(camTween.fromTgt, camTween.toTgt, e);
      if (camTween.t >= 1) camTween.active = false;
    }

    interactions.update(dt);

    /* hold-to-charge */
    if (interactions.isHolding()) {
      charge = Math.min(1, charge + dt / CHARGE_TIME);
      const p = interactions.pointerAt();
      chargeEl.style.left = `${p.x}px`;
      chargeEl.style.top = `${p.y}px`;
      chargeEl.style.setProperty('--p', charge.toFixed(3));
      if (charge > 0.04) chargeEl.classList.add('on');
      if (charge >= 1) openWall();
    } else if (charge > 0) {
      charge = Math.max(0, charge - dt * 2.4);
      chargeEl.style.setProperty('--p', charge.toFixed(3));
      if (charge <= 0.02) chargeEl.classList.remove('on');
    }
    needles.setCharge(charge);
    fairy.setCharge(charge);
    supernova.update(time, dt);

    needles.update(time);
    needles.setBurst(star.burstWave);
    fairy.update(time, dt);
    fairy.setBurst(star.burstWave);
    ornaments.update(time);
    ribbons.update(time);
    star.update(time, dt);
    presents.update(time);
    base.update(time);
    stars.update(time);
    snowfall.update(time, camera);
    mist.update(time);
    shooting.update(time, dt);
    constellation.update(time, dt);
    grade.uniforms.uTime.value = time;

    controls.autoRotate = state.spin && !camTween.active && !interactions.isFocused();
    controls.update();
    composer.render();
    requestAnimationFrame(frame);
  }

  /* ---------------- curtain up ---------------- */
  applyMorph(0);
  pushTheme();
  ui.setMode(false);
  ui.setSpin(state.spin);
  ui.setEffects(true);
  ui.setLoaderText('almost there…');
  await nextFrame();
  composer.render();
  await nextFrame();
  ui.finishLoading();
  flyTo(homePos(), homeTarget(), 3.4);
  clock.start();
  frame();

  renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());

  window.__tree = {
    scene, renderer, camera, controls, setMode, setEffects, state,
    openWall, timeline, supernova,
    constellation, pickAlbum, cycleAlbum, albums: ALBUMS, themeState,
    counts: { needles: needles.count },
  };
}

boot().catch((err) => {
  console.error(err);
  const l = document.getElementById('loader-sub');
  if (l) l.textContent = 'this tree needs WebGL — ' + (err?.message || 'unknown error');
});
