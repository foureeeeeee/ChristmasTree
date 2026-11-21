import * as THREE from 'three';

/* The blue-and-silver Christmas design language. */
export const HEX = {
  midnight:     0x030817,
  sapphireDeep: 0x102b59,
  royal:        0x174a88,
  ice:          0xa8dfff,
  silver:       0xdce5ef,
  crystal:      0xf5faff,
  champagne:    0xf4ebdd,

  /* evergreen foliage range */
  needleDark:   0x08301f,
  needleMid:    0x12532f,
  needleBlue:   0x163f45,
  needleLight:  0x377e51,
  needleFrost:  0x9fd4df,

  bark:         0x241a14,
  barkLight:    0x3b2c21,
  snow:         0xeaf3ff,
  snowShadow:   0xa9c3e0,
};

export const C = Object.fromEntries(
  Object.entries(HEX).map(([k, v]) => [k, new THREE.Color(v)])
);

/* Fairy-light palette: mostly warm champagne so it still reads as Christmas. */
export const LIGHT_COLORS = [
  { c: new THREE.Color(0xffe6bd), w: 0.34 },  // warm champagne white
  { c: new THREE.Color(0xfff3dc), w: 0.16 },  // soft candle white
  { c: new THREE.Color(0xa8dfff), w: 0.20 },  // ice blue
  { c: new THREE.Color(0xeef6ff), w: 0.14 },  // silver white
  { c: new THREE.Color(0x8ff0ff), w: 0.10 },  // soft cyan
  { c: new THREE.Color(0x3f7fe0), w: 0.06 },  // subtle sapphire
];

export function pickLightColor(rnd) {
  let r = rnd();
  for (const e of LIGHT_COLORS) { r -= e.w; if (r <= 0) return e.c; }
  return LIGHT_COLORS[0].c;
}
