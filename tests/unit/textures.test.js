import { describe, expect, it } from 'vitest';
import {
  cellNoise,
  createRandom,
  createTilingNoise,
  generateCraters,
  glowStops,
  hexCell,
} from '../../src/scene/textures.js';

describe('createRandom', () => {
  it('stays within the unit interval', () => {
    const random = createRandom(42);
    for (let i = 0; i < 5000; i++) {
      const value = random();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('is deterministic for a given seed', () => {
    const a = createRandom(99);
    const b = createRandom(99);
    const seriesA = Array.from({ length: 50 }, a);
    const seriesB = Array.from({ length: 50 }, b);
    expect(seriesA).toEqual(seriesB);
  });

  it('produces different series for different seeds', () => {
    const a = Array.from({ length: 20 }, createRandom(1));
    const b = Array.from({ length: 20 }, createRandom(2));
    expect(a).not.toEqual(b);
  });

  it('survives a zero seed rather than locking at one value', () => {
    const random = createRandom(0);
    const values = new Set(Array.from({ length: 100 }, random));
    expect(values.size).toBeGreaterThan(50);
  });

  it('spreads roughly evenly across the range', () => {
    const random = createRandom(5);
    const buckets = new Array(10).fill(0);
    for (let i = 0; i < 10000; i++) buckets[Math.floor(random() * 10)]++;
    buckets.forEach((n) => expect(n).toBeGreaterThan(700)); // ~1000 expected
  });
});

describe('generateCraters', () => {
  const craters = generateCraters(500, createRandom(3));

  it('returns the requested number', () => {
    expect(craters).toHaveLength(500);
  });

  it('keeps every crater inside the UV square', () => {
    craters.forEach(({ u, v }) => {
      expect(u).toBeGreaterThanOrEqual(0);
      expect(u).toBeLessThanOrEqual(1);
      expect(v).toBeGreaterThanOrEqual(0.02);
      expect(v).toBeLessThanOrEqual(0.98);
    });
  });

  it('sorts largest first, so small craters overprint big ones', () => {
    for (let i = 1; i < craters.length; i++) {
      expect(craters[i - 1].radius).toBeGreaterThanOrEqual(craters[i].radius);
    }
  });

  it('produces far more small craters than large ones, as real surfaces do', () => {
    const large = craters.filter((c) => c.radius > 0.03).length;
    const small = craters.filter((c) => c.radius < 0.012).length;
    expect(small).toBeGreaterThan(large * 3);
  });

  it('widens craters toward the poles to fight equirectangular squeeze', () => {
    const equatorial = craters.filter((c) => Math.abs(c.v - 0.5) < 0.05);
    const polar = craters.filter((c) => Math.abs(c.v - 0.5) > 0.42);

    // Both bands should exist in a 500-crater sample.
    expect(equatorial.length).toBeGreaterThan(0);
    expect(polar.length).toBeGreaterThan(0);

    const mean = (xs) => xs.reduce((a, c) => a + c.stretch, 0) / xs.length;
    expect(mean(polar)).toBeGreaterThan(mean(equatorial));
  });

  it('never returns a non-finite or negative dimension', () => {
    craters.forEach(({ radius, stretch, depth, rim }) => {
      [radius, stretch, depth, rim].forEach((n) => {
        expect(Number.isFinite(n)).toBe(true);
        expect(n).toBeGreaterThan(0);
      });
    });
  });

  it('caps the polar stretch so craters cannot smear across the whole map', () => {
    craters.forEach(({ stretch }) => expect(stretch).toBeLessThanOrEqual(6));
  });

  it('is reproducible for a given seed', () => {
    expect(generateCraters(30, createRandom(11))).toEqual(generateCraters(30, createRandom(11)));
  });
});

describe('createTilingNoise', () => {
  const noise = createTilingNoise(32, createRandom(8));

  it('stays within the unit interval', () => {
    for (let x = 0; x < 40; x += 0.7) {
      for (let y = 0; y < 40; y += 0.7) {
        const value = noise(x, y);
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      }
    }
  });

  it('wraps seamlessly, so the sphere has no visible join', () => {
    for (let y = 0; y < 10; y += 0.5) {
      expect(noise(0, y)).toBeCloseTo(noise(32, y), 6);
      expect(noise(y, 0)).toBeCloseTo(noise(y, 32), 6);
    }
  });

  it('interpolates smoothly rather than jumping between cells', () => {
    let maxStep = 0;
    let previous = noise(0, 3);
    for (let x = 0.05; x < 5; x += 0.05) {
      const value = noise(x, 3);
      maxStep = Math.max(maxStep, Math.abs(value - previous));
      previous = value;
    }
    expect(maxStep).toBeLessThan(0.15);
  });

  it('actually varies, rather than returning a constant', () => {
    const samples = [];
    for (let x = 0; x < 20; x += 1.3) samples.push(noise(x, x * 0.7));
    expect(Math.max(...samples) - Math.min(...samples)).toBeGreaterThan(0.2);
  });

  it('is deterministic', () => {
    const a = createTilingNoise(16, createRandom(4));
    const b = createTilingNoise(16, createRandom(4));
    expect(a(3.3, 7.1)).toBe(b(3.3, 7.1));
  });
});

describe('hexCell', () => {
  const centreOf = (q, r) => [Math.sqrt(3) * (q + r / 2), 1.5 * r];

  it('keeps edge inside the unit interval everywhere', () => {
    for (let x = -12; x < 12; x += 0.31) {
      for (let y = -12; y < 12; y += 0.29) {
        const { edge } = hexCell(x, y);
        expect(edge).toBeGreaterThanOrEqual(0);
        expect(edge).toBeLessThanOrEqual(1);
      }
    }
  });

  it('reports the cell whose centre really is nearest', () => {
    // The seven-candidate shortcut is only valid if it never misses a closer
    // centre, so this checks it against a brute-force sweep.
    for (let x = -6; x < 6; x += 0.37) {
      for (let y = -6; y < 6; y += 0.41) {
        const { q, r } = hexCell(x, y);
        const [cx, cy] = centreOf(q, r);
        const chosen = Math.hypot(x - cx, y - cy);

        for (let dq = -4; dq <= 4; dq++) {
          for (let dr = -4; dr <= 4; dr++) {
            const [ox, oy] = centreOf(q + dq, r + dr);
            expect(Math.hypot(x - ox, y - oy)).toBeGreaterThanOrEqual(chosen - 1e-9);
          }
        }
      }
    }
  });

  it('peaks at a cell centre and bottoms out on a border', () => {
    const [cx, cy] = centreOf(2, -1);
    expect(hexCell(cx, cy).edge).toBeCloseTo(1, 6);

    // Midway to a neighbour is exactly the shared border.
    const [nx, ny] = centreOf(3, -1);
    expect(hexCell((cx + nx) / 2, (cy + ny) / 2).edge).toBeCloseTo(0, 6);
  });

  it('holds one cell id across the interior, so panels stay whole', () => {
    const [cx, cy] = centreOf(1, 2);
    const { q, r } = hexCell(cx, cy);
    for (const [dx, dy] of [
      [0.2, 0],
      [-0.2, 0],
      [0, 0.2],
      [0, -0.2],
      [0.15, 0.15],
    ]) {
      expect(hexCell(cx + dx, cy + dy)).toMatchObject({ q, r });
    }
  });

  it('tiles on both axes, so the plating wraps with no seam', () => {
    const columns = 30;
    const rows = 6; // must be even for the vertical period to land on the lattice

    for (let x = 0; x < 5; x += 0.43) {
      for (let y = 0; y < 5; y += 0.47) {
        expect(hexCell(x + columns * Math.sqrt(3), y).edge).toBeCloseTo(hexCell(x, y).edge, 9);
        expect(hexCell(x, y + rows * 1.5).edge).toBeCloseTo(hexCell(x, y).edge, 9);
      }
    }
  });

  it('is deterministic', () => {
    expect(hexCell(3.3, -7.1)).toEqual(hexCell(3.3, -7.1));
  });
});

describe('cellNoise', () => {
  it('stays within the unit interval', () => {
    for (let q = -30; q < 30; q++) {
      for (let r = -30; r < 30; r++) {
        const value = cellNoise(q, r, 13);
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThan(1);
      }
    }
  });

  it('is stable for a cell, so a panel does not flicker between redraws', () => {
    expect(cellNoise(4, -9, 13)).toBe(cellNoise(4, -9, 13));
  });

  it('differs between neighbouring cells, which is the whole point', () => {
    const values = new Set();
    for (let q = 0; q < 12; q++) for (let r = 0; r < 12; r++) values.add(cellNoise(q, r, 13));
    expect(values.size).toBeGreaterThan(130); // 144 cells, near enough all distinct
  });

  it('decorrelates on the seed, so gloss does not track brightness', () => {
    expect(cellNoise(5, 5, 13)).not.toBe(cellNoise(5, 5, 990));
  });

  it('spreads roughly evenly', () => {
    const buckets = new Array(10).fill(0);
    for (let q = 0; q < 100; q++)
      for (let r = 0; r < 100; r++) buckets[Math.floor(cellNoise(q, r, 3) * 10)]++;
    buckets.forEach((n) => expect(n).toBeGreaterThan(700)); // ~1000 expected
  });
});

describe('glowStops', () => {
  const core = 0.385; // where the moon's limb lands inside its sprite
  const stops = glowStops({ core, inner: '#dce6ff', outer: '#8fa8d8' });

  it('runs strictly outward across the unit radius', () => {
    expect(stops[0].offset).toBe(0);
    expect(stops[stops.length - 1].offset).toBe(1);
    for (let i = 1; i < stops.length; i++) {
      expect(stops[i].offset).toBeGreaterThan(stops[i - 1].offset);
      expect(stops[i].offset).toBeLessThanOrEqual(1);
    }
  });

  it('is fully transparent across the face of the body', () => {
    // This is the bug the core exists to prevent: the sprite draws with
    // depthTest off, so any alpha inside the limb paints over the body itself
    // and reads as a bright blob in the middle of the moon.
    stops
      .filter((stop) => stop.offset <= core * 0.92)
      .forEach((stop) => expect(stop.alpha).toBe(0));
  });

  it('peaks exactly at the limb', () => {
    const peak = stops.find((stop) => stop.alpha === 1);
    expect(peak.offset).toBeCloseTo(core, 10);
  });

  it('decays without a rebound once past the limb', () => {
    const outward = stops.filter((stop) => stop.offset >= core);
    for (let i = 1; i < outward.length; i++) {
      expect(outward[i].alpha).toBeLessThan(outward[i - 1].alpha);
    }
    expect(outward[outward.length - 1].alpha).toBe(0);
  });

  it('fades to nothing at the sprite edge, so there is no cut-off square', () => {
    expect(stops[stops.length - 1]).toMatchObject({ offset: 1, alpha: 0 });
  });

  it('carries the inner colour at the limb and the outer colour in the tail', () => {
    expect(stops.find((stop) => stop.alpha === 1).color).toBe('#dce6ff');
    expect(stops[stops.length - 1].color).toBe('#8fa8d8');
  });

  it('still produces a valid ramp with no core at all', () => {
    const solid = glowStops({ core: 0 });
    expect(solid[0]).toMatchObject({ offset: 0, alpha: 1 });
    for (let i = 1; i < solid.length; i++) {
      expect(solid[i].offset).toBeGreaterThan(solid[i - 1].offset);
    }
  });

  it('clamps an absurd core so the stops cannot collapse onto each other', () => {
    [1, 5, -3].forEach((value) => {
      const clamped = glowStops({ core: value });
      for (let i = 1; i < clamped.length; i++) {
        expect(clamped[i].offset).toBeGreaterThan(clamped[i - 1].offset);
      }
    });
  });

  it('matches the sun, whose sprite is wider so its limb sits further in', () => {
    const sun = glowStops({ core: 2 / 7.5 });
    expect(sun.find((stop) => stop.alpha === 1).offset).toBeCloseTo(0.2667, 3);
  });
});
