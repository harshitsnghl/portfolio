import { describe, expect, it } from 'vitest';
import {
  createRandom,
  createTilingNoise,
  generateCraters,
  glowStops,
  ribProfile,
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

describe('ribProfile', () => {
  it('keeps face and rim inside the unit interval everywhere', () => {
    for (let u = -3; u < 3; u += 0.0017) {
      const { face, rim } = ribProfile(u);
      expect(face).toBeGreaterThanOrEqual(0);
      expect(face).toBeLessThanOrEqual(1);
      expect(rim).toBeGreaterThanOrEqual(0);
      expect(rim).toBeLessThanOrEqual(1);
    }
  });

  it('sits flat on top of a rib and flat in the groove', () => {
    const count = 44;
    // Rib centres land on the half-period, grooves on the period boundary.
    expect(ribProfile(0.5 / count, { count }).face).toBeCloseTo(1, 6);
    expect(ribProfile(0, { count }).face).toBeCloseTo(0, 6);
    expect(ribProfile(1 / count, { count }).face).toBeCloseTo(0, 6);
  });

  it('falls monotonically from rib centre to groove', () => {
    const count = 44;
    let previous = ribProfile(0.5 / count, { count }).face;
    for (let t = 0.5; t <= 1; t += 0.01) {
      const face = ribProfile(t / count, { count }).face;
      expect(face).toBeLessThanOrEqual(previous + 1e-9);
      previous = face;
    }
  });

  it('peaks the rim on the shoulder, which is what catches the key light', () => {
    const count = 44;
    const duty = 0.55;
    const shoulder = (0.5 + duty / 2) / count;
    expect(ribProfile(shoulder, { count, duty }).rim).toBeCloseTo(1, 6);
    // and is all but spent by the time it reaches the rib centre or the
    // groove floor, so it reads as an edge and not as a general brightening
    expect(ribProfile(0.5 / count, { count, duty }).rim).toBeLessThan(0.02);
    expect(ribProfile(1 / count, { count, duty }).rim).toBeLessThan(0.02);
  });

  it('repeats every period, so the map wraps with no seam', () => {
    const count = 44;
    for (let u = 0; u < 1; u += 0.013) {
      expect(ribProfile(u + 1, { count }).face).toBeCloseTo(ribProfile(u, { count }).face, 9);
      expect(ribProfile(u + 1 / count, { count }).face).toBeCloseTo(
        ribProfile(u, { count }).face,
        9
      );
    }
  });

  it('is symmetric about the rib centre', () => {
    const count = 44;
    for (let d = 0; d < 0.5; d += 0.017) {
      const left = ribProfile((0.5 - d) / count, { count });
      const right = ribProfile((0.5 + d) / count, { count });
      expect(left.face).toBeCloseTo(right.face, 9);
      expect(left.rim).toBeCloseTo(right.rim, 9);
    }
  });

  it('widens the rib as duty grows', () => {
    const count = 44;
    const at = (duty) => ribProfile(0.8 / count, { count, duty }).face;
    expect(at(0.8)).toBeGreaterThan(at(0.4));
  });

  it('survives degenerate settings rather than emitting NaN', () => {
    [
      { count: 0 },
      { count: -4 },
      { duty: 0 },
      { duty: 1 },
      { duty: -1 },
      { bevel: 0 },
    ].forEach((options) => {
      const { face, rim } = ribProfile(0.3, options);
      expect(Number.isFinite(face)).toBe(true);
      expect(Number.isFinite(rim)).toBe(true);
    });
  });

  it('is deterministic', () => {
    expect(ribProfile(0.37)).toEqual(ribProfile(0.37));
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
