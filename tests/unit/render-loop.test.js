import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRenderLoop } from '../../src/lib/render-loop.js';

/**
 * A hand-driven frame scheduler. Real rAF is unusable here: browsers throttle it
 * to zero in a hidden tab, which is exactly the condition the loop must handle.
 */
function fakeScheduler() {
  let time = 0;
  let nextId = 1;
  const pending = new Map();

  return {
    now: () => time,
    requestFrame: (cb) => {
      const id = nextId++;
      pending.set(id, cb);
      return id;
    },
    cancelFrame: (id) => pending.delete(id),
    /** Advance the clock and run whatever frame is queued. */
    advance(ms) {
      time += ms;
      const [id, cb] = pending.entries().next().value ?? [];
      if (id !== undefined) {
        pending.delete(id);
        cb();
      }
    },
    pendingCount: () => pending.size,
  };
}

describe('createRenderLoop', () => {
  let scheduler;
  let onFrame;
  let loop;

  beforeEach(() => {
    scheduler = fakeScheduler();
    onFrame = vi.fn();
    loop = createRenderLoop({
      onFrame,
      now: scheduler.now,
      requestFrame: scheduler.requestFrame,
      cancelFrame: scheduler.cancelFrame,
    });
  });

  it('does not run until started', () => {
    expect(loop.isRunning()).toBe(false);
    expect(onFrame).not.toHaveBeenCalled();
  });

  it('reports running state across start and stop', () => {
    loop.start();
    expect(loop.isRunning()).toBe(true);
    loop.stop();
    expect(loop.isRunning()).toBe(false);
  });

  it('accumulates elapsed seconds from frame deltas', () => {
    loop.start(); // first tick fires immediately with a zero delta
    scheduler.advance(16);
    scheduler.advance(16);

    expect(loop.getElapsed()).toBeCloseTo(0.032, 6);
  });

  it('passes elapsed and delta to the frame callback', () => {
    loop.start();
    scheduler.advance(50);

    const [elapsed, delta] = onFrame.mock.calls.at(-1);
    expect(elapsed).toBeCloseTo(0.05, 6);
    expect(delta).toBeCloseTo(0.05, 6);
  });

  it('clamps a long gap so a backgrounded tab does not jump the animation', () => {
    loop.start();
    scheduler.advance(30_000); // half a minute hidden

    expect(loop.getElapsed()).toBeCloseTo(0.1, 6);
    expect(onFrame.mock.calls.at(-1)[1]).toBeCloseTo(0.1, 6);
  });

  it('respects a custom maxDelta', () => {
    const custom = createRenderLoop({
      onFrame,
      now: scheduler.now,
      requestFrame: scheduler.requestFrame,
      cancelFrame: scheduler.cancelFrame,
      maxDelta: 0.5,
    });

    custom.start();
    scheduler.advance(30_000);
    expect(custom.getElapsed()).toBeCloseTo(0.5, 6);
  });

  it('stops scheduling further frames once stopped', () => {
    loop.start();
    scheduler.advance(16);
    loop.stop();

    expect(scheduler.pendingCount()).toBe(0);
    const callsAtStop = onFrame.mock.calls.length;
    scheduler.advance(16);
    expect(onFrame).toHaveBeenCalledTimes(callsAtStop);
  });

  it('discards the paused interval when restarted', () => {
    loop.start();
    scheduler.advance(16);
    const beforePause = loop.getElapsed();

    loop.stop();
    scheduler.advance(10_000); // hidden for ten seconds
    loop.start();

    expect(loop.getElapsed()).toBeCloseTo(beforePause, 6);
  });

  it('ignores a second start rather than double-scheduling', () => {
    loop.start();
    loop.start();
    expect(scheduler.pendingCount()).toBe(1);
  });

  it('tolerates stop when never started', () => {
    expect(() => loop.stop()).not.toThrow();
    expect(loop.isRunning()).toBe(false);
  });

  it('step() draws one frame without starting the loop', () => {
    scheduler.advance(0); // nothing queued yet, just moves the clock reference
    loop.step();

    expect(onFrame).toHaveBeenCalledTimes(1);
    expect(loop.isRunning()).toBe(false);
    expect(scheduler.pendingCount()).toBe(0);
  });
});
