/**
 * Colour that CSS custom properties can't express: shader uniforms and Three.js
 * material colours. The CSS side of each theme lives in style.css under a
 * matching `:root[data-theme=...]` block -- keep the two in step.
 */

export const THEMES = {
  dark: {
    grid: {
      rest: '#1C1710',
      accents: ['#FFC640', '#FFF8E7', '#FF9E2C'],
    },
    scene: {
      body: 'moon',
      torus: '#FFC640',
      torusEmissive: '#2A1C00',
      torusWire: '#FFF8E7',
      shard: '#6E6E6E',
      star: '#FFF8E7',
      moonTint: '#EEEEFF',
      keyLight: '#FFD700',
      keyIntensity: 2,
      rimLight: '#FFF2CC',
      moonLight: '#CCDDEE',
      moonIntensity: 2,
      ambientIntensity: 0.5,
    },
  },
  light: {
    grid: {
      rest: '#DADCE0',
      accents: ['#4285F4', '#EA4335', '#FBBC04'],
    },
    scene: {
      body: 'sun',
      torus: '#1A73E8',
      torusEmissive: '#001B3D',
      torusWire: '#202124',
      shard: '#9AA0A6',
      star: '#BDC1C6',
      moonTint: '#FFFFFF',
      keyLight: '#FFFFFF',
      keyIntensity: 1.2,
      rimLight: '#DCE7FF',
      moonLight: '#FFE9B8',
      moonIntensity: 1.6,
      ambientIntensity: 1.1,
    },
  },
};

export const THEME_NAMES = Object.keys(THEMES);
export const DEFAULT_THEME = 'dark';

export function isThemeName(value) {
  return value === 'dark' || value === 'light';
}
