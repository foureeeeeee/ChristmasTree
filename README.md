# The Enchanted Christmas Tree

A traditional, fully decorated Christmas tree rendered in WebGL — and the same
tree, able to dissolve into the particles it was always made of, gather itself
back again, and change into any of twelve colours hanging in the sky above it.

The tree comes first. Every effect in here is in service of an evergreen with
layered branches, blue-and-silver baubles, warm fairy lights, satin ribbons, a
crystal star and presents in the snow. Turn every special effect off and it is
still a beautiful Christmas tree.

---

## Running it

The project is plain ES modules, so it needs to be served over HTTP (opening
`index.html` from the file system will not work).

```bash
node dev-server.mjs
```

Then open <http://localhost:8123>. Any static server will do — `npx serve`,
`python3 -m http.server`, whatever you already use.

There is no build step and no dependencies to install. Three.js is loaded from
a CDN via the import map in `index.html`.

---

## What you can do

| Action | How |
| --- | --- |
| Turn the tree | Drag, or let it rotate on its own |
| Come closer | Scroll, or pinch on a touch screen |
| Open the picture wall | **Press and hold the tree** until the light reaches the star |
| Change the tree's colour | Click one of the twelve coloured stars in the sky |
| Put the colours back | Click the star that is currently lit |
| Read a note | Click any bauble |
| Read a Christmas wish | Click a snowflake ornament |
| Open a present | Click a gift box — one of them is special |
| Set off the star | Click the star topper |
| See a title | Hover over anything clickable |
| Switch modes | The **Cosmic mode** button, or `Space` |
| Cycle the albums | `C` (`Shift`+`C` goes back) |
| Reset the camera | The reset button, or `R` |
| Stop the rotation | The rotation button, or `A` |
| Turn the effects off | The sun button — leaves the plain traditional tree |
| Close a note or the wall | `Escape`, the ✕, or click empty sky |

---

## The two modes

**Enchanted** is the default: evergreen foliage, ornaments, fairy lights,
ribbons, the star, snow on the branches, presents underneath, snow falling.

**Cosmic** transforms the *same* tree, in order — the fairy lights intensify,
the ornaments throw off sparks, the branches dissolve, the ribbons become
luminous spirals, the galaxy at the base rises, the star releases a wave of
light, and everything settles into a particle sculpture that still has the
tree's silhouette. Switching back runs the whole sequence in reverse.

Nothing is hidden and swapped for something else. The needles and the particles
are one instanced mesh with one material: in Enchanted mode each instance is a
lit, tapered pine needle, and in Cosmic mode the same instance shortens into a
glowing point and drifts onto a cone shell. See `src/needles.js`.

---

## The picture wall

Press and hold anywhere on the scene while the tree is in Enchanted mode. A ring
fills under your finger and the tree fills with light from the roots upward; when
the light reaches the star the whole thing breaks open, the pieces fly outward
and gather onto a single thread strung across the view — and the thread turns
out to be a timeline running from September to Christmas Day.

Cards hang alternately above and below it, each with photographs, a date, a few
lines and the song it belongs to. Drag, scroll or use the arrow keys; on a phone
the thread runs down the side instead and you scroll it like a page. Close it and
the particles go home and the tree puts itself back together.

### Putting your photographs in

Entries live in `TIMELINE` at the bottom of
[`src/content.js`](src/content.js). Drop your files into a `photos/` folder next
to `index.html` and list them:

```js
{ month: 'October', date: 'Early October', song: 'All Too Well',
  title: 'The scarf',
  body: '…',
  photos: ['./photos/scarf.jpg', './photos/door.jpg'] },
```

One, two or three photographs per card — two reads best. Any entry with none
gets a hand-drawn winter plate instead, so the wall is never empty while you are
still collecting them, and a photo that fails to load quietly falls back to the
same plate. The last entry is marked `finale: true`, which gives it the warm
champagne treatment.

---

## The twelve stars

Twelve coloured stars hang in a slow ring around the whole sky, one for each of
her studio records, each burning in that record's colour. Click one and it sends
a thread of light down to the top of the tree; when the light lands, the topper
bursts and a wave of that album's colour runs all the way down the tree,
recolouring the foliage, the fairy lights, every ornament, the ribbons, the
gifts, the snow, the sky and even what the glass and metal reflect as it passes.
Click the lit star again and the tree goes back to its own blue and silver.

Find all twelve and a **thirteenth** star lights up. The camera looks up to show
you where it is, and what it has to say is the point of the whole thing.

All twelve palettes live in [`src/albums.js`](src/albums.js) — one object per
record, holding the foliage pair, the fairy-light colours, the metal, glass,
ribbon, wrapping paper, sky and galaxy colours, plus the note that star shows.
Change a hex value there and that album's tree changes with it.

---

## Making it yours

### What the tree says

Everything the tree can say lives in [`src/content.js`](src/content.js) — the
bauble notes (each named after one of her songs), the snowflake wishes, the gift
tags, the star's message, the thirteenth star's message and the Easter eggs.
Edit the text and reload; nothing else needs to change.

The album notes are the one exception: they sit beside their colours in
[`src/albums.js`](src/albums.js).

### Your own photographs

Add a `photo` field to any present or ornament entry:

```js
{ kicker: 'Gift tag', title: 'Something soft',
  body: '…',
  photo: './photos/christmas-2019.jpg' },
```

Put the file in a `photos/` folder next to `index.html`. Anything without a
photo gets a hand-drawn frosted winter plate instead, and a photo that fails to
load falls back to the same plate.

### Proportions and decoration

[`src/config.js`](src/config.js) holds the tree's geometry — height, base
radius, taper, number of branch whorls — and the three quality tiers. Change
`TREE.seed` for a different but equally plausible tree.

[`src/palette.js`](src/palette.js) holds the blue-and-silver design language and
the fairy-light colour mix. The lights are deliberately weighted towards warm
champagne white so the tree still reads as Christmas rather than as neon.

---

## How it is put together

```
index.html            page shell, import map, UI markup
styles.css            interface: loader, title, controls, memory card
dev-server.mjs        a tiny static server for local development
src/
  main.js             scene, lighting, post-processing, mode timeline, loop
  config.js           tree proportions, silhouette function, quality tiers
  palette.js          colours and the fairy-light mix
  utils.js            seeded RNG, tapered tubes, procedural textures
  tree.js             procedural branch skeleton + woody geometry
  albums.js           the twelve album palettes, and the thirteenth
  constellation.js    the stars in the sky, their comet and the unlock
  supernova.js        the tree breaking open, and the thread it forms
  timeline.js         the picture wall itself
  needles.js          the instanced needle ⇄ particle system
  ornaments.js        baubles, snowflakes, star ornaments, hooks, branch snow
  lights.js           fairy lights, twinkle, travelling waves, light spill
  ribbons.js          satin ribbons, beaded garland, sparkling trails
  star.js             the five-pointed topper, halo, orbit, light burst
  presents.js         wrapped gifts, bows, gift tags, the special gift
  base.js             tree stand, snow, platform rings, the quiet galaxy
  env.js              sky, stars, snowfall, mist, shooting stars, env map
  interactions.js     picking, hover titles, focus camera moves
  ui.js               the memory card, tooltip, loader, control wiring
  content.js          all the words
```

### Notes on the rendering

- **The tree is grown, not modelled.** `tree.js` builds fourteen whorls of
  branches plus infill branches, inner sprigs and a leader, each branch a
  Catmull-Rom curve with its own droop, sweep and side twigs. Every branch layer
  gets its own wood colour.
- **Needles are instanced camera-facing ribbons** oriented along each needle's
  own direction, shaded with a fake radial normal and a baked ambient-occlusion
  term so the inside of the canopy goes properly dark. That depth term is what
  makes the foliage read as a volume rather than a shell.
- **Fairy lights are a point cloud** on six spiral strands plus the branch tips,
  each bulb twinkling on its own clock. Six real point lights ride along with
  them so the glow spills onto the branches, the baubles and the snow; the
  needle shader samples those same lights.
- **Ornaments hang from real branch points** and swing from that pivot like
  pendulums, with their hook wires following them.
- **Reflections** come from a procedural equirectangular environment map built
  in a canvas — a moon, warm light pools and cool ones — so the glass and metal
  have something worth reflecting.
- **Post-processing** is bloom, a cold-shadow/warm-highlight grade, a whisper of
  chromatic aberration, vignette and grain. Bloom and exposure both pull back as
  the tree goes cosmic so the particle sculpture keeps its facets.
- **Recolouring keeps the light right.** An album's palette is applied as a hue,
  not as a colour: each needle keeps its own brightness and only its hue is
  swapped, or a pale record would turn the tree into a white cone. Exposure and
  bloom then scale down in proportion to how bright the palette is. The scene
  lamps, the fog, the colour grade and the reflection map all shift with it, so
  a gold tree sits in gold light and reflects gold.

### Performance

The picture wall is plain DOM over the live scene rather than rendered in WebGL,
which is what makes the photographs sharp, the text selectable and the whole
thing keyboard- and screen-reader-navigable. The 3-D thread behind it is a
separate particle system laid out along the camera's own right vector at the
moment the tree opens, so it always reads as one straight line of light.

Quality is chosen at load from screen size, pixel count and core count: roughly
46k, 64k or 82k needles, and 900–1950 fairy lights. The whole tree is a handful
of draw calls — one instanced mesh for the needles, one merged mesh for all the
wood, one point cloud per particle system.
