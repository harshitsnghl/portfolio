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
import { auraOpacity, auraScale } from './aura.js';
import {
  createDefinitionTexture,
  createGlowTexture,
  createRibbedTextures,
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
  //
  // Ribbed rather than bare. A ring in one flat colour is symmetric about its
  // own axis, so spinning it changes nothing on screen and it looks parked --
  // ribs banded around the tube read like a tyre tread, sweeping past as the
  // wheel turns.
  const torusGeometry = new THREE.TorusGeometry(10, 2.6, 48, 220);
  const {
    map: ribMap,
    bumpMap: ribBump,
    roughnessMap: ribRoughness,
  } = createRibbedTextures();
  const torusMaterial = new THREE.MeshStandardMaterial({
    color: 0xffc640,
    map: ribMap,
    bumpMap: ribBump,
    bumpScale: 0.14,
    roughnessMap: ribRoughness,
    metalness: 0.95,
    // Three multiplies this by the map, so 1 hands the whole range to the
    // texture rather than flattening it back out.
    roughness: 1,
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

  // A cool light aimed to shape the celestial body. Note that the layer does
  // NOT confine it: Three collects a light whenever `light.layers.test(camera.layers)`
  // passes, and the camera has layer 1 enabled, so this reaches every object in
  // the scene. Per-object light masking isn't a thing here -- anything the body
  // needs and the rest of the scene must not get has to come from its material.
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

  // Solid faceted body plus a bright outline, rather than bare wireframe. A
  // pure wireframe at low opacity disappears into the particle field behind it;
  // filling the faces gives the form volume, and keeping the edges preserves
  // the icosahedral structure that a plain solid would throw away.
  //
  // Edge weight comes from colour contrast, not from LineBasicMaterial's
  // `linewidth` -- WebGL caps that at 1px on every major platform and ignores
  // anything larger without warning.
  const shardGeometry = new THREE.IcosahedronGeometry(1, 0);
  const shardMaterial = new THREE.MeshStandardMaterial({
    color: 0x6e6e6e,
    flatShading: true,
    metalness: 0.35,
    roughness: 0.45,
    transparent: true,
    opacity: 0.38,
  });
  const shardEdgeGeometry = new THREE.EdgesGeometry(shardGeometry);
  const shardEdgeMaterial = new THREE.LineBasicMaterial({
    color: 0xffd98a,
    transparent: true,
    opacity: 0.95,
  });

  const shards = [];
  for (let i = 0; i < config.shardCount; i++) {
    const shard = new THREE.Mesh(shardGeometry, shardMaterial);
    shard.position.set(spread(), spread(), spread());
    // Varied sizes read as depth; fifty identical shards read as a pattern.
    shard.scale.setScalar(THREE.MathUtils.randFloat(0.6, 1.6));
    // Added as a child so the outline inherits the shard's drift and spin.
    shard.add(new THREE.LineSegments(shardEdgeGeometry, shardEdgeMaterial));
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
    // A full moon is lit head-on: bright across the whole disc, no terminator
    // sweeping it. Emissive doesn't care where the lights are, so it holds the
    // face evenly bright while the directional above still gives the craters
    // their relief. Doing this with an actual light would brighten the torus
    // and shards too, since lights here can't be masked per object.
    emissive: 0xffffff,
    emissiveMap: moonMap,
    emissiveIntensity: 0.55,
  });
  const moon = new THREE.Mesh(bodyGeometry, moonMaterial);
  moon.layers.set(1);
  body.add(moon);

  const sunTexture = createSunTexture();
  const sunMaterial = new THREE.MeshBasicMaterial({ map: sunTexture });
  const sun = new THREE.Mesh(bodyGeometry, sunMaterial);
  sun.layers.set(1);
  sun.visible = false;
  body.add(sun);

  // Aura, drawn with depthWrite off so it never punches a hole in what is
  // behind it.
  //
  // `core` is where the body's limb lands inside the sprite: the sprite's
  // half-width is bodyRadius * scale / 2 and the disc's radius is bodyRadius,
  // so the limb sits at 2 / scale. Everything inside that is transparent.
  // Without it, depthTest being off means the gradient's bright centre paints
  // straight over the face of the body and reads as a blob in the middle of it.
  function makeGlow(inner, outer, scale, blending) {
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: createGlowTexture({ inner, outer, core: 2 / scale }),
        blending,
        transparent: true,
        depthWrite: false,
        depthTest: false,
      })
    );
    sprite.scale.setScalar(config.bodyRadius * scale);
    sprite.userData.baseScale = config.bodyRadius * scale;
    sprite.layers.set(1);
    return sprite;
  }

  // Additive reads as bloom against a near-black sky, but it is a no-op over a
  // near-white page -- adding light to white leaves white, which is why the sun
  // had no visible aura in light mode. Normal blending instead, so the warm
  // halo actually paints.
  const moonGlow = makeGlow('#dce6ff', '#8fa8d8', 5.2, THREE.AdditiveBlending);
  const sunGlow = makeGlow('#fff3c4', '#ff8a1f', 7.5, THREE.NormalBlending);
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

      // Aura breathes gently; a fixed-size glow looks like a decal. On top of
      // that it grows and gains opacity with distance, because a size-attenuated
      // sprite shrinks its own falloff into nothing and the halo drops out
      // entirely once the body is far away.
      const distance = camera.position.distanceTo(body.position);
      activeGlow.scale.setScalar(
        auraScale({ distance, baseScale: activeGlow.userData.baseScale }) *
          (1 + Math.sin(elapsed * 0.6) * 0.04)
      );
      activeGlow.material.opacity = auraOpacity({ distance });

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
      shardEdgeMaterial.color.set(palette.scene.shardEdge);
      starMaterial.color.set(palette.scene.star);
      moonMaterial.emissiveIntensity = palette.scene.moonEmissive;

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
      [
        torusGeometry,
        torusWireGeometry,
        starGeometry,
        shardGeometry,
        shardEdgeGeometry,
        bodyGeometry,
      ].forEach((g) => g.dispose());
      [
        torusMaterial,
        torusWireMaterial,
        starMaterial,
        shardMaterial,
        shardEdgeMaterial,
        avatarMaterial,
        moonMaterial,
        sunMaterial,
        moonGlow.material,
        sunGlow.material,
      ].forEach((m) => m.dispose());
      [
        definitionTexture,
        moonMap,
        moonBump,
        sunTexture,
        ribMap,
        ribBump,
        ribRoughness,
        moonGlow.material.map,
        sunGlow.material.map,
      ].forEach((t) => t.dispose());
    },
  };
}
