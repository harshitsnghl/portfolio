/**
 * Animation loop with elapsed-time accounting.
 *
 * Timing functions are injectable so tests can drive frames by hand rather than
 * waiting on a real rAF, which browsers throttle to zero in a hidden tab.
 */

const DEFAULT_MAX_DELTA = 0.1;

export function createRenderLoop({
  onFrame,
  now = () => performance.now(),
  requestFrame = (cb) => requestAnimationFrame(cb),
  cancelFrame = (id) => cancelAnimationFrame(id),
  maxDelta = DEFAULT_MAX_DELTA,
}) {
  let frameId = null;
  let elapsed = 0;
  let last = 0;

  function tick() {
    frameId = requestFrame(tick);

    // Clamped so returning to a backgrounded tab doesn't jump the animation
    // forward by however long it was hidden.
    const current = now();
    const delta = Math.min((current - last) / 1000, maxDelta);
    last = current;
    elapsed += delta;

    onFrame(elapsed, delta);
  }

  return {
    start() {
      if (frameId !== null) return;
      last = now(); // discard time accumulated while stopped
      tick();
    },

    stop() {
      if (frameId === null) return;
      cancelFrame(frameId);
      frameId = null;
    },

    isRunning() {
      return frameId !== null;
    },

    /** Advance and draw exactly one frame without starting the loop. */
    step() {
      const current = now();
      const delta = Math.min((current - last) / 1000, maxDelta);
      last = current;
      elapsed += delta;
      onFrame(elapsed, delta);
    },

    getElapsed() {
      return elapsed;
    },
  };
}
