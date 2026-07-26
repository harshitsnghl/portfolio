/** Tunable constants for the particle field. Pure data, no imports. */
export const PARTICLE_CONFIG = {
  camera: { fov: 75, distance: 5 },

  grid: {
    spacing: 0.38, // world units between dots
    jitterRatio: 0.6, // random offset, as a fraction of spacing
    padding: 1.5, // grid extent relative to the visible area
    maxInstances: 8000,
  },

  // Layered sines so the field is never completely still.
  drift: { speed: 0.15, amplitude: 0.25 },

  halo: {
    radiusBase: 2.4,
    radiusAmplitude: 0.5,
    breathSpeed: 0.8,
    shapeAmplitude: 0.75, // noise on the ring, so it isn't a perfect circle
    shapeSpeed: 0.1,
    rimWidth: 1.8,
    push: 0.5,
    scaleX: 1.3, // an ellipse reads better than a circle on wide viewports
    scaleY: 1,
  },

  // Dots beyond the halo sway radially rather than sitting dead.
  outer: { startOffset: 0.4, endOffset: 2.2, frequency: 2.6, amplitude: 0.76 },

  dot: {
    baseSize: 0.016,
    activeSize: 0.044,
    scaleX: 1,
    scaleY: 0.6,
    stretch: 0.02,
    rotationSpeed: 0.1,
    rotationJitter: 0.2,
    oscillation: 1,
    softness: 2.6, // superellipse exponent: 2 is an ellipse, higher is a capsule
    restAlpha: 0.4,
    activeAlpha: 0.95,
  },

  cursor: {
    ease: 0.015, // low on purpose -- the halo should lag the pointer
    orbitRadius: 0.065, // fraction of the smaller visible dimension
    orbitStrength: 3,
  },
};

/** Phones get a smaller instance budget than desktops. */
export const MOBILE_BREAKPOINT = 768;
export const MOBILE_MAX_INSTANCES = 2500;
