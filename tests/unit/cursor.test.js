import { describe, expect, it } from 'vitest';
import {
  cursorTarget,
  ease,
  orbitRadius,
  pointerToNdc,
  wobbleOffset,
} from '../../src/particles/cursor.js';

describe('pointerToNdc', () => {
  it('maps the viewport centre to the origin', () => {
    expect(pointerToNdc(500, 400, 1000, 800)).toEqual({ x: 0, y: 0 });
  });

  it('maps corners to the unit square, with y flipped for WebGL', () => {
    expect(pointerToNdc(0, 0, 1000, 800)).toEqual({ x: -1, y: 1 });
    expect(pointerToNdc(1000, 800, 1000, 800)).toEqual({ x: 1, y: -1 });
  });
});

describe('wobbleOffset', () => {
  it('stays within the range the two summed sines allow', () => {
    for (let t = 0; t < 200; t += 0.37) {
      const { x, y } = wobbleOffset(t);
      expect(Math.abs(x)).toBeLessThanOrEqual(1);
      expect(Math.abs(y)).toBeLessThanOrEqual(1);
    }
  });

  it('keeps moving, so the halo breathes with the pointer parked', () => {
    const a = wobbleOffset(0);
    const b = wobbleOffset(3);
    expect(a.x).not.toBeCloseTo(b.x, 3);
  });

  it('does not repeat over a short window', () => {
    // Incommensurate frequencies: no exact revisit at any small period.
    const first = wobbleOffset(1);
    const later = wobbleOffset(1 + 2 * Math.PI);
    expect(Math.abs(first.x - later.x) + Math.abs(first.y - later.y)).toBeGreaterThan(0.01);
  });

  it('is deterministic', () => {
    expect(wobbleOffset(4.2)).toEqual(wobbleOffset(4.2));
  });
});

describe('orbitRadius', () => {
  const cursorConfig = { orbitRadius: 0.065, orbitStrength: 3 };

  it('follows the smaller viewport dimension', () => {
    const wide = orbitRadius({ width: 20, height: 8 }, cursorConfig);
    const tall = orbitRadius({ width: 8, height: 20 }, cursorConfig);
    expect(wide).toBeCloseTo(tall, 10);
    expect(wide).toBeCloseTo(8 * 0.065 * 3, 10);
  });

  it('is zero when the drift is switched off', () => {
    expect(orbitRadius({ width: 20, height: 8 }, { orbitRadius: 0, orbitStrength: 3 })).toBe(0);
  });
});

describe('cursorTarget', () => {
  const viewport = { width: 20, height: 10 };

  it('places a centred pointer at the world origin when drift is off', () => {
    const target = cursorTarget({ pointer: { x: 0, y: 0 }, viewport, orbit: 0, elapsed: 0 });
    expect(target).toEqual({ x: 0, y: 0 });
  });

  it('maps NDC extremes to the viewport edges', () => {
    const target = cursorTarget({ pointer: { x: 1, y: -1 }, viewport, orbit: 0, elapsed: 0 });
    expect(target.x).toBeCloseTo(10, 10);
    expect(target.y).toBeCloseTo(-5, 10);
  });

  it('offsets by no more than the orbit radius', () => {
    for (let t = 0; t < 50; t += 1.1) {
      const target = cursorTarget({ pointer: { x: 0, y: 0 }, viewport, orbit: 2, elapsed: t });
      expect(Math.abs(target.x)).toBeLessThanOrEqual(2 + 1e-9);
      expect(Math.abs(target.y)).toBeLessThanOrEqual(2 + 1e-9);
    }
  });
});

describe('ease', () => {
  it('moves a fraction of the remaining distance', () => {
    expect(ease(0, 10, 0.5)).toBe(5);
    expect(ease(0, 10, 0.015)).toBeCloseTo(0.15, 10);
  });

  it('converges without overshooting for factors in (0, 1)', () => {
    let value = 0;
    for (let i = 0; i < 2000; i++) value = ease(value, 100, 0.015);
    expect(value).toBeGreaterThan(99.9);
    expect(value).toBeLessThanOrEqual(100);
  });

  it('is a no-op at factor zero and a snap at factor one', () => {
    expect(ease(3, 9, 0)).toBe(3);
    expect(ease(3, 9, 1)).toBe(9);
  });

  it('lags noticeably at the configured factor, which is the intended feel', () => {
    // 0.015 should still be far from the target after a second of 60fps frames.
    let value = 0;
    for (let i = 0; i < 60; i++) value = ease(value, 100, 0.015);
    expect(value).toBeLessThan(80);
  });
});
