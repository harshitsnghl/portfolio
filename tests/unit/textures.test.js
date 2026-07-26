import { describe, expect, it } from 'vitest';
import { createRandom, createTilingNoise, generateCraters } from '../../src/scene/textures.js';

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
