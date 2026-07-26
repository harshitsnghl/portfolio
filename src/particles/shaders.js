/**
 * GLSL for the particle field.
 *
 * Beware GLSL ES reserved words when editing -- `active`, `input`, `output`,
 * `filter`, `sizeof` and friends are all reserved and fail to compile with a
 * bare "illegal use of reserved word", which nothing but a real GL context will
 * catch. The e2e smoke test exists mainly to catch this.
 */

export const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform vec2  uCursor;

  uniform float uDriftSpeed;
  uniform float uDriftAmplitude;

  uniform float uHaloRadiusBase;
  uniform float uHaloRadiusAmplitude;
  uniform float uHaloBreathSpeed;
  uniform float uHaloShapeAmplitude;
  uniform float uHaloShapeSpeed;
  uniform float uHaloRimWidth;
  uniform float uHaloPush;
  uniform vec2  uHaloScale;

  uniform float uOuterStart;
  uniform float uOuterEnd;
  uniform float uOuterFrequency;
  uniform float uOuterAmplitude;

  uniform float uDotBaseSize;
  uniform float uDotActiveSize;
  uniform vec2  uDotScale;
  uniform float uDotStretch;
  uniform float uRotationSpeed;
  uniform float uRotationJitter;
  uniform float uOscillation;

  attribute vec3  aOffset;
  attribute float aRandom;

  varying vec2  vQuadUv;
  varying float vRim;
  varying vec2  vWorld;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
  }

  float valueNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i),                  hash(i + vec2(1.0, 0.0)), f.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
      f.y
    );
  }

  void main() {
    vQuadUv = uv;

    // 1. Idle drift. Both axes read the undrifted position so the motion stays
    //    symmetric rather than depending on evaluation order.
    vec2 base = aOffset.xy;
    float dt = uTime * uDriftSpeed;
    vec2 drift = vec2(
      sin(dt + base.y * 0.5) + sin(dt * 0.5 + base.y * 2.0),
      cos(dt + base.x * 0.5) + cos(dt * 0.5 + base.x * 2.0)
    ) * uDriftAmplitude;

    vec3 center = vec3(base + drift, aOffset.z);

    // 2. The breathing rim. abs(dist - radius) is the whole effect: influence
    //    peaks on a ring that expands and contracts, not at the cursor itself.
    vec2 toCursor = center.xy - uCursor;
    vec2 radial = normalize(toCursor + vec2(1e-4, 0.0));
    float dist = length(toCursor / max(uHaloScale, vec2(1e-4)));

    float breath = sin(uTime * uHaloBreathSpeed);
    float baseRadius = uHaloRadiusBase + breath * uHaloRadiusAmplitude;
    float wobble = valueNoise(radial * 2.0 + vec2(0.0, uTime * uHaloShapeSpeed));
    float radius = baseRadius + wobble * uHaloShapeAmplitude;

    float rim = smoothstep(uHaloRimWidth, 0.0, abs(dist - radius));

    center.xy += radial * rim * (breath * 0.5 + 0.5) * uHaloPush;
    center.z  += rim * 0.3 * sin(uTime);

    // 3. Outer sway, gated so it only affects dots past the halo.
    float outerGate = smoothstep(baseRadius + uOuterStart, baseRadius + uOuterEnd, dist);
    float sway = sin(uTime * uOuterFrequency + center.x * 0.6 + center.y * 0.6);
    center.xy += radial * sway * uOuterAmplitude * outerGate;

    // 4. Size: dots swell and elongate as the rim passes over them.
    float size = uDotBaseSize + sin(uTime + center.x) * 0.003 + rim * uDotActiveSize;
    vec3 quad = position;
    quad.x *= (size + rim * uDotStretch) * uDotScale.x;
    quad.y *= size * uDotScale.y;

    // 5. Point the long axis away from the cursor, with a per-instance
    //    oscillation so the dashes never line up too mechanically.
    float phase = aRandom * 6.28318530718;
    float osc = 0.5 + 0.5 * sin(uTime * (0.25 + uOscillation * 0.35) + phase);
    float speedScale  = mix(0.55, 1.35, osc) * (0.8  + uOscillation * 0.2);
    float jitterScale = mix(0.70, 1.45, osc) * (0.85 + uOscillation * 0.15);
    float jitter = sin(uTime * uRotationSpeed * speedScale + center.x * 0.35 + center.y * 0.35)
                 * uRotationJitter * jitterScale;

    vec2 axis = normalize(radial + vec2(-radial.y, radial.x) * jitter);
    quad.xy = mat2(axis.x, axis.y, -axis.y, axis.x) * quad.xy;

    vRim = rim;
    vWorld = center.xy;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(center + quad, 1.0);
  }
`;

export const fragmentShader = /* glsl */ `
  uniform float uTime;
  uniform vec3  uRestColor;
  uniform vec3  uAccentA;
  uniform vec3  uAccentB;
  uniform vec3  uAccentC;
  uniform float uRestAlpha;
  uniform float uActiveAlpha;
  uniform float uSoftness;

  varying vec2  vQuadUv;
  varying float vRim;
  varying vec2  vWorld;

  void main() {
    // Superellipse mask turns the quad into a capsule with soft ends.
    // pow() of an exact zero is undefined on some drivers, hence the floor.
    vec2 p = max(abs(vQuadUv - 0.5) * 2.0, vec2(1e-4));
    float d = pow(pow(p.x, uSoftness) + pow(p.y, uSoftness), 1.0 / uSoftness);
    float mask = 1.0 - smoothstep(0.8, 1.0, d);
    if (mask < 0.01) discard;

    // Accents travel across the field so the lit band never looks flat.
    float t = uTime * 1.2;
    float a = sin(vWorld.x * 0.8 + t);
    float b = sin(vWorld.y * 0.8 + t * 0.8 + a);
    vec3 lit = mix(uAccentA, uAccentB, a * 0.5 + 0.5);
    lit = mix(lit, uAccentC, b * 0.5 + 0.5);

    vec3 color = mix(uRestColor, lit, smoothstep(0.1, 0.8, vRim));
    gl_FragColor = vec4(color, mask * mix(uRestAlpha, uActiveAlpha, vRim));
  }
`;
