import './style.css';
import * as THREE from 'three';

import { createParticleGrid } from './particles/particle-grid.js';
import { MOBILE_BREAKPOINT, MOBILE_MAX_INSTANCES, PARTICLE_CONFIG } from './particles/config.js';
import { createSpaceScene } from './scene/space-scene.js';
import { createRenderLoop } from './lib/render-loop.js';
import { onThemeChange } from './theme/theme-store.js';
import { initThemeToggle } from './theme/theme-toggle.js';
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

const renderer = new THREE.WebGLRenderer({
  canvas: document.querySelector('#bg'),
  alpha: true,
  antialias: true,
});

// Both scenes share this one context, so the renderer clears manually.
renderer.autoClear = false;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const grid = createParticleGrid({
  maxInstances:
    window.innerWidth < MOBILE_BREAKPOINT ? MOBILE_MAX_INSTANCES : PARTICLE_CONFIG.grid.maxInstances,
});
const space = createSpaceScene();

function renderFrame() {
  renderer.clear();
  renderer.render(grid.scene, grid.camera);
  renderer.clearDepth(); // so the objects sit in front of the field
  renderer.render(space.scene, space.camera);
}

const loop = createRenderLoop({
  onFrame(elapsed) {
    grid.update(elapsed);
    space.update(elapsed);
    renderFrame();
  },
});

/** Draw once when the loop is parked, so a theme or size change still shows. */
function refreshIfIdle() {
  if (!loop.isRunning()) renderFrame();
}

window.addEventListener('resize', () => {
  const { innerWidth: width, innerHeight: height } = window;
  renderer.setSize(width, height);
  grid.resize(width, height);
  space.resize(width, height);
  refreshIfIdle();
});

// Bound to window, not document: scroll events do not fire on document here
// (the page scrolls the root element), so the camera never advanced and the
// torus and moon sat permanently out of frame.
const scrollOffset = () => document.body.getBoundingClientRect().top;

window.addEventListener('scroll', () => space.applyScroll(scrollOffset()), { passive: true });
space.applyScroll(scrollOffset());

document.addEventListener('mousemove', (event) => {
  space.setPointer(event.clientX - window.innerWidth / 2, event.clientY - window.innerHeight / 2);
});

// Nothing to draw while the tab is hidden.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) loop.stop();
  else if (!reducedMotion.matches) loop.start();
});

// Reduced motion gets a single composed frame rather than a blank canvas.
reducedMotion.addEventListener('change', () => {
  if (reducedMotion.matches) {
    loop.stop();
    renderFrame();
  } else {
    loop.start();
  }
});

onThemeChange((name, palette) => {
  grid.setTheme(palette);
  space.setTheme(palette);
  refreshIfIdle();
});

initThemeToggle();

// Live tuning handle. Vite strips this from production builds.
// In the console: __portfolio.grid.uniforms.uHaloRimWidth.value = 0.8
if (import.meta.env.DEV) {
  window.__portfolio = { grid, space, loop, renderer };
}

if (reducedMotion.matches) {
  grid.update(0);
  space.update(0);
  renderFrame();
} else {
  loop.start();
}
