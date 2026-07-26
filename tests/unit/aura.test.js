import { describe, expect, it } from 'vitest';
import { auraOpacity, auraScale } from '../../src/scene/aura.js';

describe('auraScale', () => {
  const base = 15.6; // the moon's sprite today: bodyRadius 3 * 5.2

  it('leaves the sprite at its base size up close', () => {
    expect(auraScale({ distance: 0, baseScale: base })).toBe(base);
    expect(auraScale({ distance: 30, baseScale: base })).toBe(base);
  });

  it('grows the sprite past the reference distance, so the halo survives', () => {
    const near = auraScale({ distance: 30, baseScale: base });
    const far = auraScale({ distance: 90, baseScale: base });
    expect(far).toBeGreaterThan(near);
  });

  it('never shrinks as the body recedes', () => {
    let previous = 0;
    for (let distance = 0; distance <= 400; distance += 7) {
      const scale = auraScale({ distance, baseScale: base });
      expect(scale).toBeGreaterThanOrEqual(previous);
      previous = scale;
    }
  });

  it('caps the growth, so a distant body cannot spawn a scene-sized sprite', () => {
    const huge = auraScale({ distance: 1e6, baseScale: base });
    expect(huge).toBe(base * 2.2);
    expect(huge).toBe(auraScale({ distance: 1e9, baseScale: base }));
  });

  it('honours a custom cap and reference', () => {
    const scale = auraScale({
      distance: 1000,
      baseScale: base,
      reference: 10,
      maxGrowth: 1.5,
    });
    expect(scale).toBe(base * 1.5);
  });

  it('stays finite for degenerate input rather than poisoning the sprite', () => {
    [
      auraScale({ distance: 0, baseScale: base }),
      auraScale({ distance: -50, baseScale: base }),
      auraScale({ distance: NaN, baseScale: base }),
      auraScale({ baseScale: base }),
      auraScale({ distance: 40, baseScale: base, reference: 0 }),
    ].forEach((scale) => {
      expect(Number.isFinite(scale)).toBe(true);
      expect(scale).toBeGreaterThan(0);
    });
  });

  it('returns zero rather than NaN when there is no base scale', () => {
    expect(auraScale({ distance: 40, baseScale: 0 })).toBe(0);
    expect(auraScale({ distance: 40 })).toBe(0);
  });
});

describe('auraOpacity', () => {
  it('sits at the floor when the camera is on top of the body', () => {
    expect(auraOpacity({ distance: 0 })).toBeCloseTo(0.35, 10);
  });

  it('reaches full opacity by the reference distance and holds there', () => {
    expect(auraOpacity({ distance: 30 })).toBeCloseTo(1, 10);
    expect(auraOpacity({ distance: 300 })).toBeCloseTo(1, 10);
    expect(auraOpacity({ distance: 1e6 })).toBeCloseTo(1, 10);
  });

  it('rises with distance, which is the whole point', () => {
    let previous = -1;
    for (let distance = 0; distance <= 60; distance += 3) {
      const opacity = auraOpacity({ distance });
      expect(opacity).toBeGreaterThanOrEqual(previous);
      previous = opacity;
    }
  });

  it('stays inside [floor, base] for every distance', () => {
    for (let distance = -100; distance <= 500; distance += 11) {
      const opacity = auraOpacity({ distance });
      expect(opacity).toBeGreaterThanOrEqual(0.35);
      expect(opacity).toBeLessThanOrEqual(1);
    }
  });

  it('stays finite for degenerate input', () => {
    [
      auraOpacity({ distance: NaN }),
      auraOpacity({}),
      auraOpacity({ distance: 40, reference: 0 }),
    ].forEach((opacity) => expect(Number.isFinite(opacity)).toBe(true));
  });
});
