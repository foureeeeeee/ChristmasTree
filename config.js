/* ------------------------------------------------------------------
   Tree proportions and quality tiers.
   Everything decorative scales off TREE so the silhouette stays right.
   ------------------------------------------------------------------ */

export const TREE = {
  height: 10.0,          // trunk base (y=0) to the tip
  baseRadius: 3.32,      // half-width of the lowest branch layer
  taperPower: 0.82,      // >1 = more conical, <1 = fuller shoulders
  tipFraction: 0.085,    // top fraction that tapers to a point
  trunkRadius: 0.165,
  whorls: 14,            // distinct layers of branches
  firstWhorlY: 1.12,
  lastWhorlY: 9.25,
  seed: 1224,
};

/** Outer silhouette radius of the foliage at a given height. */
export function radiusAt(y) {
  const { height, baseRadius, taperPower, tipFraction } = TREE;
  const t = Math.max(0, Math.min(1, y / height));
  let r = baseRadius * Math.pow(1 - t, taperPower);
  // gentle skirt flare at the very bottom, like a real fir
  r *= 1 + 0.07 * Math.exp(-Math.pow((t - 0.07) / 0.1, 2));
  // pointed upper section
  const tipStart = 1 - tipFraction;
  if (t > tipStart) r *= Math.pow(1 - (t - tipStart) / tipFraction, 0.75);
  return Math.max(0.012, r);
}

function tier() {
  const w = window.innerWidth, h = window.innerHeight;
  const px = w * h * Math.min(window.devicePixelRatio || 1, 2);
  const cores = navigator.hardwareConcurrency || 4;
  const mobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || w < 760;
  if (mobile || cores <= 4 || px < 450000) return 'low';
  if (px > 3200000 || cores <= 6) return 'mid';
  return 'high';
}

const TIERS = {
  low:  { needles: 46000, fairyLights:  900, snow: 1500, galaxy: 2600, stars: 1100,
          branchSegs: 7,  twigSegs: 4, baubles: 46, flakes: 16, snowClumps: 140,
          dpr: 1.5, bloom: true, shadow: false },
  mid:  { needles: 64000, fairyLights: 1400, snow: 2600, galaxy: 4200, stars: 1700,
          branchSegs: 9,  twigSegs: 5, baubles: 62, flakes: 22, snowClumps: 220,
          dpr: 1.7, bloom: true, shadow: false },
  high: { needles: 82000, fairyLights: 1950, snow: 3600, galaxy: 6000, stars: 2300,
          branchSegs: 11, twigSegs: 6, baubles: 76, flakes: 28, snowClumps: 300,
          dpr: 2.0, bloom: true, shadow: false },
};

export const QUALITY = { tier: tier(), ...TIERS[tier()] };

export const CAM = {
  start:  { pos: [0.0, 6.4, 23.5], target: [0, 5.1, 0] },
  home:   { pos: [3.9, 6.15, 16.4], target: [0, 5.05, 0] },
  minDist: 6.2,
  maxDist: 34,
  minPolar: 0.28,
  maxPolar: 1.62,
  autoSpeed: 0.26,
};
