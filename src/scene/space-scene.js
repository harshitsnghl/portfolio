/**
 * The foreground 3D scene: torus, drifting shards, stars, and a celestial body
 * that is the moon in dark mode and the sun in light mode.
 *
 * Drawn on top of the particle field, sharing its renderer. Deliberately has no
 * background colour -- the page background is a CSS variable so it can follow
 * the theme, and an opaque clear here would paint over the field behind it.
 *
 * All surface detail is generated in ./textures.js rather than loaded as
 * images, so it stays sharp at any zoom and can be recoloured per theme.
 */

import * as THREE from 'three';
import {
  createDefinitionTexture,
  createGlowTexture,
  createMoonTextures,
  createSunTexture,
} from './textures.js';

export const SCENE_CONFIG = {
  starCount: 40, // the particle field now carries the starfield read
  shardCount: 50,
  spread: 100,
  cameraZ: 30,
  cameraX: -3,
  parallaxStrength: 0.001,
  parallaxEase: 0.05,
  bodyRadius: 3,
  bodyPosition: [-10, 0, 30],
};

export function createSpaceScene({ config = SCENE_CONFIG } = {}) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.setZ(config.cameraZ);
  camera.position.setX(config.cameraX);
  camera.layers.enable(1); // the celestial body is isolated on layer 1

  const spread = () => THREE.MathUtils.randFloatSpread(config.spread);

  /* -------------------------------------------------- Torus */

  // Solid and polished rather than wireframe: a wireframe torus reads as a
  // skeleton, this reads as a classic metal ring catching the key light.
  const torusGeometry = new THREE.TorusGeometry(10, 2.6, 48, 220);
  const torusMaterial = new THREE.MeshStandardMaterial({
    color: 0xffc640,
    metalness: 0.95,
    roughness: 0.22,
    emissive: 0x2a1c00,
    emissiveIntensity: 0.6,
  });
  const torus = new THREE.Mesh(torusGeometry, torusMaterial);

  // A faint wireframe shell keeps a trace of the original engineered look
  // without the whole ring being nothing but scaffolding.
  const torusWireGeometry = new THREE.TorusGeometry(10, 2.62, 16, 90);
  const torusWireMaterial = new THREE.MeshBasicMaterial({
    color: 0xfff8e7,
    wireframe: true,
    transparent: true,
    opacity: 0.12,
  });
  const torusWire = new THREE.Mesh(torusWireGeometry, torusWireMaterial);

  const torusGroup = new THREE.Group();
  torusGroup.add(torus, torusWire);
  scene.add(torusGroup);

  /* -------------------------------------------------- Lights */

  const keyLight = new THREE.PointLight(0xffd700, 2);
  keyLight.position.set(5, 5, 5);
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  const rimLight = new THREE.DirectionalLight(0xfff2cc, 0.8);
  rimLight.position.set(-8, 4, 12);
  scene.add(keyLight, ambientLight, rimLight);

  // Layer 1 lights only the celestial body, so its shading stays independent
  // of the warm scene lighting.
  const bodyLight = new THREE.DirectionalLight(0xccddee, 2);
  bodyLight.position.set(10, 6, 10);
  bodyLight.layers.set(1);
  scene.add(bodyLight);

  /* -------------------------------------------------- Stars and shards */

  // Shared geometry and material, so the field costs one draw setup rather
  // than one per object.
  const starGeometry = new THREE.SphereGeometry(0.2, 12, 12);
  const starMaterial = new THREE.MeshStandardMaterial({
    color: 0xfff8e7,
    transparent: true,
    opacity: 0.7,
  });
  for (let i = 0; i < config.starCount; i++) {
    const star = new THREE.Mesh(starGeometry, starMaterial);
    star.position.set(spread(), spread(), spread());
    scene.add(star);
  }

  const shardGeometry = new THREE.IcosahedronGeometry(1, 0);
  const shardMaterial = new THREE.MeshStandardMaterial({
    color: 0x6e6e6e,
    wireframe: true,
    transparent: true,
    opacity: 0.35,
  });
  const shards = [];
  for (let i = 0; i < config.shardCount; i++) {
    const shard = new THREE.Mesh(shardGeometry, shardMaterial);
    shard.position.set(spread(), spread(), spread());
    scene.add(shard);
    shards.push(shard);
  }

  /* -------------------------------------------------- Avatar cube */

  const definitionTexture = createDefinitionTexture();
  const avatarMaterial = new THREE.MeshBasicMaterial({
    map: definitionTexture,
    transparent: true,
    opacity: 0.9,
  });
  const avatar = new THREE.Mesh(new THREE.BoxGeometry(3, 3, 3), avatarMaterial);
  avatar.position.set(2, 0, -5);
  scene.add(avatar);

  /* -------------------------------------------------- Moon and sun */

  const body = new THREE.Group();
  body.position.set(...config.bodyPosition);
  scene.add(body);

  const bodyGeometry = new THREE.SphereGeometry(config.bodyRadius, 96, 96);

  const { map: moonMap, bumpMap: moonBump } = createMoonTextures();
  const moonMaterial = new THREE.MeshStandardMaterial({
    map: moonMap,
    bumpMap: moonBump,
    bumpScale: 0.55, // craters catch the light instead of reading as a print
    color: 0xeeeeff,
    roughness: 0.95,
    metalness: 0,
  });
  const moon = new THREE.Mesh(bodyGeometry, moonMaterial);
  moon.layers.set(1);
  body.add(moon);

  const sunMaterial = new THREE.MeshBasicMaterial({ map: createSunTexture() });
  const sun = new THREE.Mesh(bodyGeometry, sunMaterial);
  sun.layers.set(1);
  sun.visible = false;
  body.add(sun);

  // Aura. Additive blending so it reads as bloom rather than a painted disc,
  // and depthWrite off so it never punches a hole in what is behind it.
  function makeGlow(inner, outer, scale) {
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: createGlowTexture({ inner, outer }),
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
        depthTest: false,
      })
    );
    sprite.scale.setScalar(config.bodyRadius * scale);
    sprite.layers.set(1);
    return sprite;
  }

  const moonGlow = makeGlow('#dce6ff', '#8fa8d8', 5.2);
  const sunGlow = makeGlow('#fff3c4', '#ff8a1f', 7.5);
  sunGlow.visible = false;
  body.add(moonGlow, sunGlow);

  const pointer = { x: 0, y: 0 };
  let activeGlow = moonGlow;

  return {
    scene,
    camera,

    /** Pointer offset from viewport centre, in pixels. */
    setPointer(x, y) {
      pointer.x = x;
      pointer.y = y;
    },

    /** Scroll-driven camera dolly, plus a nudge to the body and avatar. */
    applyScroll(top) {
      body.rotation.x += 0.005;
      body.rotation.y += 0.0075;
      body.rotation.z += 0.005;

      avatar.rotation.y += 0.01;
      avatar.rotation.z += 0.01;

      camera.position.z = top * -0.01;
      camera.position.x = top * -0.0002;
      camera.rotation.y = top * -0.0002;
    },

    update(elapsed) {
      torusGroup.rotation.z += 0.002;
      torus.rotation.x += 0.01;
      torus.rotation.y += 0.005;
      torusWire.rotation.x = torus.rotation.x;
      torusWire.rotation.y = torus.rotation.y;

      avatar.rotation.x -= 0.005;
      avatar.rotation.y -= 0.0025;
      avatar.rotation.z -= 0.005;

      // Slow spin so the surface detail is visible even without scrolling.
      moon.rotation.y += 0.0009;
      sun.rotation.y += 0.0014;

      // Aura breathes gently; a fixed-size glow looks like a decal.
      activeGlow.scale.setScalar(
        config.bodyRadius * (activeGlow === sunGlow ? 7.5 : 5.2) * (1 + Math.sin(elapsed * 0.6) * 0.04)
      );

      shards.forEach((shard, i) => {
        shard.rotation.x += 0.01;
        shard.rotation.y += 0.01;
        shard.position.y += Math.sin(elapsed + i) * 0.01;
      });

      // Parallax tilts the group, leaving the mesh free to spin on its own.
      const targetX = pointer.x * config.parallaxStrength;
      const targetY = pointer.y * config.parallaxStrength;
      torusGroup.rotation.y += config.parallaxEase * (targetX - torusGroup.rotation.y);
      torusGroup.rotation.x += config.parallaxEase * (targetY - torusGroup.rotation.x);
    },

    resize(width, height) {
      if (!(width > 0) || !(height > 0)) return;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    },

    setTheme(palette) {
      torusMaterial.color.set(palette.scene.torus);
      torusMaterial.emissive.set(palette.scene.torusEmissive);
      torusWireMaterial.color.set(palette.scene.torusWire);
      shardMaterial.color.set(palette.scene.shard);
      starMaterial.color.set(palette.scene.star);

      keyLight.color.set(palette.scene.keyLight);
      keyLight.intensity = palette.scene.keyIntensity;
      rimLight.color.set(palette.scene.rimLight);
      bodyLight.color.set(palette.scene.moonLight);
      bodyLight.intensity = palette.scene.moonIntensity;
      ambientLight.intensity = palette.scene.ambientIntensity;

      // The moon belongs to the night sky, the sun to the day one.
      const isLight = palette.scene.body === 'sun';
      moon.visible = !isLight;
      moonGlow.visible = !isLight;
      sun.visible = isLight;
      sunGlow.visible = isLight;
      activeGlow = isLight ? sunGlow : moonGlow;

      // Stars would be invisible against a near-white page anyway; fading them
      // keeps light mode from looking like speckled dirt.
      starMaterial.opacity = isLight ? 0.28 : 0.7;
    },

    dispose() {
      [torusGeometry, torusWireGeometry, starGeometry, shardGeometry, bodyGeometry].forEach((g) =>
        g.dispose()
      );
      [
        torusMaterial,
        torusWireMaterial,
        starMaterial,
        shardMaterial,
        avatarMaterial,
        moonMaterial,
        sunMaterial,
      ].forEach((m) => m.dispose());
      [definitionTexture, moonMap, moonBump].forEach((t) => t.dispose());
    },
  };
}
