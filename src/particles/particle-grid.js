/**
 * Breathing particle field.
 *
 * A grid of instanced quads sits nearly invisible at rest. Around the cursor a
 * ring at an oscillating radius -- not a bulge underneath it -- pushes dots
 * outward, stretches them into dashes and aligns them along the radial vector.
 * Dots inside and outside that ring stay calm, which is what gives the effect
 * its jellyfish-membrane look rather than a spotlight.
 *
 * The approach is modelled on ewohlken2/BreathDearMedusae. That project is
 * UNLICENSED, so it was read for technique only -- the shaders are an
 * independent implementation.
 *
 * Owns no renderer and no animation loop: main.js drives it so both scenes
 * share one WebGL context. The maths lives in ./grid-layout.js and ./cursor.js
 * so it can be tested without a GL context.
 */

import * as THREE from 'three';
import { PARTICLE_CONFIG } from './config.js';
import { fragmentShader, vertexShader } from './shaders.js';
import { buildGridAttributes, computeLayout, visibleExtent } from './grid-layout.js';
import { cursorTarget, ease, orbitRadius, pointerToNdc } from './cursor.js';

export function createParticleGrid({
  config = PARTICLE_CONFIG,
  maxInstances = PARTICLE_CONFIG.grid.maxInstances,
} = {}) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(config.camera.fov, 1, 0.1, 100);
  camera.position.z = config.camera.distance;

  const uniforms = {
    uTime: { value: 0 },
    uCursor: { value: new THREE.Vector2(0, 0) },

    uDriftSpeed: { value: config.drift.speed },
    uDriftAmplitude: { value: config.drift.amplitude },

    uHaloRadiusBase: { value: config.halo.radiusBase },
    uHaloRadiusAmplitude: { value: config.halo.radiusAmplitude },
    uHaloBreathSpeed: { value: config.halo.breathSpeed },
    uHaloShapeAmplitude: { value: config.halo.shapeAmplitude },
    uHaloShapeSpeed: { value: config.halo.shapeSpeed },
    uHaloRimWidth: { value: config.halo.rimWidth },
    uHaloPush: { value: config.halo.push },
    uHaloScale: { value: new THREE.Vector2(config.halo.scaleX, config.halo.scaleY) },

    uOuterStart: { value: config.outer.startOffset },
    uOuterEnd: { value: config.outer.endOffset },
    uOuterFrequency: { value: config.outer.frequency },
    uOuterAmplitude: { value: config.outer.amplitude },

    uDotBaseSize: { value: config.dot.baseSize },
    uDotActiveSize: { value: config.dot.activeSize },
    uDotScale: { value: new THREE.Vector2(config.dot.scaleX, config.dot.scaleY) },
    uDotStretch: { value: config.dot.stretch },
    uRotationSpeed: { value: config.dot.rotationSpeed },
    uRotationJitter: { value: config.dot.rotationJitter },
    uOscillation: { value: config.dot.oscillation },

    uRestColor: { value: new THREE.Color('#1C1710') },
    uAccentA: { value: new THREE.Color('#FFC640') },
    uAccentB: { value: new THREE.Color('#FFF8E7') },
    uAccentC: { value: new THREE.Color('#FF9E2C') },
    uRestAlpha: { value: config.dot.restAlpha },
    uActiveAlpha: { value: config.dot.activeAlpha },
    uSoftness: { value: config.dot.softness },
  };

  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms,
    transparent: true,
    depthWrite: false,
  });

  // One quad, instanced per dot. InstancedBufferGeometry rather than
  // InstancedMesh: the per-instance matrix an InstancedMesh allocates would go
  // unused, since aOffset carries position and the shader does the rest.
  const quad = new THREE.PlaneGeometry(1, 1);
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.index = quad.index;
  geometry.attributes.position = quad.attributes.position;
  geometry.attributes.uv = quad.attributes.uv;

  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false; // bounds are meaningless: the shader places every instance
  scene.add(mesh);

  const viewport = { width: 1, height: 1 };
  let layout = { cols: 0, rows: 0 };

  function buildGrid() {
    const gridWidth = viewport.width * config.grid.padding;
    const gridHeight = viewport.height * config.grid.padding;

    const next = computeLayout({
      gridWidth,
      gridHeight,
      spacing: config.grid.spacing,
      maxInstances,
    });

    if (next.cols === layout.cols && next.rows === layout.rows) return;
    layout = next;

    const { offsets, randoms } = buildGridAttributes({
      cols: next.cols,
      rows: next.rows,
      gridWidth,
      gridHeight,
      spacing: next.spacing,
      jitterRatio: config.grid.jitterRatio,
    });

    // Swap the per-instance attributes in place. Rebuilding the geometry would
    // also tear down the quad's shared position/uv buffers.
    geometry.setAttribute('aOffset', new THREE.InstancedBufferAttribute(offsets, 3));
    geometry.setAttribute('aRandom', new THREE.InstancedBufferAttribute(randoms, 1));
    geometry.instanceCount = next.count;
  }

  // Pointer in NDC; cursor is its eased world-space counterpart.
  const pointer = { x: 0, y: 0 };
  const cursor = { x: 0, y: 0 };
  let hovering = true;

  function onPointerMove(event) {
    const ndc = pointerToNdc(event.clientX, event.clientY, window.innerWidth, window.innerHeight);
    pointer.x = ndc.x;
    pointer.y = ndc.y;
    hovering = true;
  }

  const onPointerLeave = () => {
    hovering = false;
  };
  const onPointerEnter = () => {
    hovering = true;
  };

  window.addEventListener('pointermove', onPointerMove, { passive: true });
  document.body.addEventListener('pointerleave', onPointerLeave);
  document.body.addEventListener('pointerenter', onPointerEnter);

  function update(elapsed) {
    uniforms.uTime.value = elapsed;
    if (!hovering) return;

    const target = cursorTarget({
      pointer,
      viewport,
      orbit: orbitRadius(viewport, config.cursor),
      elapsed,
    });

    cursor.x = ease(cursor.x, target.x, config.cursor.ease);
    cursor.y = ease(cursor.y, target.y, config.cursor.ease);
    uniforms.uCursor.value.set(cursor.x, cursor.y);
  }

  function resize(width, height) {
    // A zero or non-finite dimension would yield a NaN grid extent and silently
    // build an empty field. Keep the last good layout instead.
    if (!(width > 0) || !(height > 0)) return;

    const aspect = width / height;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();

    const extent = visibleExtent({
      fov: config.camera.fov,
      distance: config.camera.distance,
      aspect,
    });
    viewport.width = extent.width;
    viewport.height = extent.height;

    buildGrid();
  }

  function setTheme(palette) {
    uniforms.uRestColor.value.set(palette.grid.rest);
    uniforms.uAccentA.value.set(palette.grid.accents[0]);
    uniforms.uAccentB.value.set(palette.grid.accents[1]);
    uniforms.uAccentC.value.set(palette.grid.accents[2]);
  }

  function dispose() {
    window.removeEventListener('pointermove', onPointerMove);
    document.body.removeEventListener('pointerleave', onPointerLeave);
    document.body.removeEventListener('pointerenter', onPointerEnter);
    geometry.dispose();
    quad.dispose();
    material.dispose();
  }

  resize(window.innerWidth, window.innerHeight);

  return { scene, camera, update, resize, setTheme, dispose, uniforms, config };
}
