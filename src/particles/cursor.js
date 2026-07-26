/**
 * Cursor tracking maths for the halo, kept free of Three.js so it can be tested.
 *
 * Two behaviours matter for how the effect feels: the halo lags well behind the
 * pointer, and it keeps drifting when the pointer is parked -- which is most of
 * the time on a page someone is reading.
 */

/** Viewport pixels to normalised device coordinates (-1..1, y up). */
export function pointerToNdc(clientX, clientY, width, height) {
  return {
    x: (clientX / width) * 2 - 1,
    y: -(clientY / height) * 2 + 1,
  };
}

/**
 * Slow lissajous figure, in the range roughly -1..1 on each axis. Two
 * incommensurate frequencies per axis keep it from visibly repeating.
 */
export function wobbleOffset(elapsed) {
  return {
    x: (Math.sin(elapsed * 0.35) + Math.sin(elapsed * 0.77 + 1.2)) * 0.5,
    y: (Math.cos(elapsed * 0.31) + Math.sin(elapsed * 0.63 + 2.4)) * 0.5,
  };
}

/** Radius of the idle drift, in world units. */
export function orbitRadius(viewport, { orbitRadius: ratio, orbitStrength }) {
  return Math.min(viewport.width, viewport.height) * ratio * orbitStrength;
}

/** Where the halo is heading: the pointer in world space, plus the idle drift. */
export function cursorTarget({ pointer, viewport, orbit, elapsed }) {
  const wobble = wobbleOffset(elapsed);
  return {
    x: (pointer.x * viewport.width) / 2 + wobble.x * orbit,
    y: (pointer.y * viewport.height) / 2 + wobble.y * orbit,
  };
}

/** Exponential ease toward a target. */
export function ease(current, target, factor) {
  return current + (target - current) * factor;
}
