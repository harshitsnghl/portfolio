/**
 * Procedurally drawn textures.
 *
 * Everything here is generated onto a canvas at runtime rather than loaded as
 * an image: it stays sharp at any size, costs no network round trip, and the
 * content can follow the theme. The pure helpers (noise, crater placement) are
 * separated out so they can be tested without a canvas.
 */

import * as THREE from 'three';

/* ------------------------------------------------------------------ *
 * Pure helpers
 * ------------------------------------------------------------------ */

/** Deterministic pseudo-random source, so a given seed always draws the same. */
export function createRandom(seed = 1) {
  let state = seed >>> 0 || 1;
  return () => {
    // xorshift32
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 0x100000000;
  };
}

/**
 * Crater placements in UV space, largest first so small craters land on top of
 * big ones the way they do on a real surface.
 *
 * Width is widened toward the poles to counteract the equirectangular squeeze,
 * otherwise polar craters render as thin slivers.
 */
export function generateCraters(count, random = Math.random) {
  const craters = [];

  for (let i = 0; i < count; i++) {
    const u = random();
    // Bias latitude toward the equator, where a sphere shows the most surface.
    const v = 0.5 + (random() - 0.5) * 1.6 * (0.5 + random() * 0.5);
    const clampedV = Math.min(0.98, Math.max(0.02, v));

    // Real crater size-frequency is a steep power law: small impacts vastly
    // outnumber large ones. A shallower exponent gives an evenly-pocked golf
    // ball rather than a few big basins over fine cratering.
    const size = Math.pow(random(), 4);
    const radius = 0.004 + size * 0.055;

    const latitude = (clampedV - 0.5) * Math.PI;
    const stretch = Math.min(6, 1 / Math.max(0.16, Math.cos(latitude)));

    craters.push({
      u,
      v: clampedV,
      radius,
      stretch,
      depth: 0.35 + random() * 0.65,
      rim: 0.6 + random() * 0.4,
    });
  }

  return craters.sort((a, b) => b.radius - a.radius);
}

/**
 * Colour stops for the aura behind the moon and sun, as plain data so the
 * shape can be asserted without a canvas.
 *
 * `core` is where the body's limb falls inside the sprite, as a fraction of the
 * sprite's half-width. Everything inside it is fully transparent: the sprite is
 * drawn with depthTest off, so any alpha there paints straight over the face of
 * the body and reads as a bright blob in the middle of it. The aura has to
 * start at the limb and go outwards.
 */
export function glowStops({ core = 0, inner = '#ffffff', outer = '#ffffff' } = {}) {
  const limb = Math.min(0.9, Math.max(0, core));
  const span = 1 - limb;
  const stops = [];

  if (limb > 0) {
    // Held at zero across the disc, then feathered over the last sliver so the
    // halo meets the limb without a hard ring.
    stops.push({ offset: 0, color: inner, alpha: 0 });
    stops.push({ offset: limb * 0.92, color: inner, alpha: 0 });
  }

  stops.push({ offset: limb, color: inner, alpha: 1 });
  stops.push({ offset: limb + span * 0.1, color: inner, alpha: 0.62 });
  stops.push({ offset: limb + span * 0.3, color: outer, alpha: 0.3 });
  stops.push({ offset: limb + span * 0.58, color: outer, alpha: 0.12 });
  stops.push({ offset: 1, color: outer, alpha: 0 });

  return stops;
}

/** Value-noise field sampled on a torus so it tiles horizontally. */
export function createTilingNoise(size, random = Math.random) {
  const grid = new Float32Array(size * size);
  for (let i = 0; i < grid.length; i++) grid[i] = random();

  const at = (x, y) => grid[(((y % size) + size) % size) * size + (((x % size) + size) % size)];
  const smooth = (t) => t * t * (3 - 2 * t);

  return (x, y) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = smooth(x - xi);
    const yf = smooth(y - yi);

    return (
      at(xi, yi) * (1 - xf) * (1 - yf) +
      at(xi + 1, yi) * xf * (1 - yf) +
      at(xi, yi + 1) * (1 - xf) * yf +
      at(xi + 1, yi + 1) * xf * yf
    );
  };
}

/* ------------------------------------------------------------------ *
 * Canvas drawing
 * ------------------------------------------------------------------ */

function canvasOf(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return { canvas, ctx: canvas.getContext('2d') };
}

function finish(canvas, { srgb = true, repeatWrap = false } = {}) {
  const texture = new THREE.CanvasTexture(canvas);
  if (srgb) texture.colorSpace = THREE.SRGBColorSpace;
  if (repeatWrap) texture.wrapS = THREE.RepeatWrapping;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

/**
 * The avatar cube face: the "software engineer" dictionary definition, drawn
 * as text rather than shipped as a JPEG so it stays crisp when the cube is
 * close to the camera.
 */
export function createDefinitionTexture({ size = 1024 } = {}) {
  const { canvas, ctx } = canvasOf(size, size);
  const scale = size / 1024;
  const px = (n) => n * scale;

  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, size, size);

  const left = px(70);
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#ffffff';

  // Headword
  ctx.font = `bold ${px(78)}px Helvetica, Arial, sans-serif`;
  ctx.fillText('software engineer', left, px(250));

  // Pronunciation, with the stressed syllables heavier than the rest.
  const pronunciation = [
    { text: '[', weight: 'normal' },
    { text: 'sawft', weight: 'bold' },
    { text: '-wair en-juh-', weight: 'normal' },
    { text: 'neer', weight: 'bold' },
    { text: ']', weight: 'normal' },
  ];
  let cursor = left;
  const pronunciationY = px(330);
  for (const part of pronunciation) {
    ctx.font = `${part.weight} ${px(52)}px Helvetica, Arial, sans-serif`;
    ctx.fillText(part.text, cursor, pronunciationY);
    cursor += ctx.measureText(part.text).width;
  }

  // Rule
  ctx.fillRect(left, px(380), size - left * 2, Math.max(1, px(4)));

  // Part of speech
  ctx.font = `italic ${px(44)}px Helvetica, Arial, sans-serif`;
  ctx.fillText('noun', left + px(10), px(440));

  // Definition
  ctx.font = `bold ${px(46)}px Helvetica, Arial, sans-serif`;
  ['Amazing person who applies', 'the principles of software engineering', 'in magical way'].forEach(
    (line, i) => ctx.fillText(line, left + px(10), px(500) + i * px(58))
  );

  // Synonyms
  ctx.font = `italic ${px(46)}px Helvetica, Arial, sans-serif`;
  ctx.fillText('Synonyms: sorcerer, wizard, magician', left + px(10), px(690));

  return finish(canvas);
}

/**
 * Cross-section of one rib, as a pure function of position around the ring.
 *
 * `u` runs 0..1 around the main ring and repeats, so this is sampled per texel
 * of the rib maps and asserted directly in the unit tests.
 *
 * Returns `face` -- 1 across the flat top of a rib, 0 in the groove between two,
 * smoothly crossing the shoulder -- and `rim`, a narrow spike peaking exactly on
 * that shoulder, which is where a machined edge catches the key light.
 */
export function ribProfile(u, { count = 44, duty = 0.55, bevel = 0.11 } = {}) {
  if (!(count > 0)) return { face: 1, rim: 0 };

  // Position inside this rib's period, folded to a distance from the rib
  // centre, so the profile is symmetric and both shoulders fall out of one term.
  const phase = ((u * count) % 1 + 1) % 1;
  const s = Math.abs(phase - 0.5);

  // `duty` is the fraction of the period the rib occupies, so it clamps to 1
  // (rib fills the period, no groove left) and the half-width to 0.5.
  const half = Math.min(1, Math.max(0, duty)) / 2;
  const soft = Math.max(1e-6, bevel);

  const t = Math.min(1, Math.max(0, (s - (half - soft)) / (2 * soft)));
  const face = 1 - t * t * (3 - 2 * t);
  const rim = Math.exp(-(((s - half) / soft) ** 2));

  return { face, rim };
}

/**
 * Ribbed plating for the torus.
 *
 * The ring is a solid of revolution in a single flat colour, so rotating it
 * changes nothing the eye can latch onto and it reads as standing still. Ribs
 * banded around the tube fix that the way a tyre tread does: each one sweeps
 * past as the wheel turns, and because a rib wraps the tube it crosses every
 * surface normal, so its specular highlight travels rather than sitting still.
 *
 * The profile only varies around the ring, so the maps are four pixels tall --
 * 4k texels against the 65k the hex plating cost, all of it on the path to first
 * paint.
 */
export function createRibbedTextures({
  width = 1024,
  height = 4,
  count = 44,
  duty = 0.55,
  bevel = 0.11,
} = {}) {
  const colour = canvasOf(width, height);
  const bump = canvasOf(width, height);
  const rough = canvasOf(width, height);

  const colourImage = colour.ctx.createImageData(width, height);
  const bumpImage = bump.ctx.createImageData(width, height);
  const roughImage = rough.ctx.createImageData(width, height);

  const mix = (a, b, t) => a + (b - a) * t;

  for (let x = 0; x < width; x++) {
    const { face, rim } = ribProfile(x / width, { count, duty, bevel });

    // Near-white: setTheme drives hue through torusMaterial.color and a map
    // multiplies it, so any tint here would fight the theme.
    const value = Math.min(255, mix(84, 234, face) + rim * 18);
    const heightValue = Math.min(255, mix(34, 210, face) + rim * 26);
    // Grooves stay matte and the rib tops are polished, so the highlight rides
    // the ribs instead of smearing across the whole ring.
    const roughValue = mix(0.72, 0.16, face) * 255 - rim * 26;

    for (let y = 0; y < height; y++) {
      const i = (y * width + x) * 4;

      colourImage.data[i] = value;
      colourImage.data[i + 1] = value;
      colourImage.data[i + 2] = value * 0.995;
      colourImage.data[i + 3] = 255;

      bumpImage.data[i] = heightValue;
      bumpImage.data[i + 1] = heightValue;
      bumpImage.data[i + 2] = heightValue;
      bumpImage.data[i + 3] = 255;

      roughImage.data[i] = roughValue;
      roughImage.data[i + 1] = roughValue;
      roughImage.data[i + 2] = roughValue;
      roughImage.data[i + 3] = 255;
    }
  }

  colour.ctx.putImageData(colourImage, 0, 0);
  bump.ctx.putImageData(bumpImage, 0, 0);
  rough.ctx.putImageData(roughImage, 0, 0);

  // Both axes wrap: u runs around the ring, v around the tube.
  const wrapBoth = (texture) => {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
  };

  return {
    map: wrapBoth(finish(colour.canvas)),
    bumpMap: wrapBoth(finish(bump.canvas, { srgb: false })),
    roughnessMap: wrapBoth(finish(rough.canvas, { srgb: false })),
  };
}

/**
 * Moon surface: dark maria over a grey highland base, then thousands of years
 * of impacts. Returns both the colour map and a matching bump map so the
 * craters catch the light instead of reading as a flat print.
 */
export function createMoonTextures({ width = 1024, seed = 7, craterCount = 420 } = {}) {
  const height = width / 2;
  const random = createRandom(seed);
  const noise = createTilingNoise(64, createRandom(seed + 1));

  const colour = canvasOf(width, height);
  const bump = canvasOf(width, height);

  // Base: mottled grey highlands with broad dark maria.
  const image = colour.ctx.createImageData(width, height);
  const bumpImage = bump.ctx.createImageData(width, height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const u = (x / width) * 8;
      const v = (y / height) * 4;

      // Layered octaves give both broad maria and fine regolith speckle.
      const broad = noise(u, v);
      const mid = noise(u * 3.1, v * 3.1);
      const fine = noise(u * 11, v * 11);

      const maria = Math.max(0, broad - 0.52) * 2.1; // dark basalt plains
      let value = 168 - maria * 78 + (mid - 0.5) * 26 + (fine - 0.5) * 16;
      value = Math.max(52, Math.min(214, value));

      const i = (y * width + x) * 4;
      // Slight warm-grey cast; a pure neutral moon reads as plastic.
      image.data[i] = value;
      image.data[i + 1] = value * 0.985;
      image.data[i + 2] = value * 0.95;
      image.data[i + 3] = 255;

      const b = Math.max(0, Math.min(255, 140 + (mid - 0.5) * 40 + (fine - 0.5) * 30));
      bumpImage.data[i] = b;
      bumpImage.data[i + 1] = b;
      bumpImage.data[i + 2] = b;
      bumpImage.data[i + 3] = 255;
    }
  }

  colour.ctx.putImageData(image, 0, 0);
  bump.ctx.putImageData(bumpImage, 0, 0);

  // Impact craters, on both the colour and the bump pass.
  for (const crater of generateCraters(craterCount, random)) {
    const cx = crater.u * width;
    const cy = crater.v * height;
    const rx = crater.radius * width * crater.stretch;
    const ry = crater.radius * height * 2;

    for (const target of [colour, bump]) {
      const isBump = target === bump;
      target.ctx.save();
      target.ctx.translate(cx, cy);
      target.ctx.scale(rx / Math.max(ry, 0.001), 1);

      const gradient = target.ctx.createRadialGradient(0, 0, 0, 0, 0, ry);
      const floor = isBump ? 90 - crater.depth * 45 : 90 - crater.depth * 30;
      const rimValue = isBump ? 200 + crater.rim * 45 : 190 + crater.rim * 50;

      gradient.addColorStop(0, `rgba(${floor},${floor},${floor},${isBump ? 0.9 : 0.55})`);
      gradient.addColorStop(0.72, `rgba(${floor + 30},${floor + 30},${floor + 30},0.3)`);
      gradient.addColorStop(0.9, `rgba(${rimValue},${rimValue},${rimValue},${crater.rim * 0.5})`);
      gradient.addColorStop(1, 'rgba(0,0,0,0)');

      target.ctx.fillStyle = gradient;
      target.ctx.beginPath();
      target.ctx.arc(0, 0, ry, 0, Math.PI * 2);
      target.ctx.fill();
      target.ctx.restore();
    }
  }

  return {
    map: finish(colour.canvas, { repeatWrap: true }),
    bumpMap: finish(bump.canvas, { srgb: false, repeatWrap: true }),
  };
}

/**
 * Sun surface: a hot white core grading out through orange, broken up with
 * granulation so it isn't a flat disc.
 */
export function createSunTexture({ width = 1024, seed = 21 } = {}) {
  const height = width / 2;
  const noise = createTilingNoise(48, createRandom(seed));
  const { canvas, ctx } = canvasOf(width, height);
  const image = ctx.createImageData(width, height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const u = (x / width) * 10;
      const v = (y / height) * 5;

      const granulation = noise(u * 4, v * 4) * 0.6 + noise(u * 13, v * 13) * 0.4;
      const t = Math.max(0, Math.min(1, granulation));

      // Deep orange in the troughs, near-white on the granule tops.
      const i = (y * width + x) * 4;
      image.data[i] = 255;
      image.data[i + 1] = 150 + t * 95;
      image.data[i + 2] = 40 + t * 130;
      image.data[i + 3] = 255;
    }
  }

  ctx.putImageData(image, 0, 0);
  return finish(canvas, { repeatWrap: true });
}

/**
 * Radial falloff for the glow sprite behind the moon and sun. Drawn with a
 * steep curve so the aura reads as light bloom rather than a grey disc, and
 * hollow across `core` so it haloes the body instead of painting over it.
 */
export function createGlowTexture({ size = 512, inner = '#ffffff', outer = '#ffffff', core = 0 } = {}) {
  const { canvas, ctx } = canvasOf(size, size);
  const half = size / 2;

  const gradient = ctx.createRadialGradient(half, half, 0, half, half, half);
  const rgb = (value) => {
    const c = new THREE.Color(value);
    return `${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)}`;
  };

  for (const stop of glowStops({ core, inner, outer })) {
    gradient.addColorStop(stop.offset, `rgba(${rgb(stop.color)},${stop.alpha})`);
  }

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  return finish(canvas);
}
