import { describe, expect, it } from 'vitest';
import {
  buildGridAttributes,
  computeLayout,
  visibleExtent,
} from '../../src/particles/grid-layout.js';

describe('visibleExtent', () => {
  it('matches the known frustum height for the field camera', () => {
    // 2 * tan(75deg / 2) * 5 == 7.6731...
    const { height } = visibleExtent({ fov: 75, distance: 5, aspect: 1 });
    expect(height).toBeCloseTo(7.673, 3);
  });

  it('scales width by aspect ratio, leaving height alone', () => {
    const square = visibleExtent({ fov: 75, distance: 5, aspect: 1 });
    const wide = visibleExtent({ fov: 75, distance: 5, aspect: 2 });

    expect(wide.height).toBeCloseTo(square.height, 10);
    expect(wide.width).toBeCloseTo(square.width * 2, 10);
  });

  it('grows linearly with camera distance', () => {
    const near = visibleExtent({ fov: 75, distance: 5, aspect: 1.5 });
    const far = visibleExtent({ fov: 75, distance: 10, aspect: 1.5 });

    expect(far.height).toBeCloseTo(near.height * 2, 10);
    expect(far.width).toBeCloseTo(near.width * 2, 10);
  });

  it('widens as field of view widens', () => {
    const narrow = visibleExtent({ fov: 45, distance: 5, aspect: 1 });
    const wide = visibleExtent({ fov: 90, distance: 5, aspect: 1 });
    expect(wide.height).toBeGreaterThan(narrow.height);
  });
});

describe('computeLayout', () => {
  const base = { gridWidth: 20, gridHeight: 12, spacing: 0.38, maxInstances: 8000 };

  it('covers the requested extent at the requested spacing', () => {
    const { cols, rows, spacing, count } = computeLayout(base);

    expect(spacing).toBe(0.38);
    expect(cols).toBe(Math.ceil(20 / 0.38) + 1);
    expect(rows).toBe(Math.ceil(12 / 0.38) + 1);
    expect(count).toBe(cols * rows);
  });

  it('stays within the instance budget by thinning the field', () => {
    const layout = computeLayout({ ...base, maxInstances: 500 });

    expect(layout.count).toBeLessThanOrEqual(500);
    expect(layout.spacing).toBeGreaterThan(base.spacing);
  });

  it('leaves spacing untouched when already under budget', () => {
    const layout = computeLayout({ ...base, maxInstances: 100000 });
    expect(layout.spacing).toBe(base.spacing);
  });

  it('keeps density roughly constant across aspect ratios', () => {
    const wide = computeLayout({ ...base, gridWidth: 30, gridHeight: 10 });
    const tall = computeLayout({ ...base, gridWidth: 10, gridHeight: 30 });

    const wideDensity = wide.count / (30 * 10);
    const tallDensity = tall.count / (10 * 30);
    expect(wideDensity).toBeCloseTo(tallDensity, 1);
  });

  it('never degenerates below a 2x2 lattice', () => {
    // A single row or column would make the col/(cols-1) term divide by zero.
    const layout = computeLayout({
      gridWidth: 0.001,
      gridHeight: 0.001,
      spacing: 10,
      maxInstances: 8000,
    });

    expect(layout.cols).toBeGreaterThanOrEqual(2);
    expect(layout.rows).toBeGreaterThanOrEqual(2);
  });

  it('honours the budget across a wide range of viewports and limits', () => {
    // The naive single-pass rescale overshot here: ceil() plus the border
    // column added instances back after thinning.
    for (const gridWidth of [5, 20, 60, 200]) {
      for (const gridHeight of [3, 12, 40]) {
        for (const maxInstances of [100, 500, 2500, 8000]) {
          const layout = computeLayout({ gridWidth, gridHeight, spacing: 0.38, maxInstances });
          expect(layout.count).toBeLessThanOrEqual(maxInstances);
        }
      }
    }
  });

  it('degrades to the minimum lattice rather than hanging on an impossible budget', () => {
    const layout = computeLayout({
      gridWidth: 20,
      gridHeight: 12,
      spacing: 0.38,
      maxInstances: 1, // below the 2x2 floor, so unsatisfiable
    });

    expect(layout.count).toBe(4);
    expect(Number.isFinite(layout.spacing)).toBe(true);
  });

  it('reports a count consistent with its own cols and rows', () => {
    for (const maxInstances of [50, 500, 5000, 50000]) {
      const layout = computeLayout({ ...base, maxInstances });
      expect(layout.count).toBe(layout.cols * layout.rows);
    }
  });
});

describe('buildGridAttributes', () => {
  const params = {
    cols: 4,
    rows: 3,
    gridWidth: 12,
    gridHeight: 6,
    spacing: 1,
    jitterRatio: 0,
    random: () => 0.5, // 0.5 makes the jitter term exactly zero
  };

  it('emits one xyz triple and one seed per instance', () => {
    const { offsets, randoms } = buildGridAttributes(params);
    expect(offsets).toHaveLength(4 * 3 * 3);
    expect(randoms).toHaveLength(4 * 3);
  });

  it('spans exactly the requested extent, centred on the origin', () => {
    const { offsets } = buildGridAttributes(params);

    const xs = [];
    const ys = [];
    for (let i = 0; i < offsets.length; i += 3) {
      xs.push(offsets[i]);
      ys.push(offsets[i + 1]);
    }

    expect(Math.min(...xs)).toBeCloseTo(-6, 6);
    expect(Math.max(...xs)).toBeCloseTo(6, 6);
    expect(Math.min(...ys)).toBeCloseTo(-3, 6);
    expect(Math.max(...ys)).toBeCloseTo(3, 6);
  });

  it('keeps every dot on the z = 0 plane', () => {
    const { offsets } = buildGridAttributes({ ...params, jitterRatio: 0.6 });
    for (let i = 2; i < offsets.length; i += 3) {
      expect(offsets[i]).toBe(0);
    }
  });

  it('bounds jitter by spacing * jitterRatio', () => {
    const spacing = 2;
    const jitterRatio = 0.6;
    const maxJitter = (spacing * jitterRatio) / 2;

    const unjittered = buildGridAttributes({ ...params, jitterRatio: 0 });
    const jittered = buildGridAttributes({
      ...params,
      spacing,
      jitterRatio,
      random: () => 1, // the extreme of the (random() - 0.5) term
    });

    // Offsets round-trip through Float32Array, so the comparison needs a
    // float32-sized epsilon rather than a float64 one.
    for (let i = 0; i < unjittered.offsets.length; i += 3) {
      expect(Math.abs(jittered.offsets[i] - unjittered.offsets[i])).toBeLessThanOrEqual(
        maxJitter * (1 + 1e-6)
      );
    }
  });

  it('is deterministic for a given random source', () => {
    const seeded = () => {
      let n = 0;
      return () => ((n = (n * 1664525 + 1013904223) % 4294967296) / 4294967296);
    };

    const a = buildGridAttributes({ ...params, jitterRatio: 0.6, random: seeded() });
    const b = buildGridAttributes({ ...params, jitterRatio: 0.6, random: seeded() });

    expect(Array.from(a.offsets)).toEqual(Array.from(b.offsets));
    expect(Array.from(a.randoms)).toEqual(Array.from(b.randoms));
  });

  it('produces no NaN for any layout computeLayout can return', () => {
    const layout = computeLayout({
      gridWidth: 20,
      gridHeight: 12,
      spacing: 0.38,
      maxInstances: 300,
    });

    const { offsets, randoms } = buildGridAttributes({
      ...layout,
      gridWidth: 20,
      gridHeight: 12,
      jitterRatio: 0.6,
    });

    expect(offsets.some(Number.isNaN)).toBe(false);
    expect(randoms.some(Number.isNaN)).toBe(false);
  });
});
