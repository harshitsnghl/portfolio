/**
 * Grid geometry maths, kept free of Three.js so it can be tested directly.
 *
 * The field is sized from the area the camera actually sees rather than a fixed
 * world extent, so density stays constant across aspect ratios instead of
 * spilling most of its instances off-screen.
 */

const DEG_TO_RAD = Math.PI / 180;

/**
 * Upper bound on thinning iterations. The lattice floor is 2x2, so a budget
 * below 4 instances is unsatisfiable and the guard is what stops the loop.
 */
const MAX_THINNING_PASSES = 32;

/**
 * World-space size of the plane at z = 0, which is where the dots live.
 *
 * @param {{fov: number, distance: number, aspect: number}} params
 * @returns {{width: number, height: number}}
 */
export function visibleExtent({ fov, distance, aspect }) {
  const height = 2 * Math.tan((fov * DEG_TO_RAD) / 2) * distance;
  return { width: height * aspect, height };
}

/**
 * Column/row counts for a grid of the given extent, thinned so the instance
 * count stays within budget on very large viewports.
 *
 * @returns {{cols: number, rows: number, spacing: number, count: number}}
 */
export function computeLayout({ gridWidth, gridHeight, spacing, maxInstances }) {
  const countFor = (step) => ({
    cols: Math.max(2, Math.ceil(gridWidth / step) + 1),
    rows: Math.max(2, Math.ceil(gridHeight / step) + 1),
  });

  let step = spacing;
  let { cols, rows } = countFor(step);

  // Spacing scales with the square root because the count is two-dimensional,
  // but a single pass undershoots: each axis rounds up and adds a border
  // column, so the estimate has to be applied repeatedly. The 1.01 floor
  // guarantees the step strictly grows, so this always terminates.
  for (let guard = 0; cols * rows > maxInstances && guard < MAX_THINNING_PASSES; guard++) {
    step *= Math.max(Math.sqrt((cols * rows) / maxInstances), 1.01);
    ({ cols, rows } = countFor(step));
  }

  return { cols, rows, spacing: step, count: cols * rows };
}

/**
 * Per-instance attribute buffers: a jittered lattice centred on the origin, plus
 * one random seed per dot to decorrelate its rotation phase.
 *
 * `random` is injectable so tests can make the output deterministic.
 *
 * @returns {{offsets: Float32Array, randoms: Float32Array}}
 */
export function buildGridAttributes({
  cols,
  rows,
  gridWidth,
  gridHeight,
  spacing,
  jitterRatio,
  random = Math.random,
}) {
  const count = cols * rows;
  const offsets = new Float32Array(count * 3);
  const randoms = new Float32Array(count);
  const spread = spacing * jitterRatio;

  for (let row = 0, i = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++, i++) {
      offsets[i * 3] = (col / (cols - 1) - 0.5) * gridWidth + (random() - 0.5) * spread;
      offsets[i * 3 + 1] = (row / (rows - 1) - 0.5) * gridHeight + (random() - 0.5) * spread;
      offsets[i * 3 + 2] = 0;
      randoms[i] = random();
    }
  }

  return { offsets, randoms };
}
