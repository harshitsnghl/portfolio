/**
 * Distance response for the aura sprite behind the moon and sun.
 *
 * The sprite is size-attenuated, so as the camera pulls away the halo shrinks
 * along with the body and its outer falloff -- which tops out at 12% alpha --
 * compresses into so few pixels that it quantises away to nothing in 8 bits.
 * The body stays visible and its aura silently disappears.
 *
 * The fix is to let the sprite grow in world space as it recedes, and to carry
 * more opacity when it is far, less when it is close enough to fill the screen.
 * Kept as pure functions so the curves can be asserted without a GL context.
 */

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/** A missing or non-finite distance falls back to zero rather than poisoning
 * the sprite's scale with a NaN, which Three.js would silently render as a
 * vanished object. */
const safeDistance = (distance) => (Number.isFinite(distance) ? Math.max(0, distance) : 0);

/**
 * World-space scale for the sprite, counteracting size attenuation so the halo
 * keeps a legible footprint on screen at any distance.
 *
 * Holds at `baseScale` inside `reference` -- the aura is already large there and
 * growing it further would swamp the body -- then grows, capped at `maxGrowth`
 * so a far-off body cannot spawn a sprite the size of the scene.
 */
export function auraScale({
  distance,
  baseScale,
  reference = 30,
  growth = 0.45,
  maxGrowth = 2.2,
} = {}) {
  if (!(baseScale > 0)) return 0;
  if (!(reference > 0)) return baseScale;

  const ratio = safeDistance(distance) / reference;
  return baseScale * clamp(1 + growth * (ratio - 1), 1, maxGrowth);
}

/**
 * Material opacity for the sprite: `floor` when the camera is on top of the
 * body, rising to `base` once it is `reference` away and staying there.
 */
export function auraOpacity({ distance, base = 1, reference = 30, floor = 0.35 } = {}) {
  if (!(reference > 0)) return base;

  const t = clamp(safeDistance(distance) / reference, 0, 1);
  return floor + (base - floor) * t;
}
