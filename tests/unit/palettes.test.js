import { describe, expect, it } from 'vitest';
import { DEFAULT_THEME, THEMES, THEME_NAMES, isThemeName } from '../../src/theme/palettes.js';

const HEX = /^#[0-9A-Fa-f]{6}$/;

describe('palettes', () => {
  it('defines exactly the dark and light themes', () => {
    expect(THEME_NAMES.sort()).toEqual(['dark', 'light']);
    expect(THEMES[DEFAULT_THEME]).toBeDefined();
  });

  it.each(THEME_NAMES)('%s exposes a rest colour and three accents', (name) => {
    const { grid } = THEMES[name];
    expect(grid.rest).toMatch(HEX);
    expect(grid.accents).toHaveLength(3);
    grid.accents.forEach((hex) => expect(hex).toMatch(HEX));
  });

  it.each(THEME_NAMES)('%s defines every scene colour the renderer reads', (name) => {
    const { scene } = THEMES[name];
    [
      'torus',
      'torusEmissive',
      'torusWire',
      'shard',
      'star',
      'moonTint',
      'keyLight',
      'rimLight',
      'moonLight',
    ].forEach((key) => {
      expect(scene[key]).toMatch(HEX);
    });
  });

  it('shows the moon at night and the sun by day', () => {
    expect(THEMES.dark.scene.body).toBe('moon');
    expect(THEMES.light.scene.body).toBe('sun');
  });

  it.each(THEME_NAMES)('%s defines finite, non-negative light intensities', (name) => {
    const { scene } = THEMES[name];
    ['keyIntensity', 'moonIntensity', 'ambientIntensity'].forEach((key) => {
      expect(Number.isFinite(scene[key])).toBe(true);
      expect(scene[key]).toBeGreaterThanOrEqual(0);
    });
  });

  it('keeps both themes structurally identical, so neither drifts', () => {
    const shape = (obj) => Object.keys(obj).sort();
    expect(shape(THEMES.dark.scene)).toEqual(shape(THEMES.light.scene));
    expect(shape(THEMES.dark.grid)).toEqual(shape(THEMES.light.grid));
  });

  it('lights the scene more brightly in light mode, to survive a pale background', () => {
    expect(THEMES.light.scene.ambientIntensity).toBeGreaterThan(
      THEMES.dark.scene.ambientIntensity
    );
  });

  describe('isThemeName', () => {
    it('accepts the two real themes', () => {
      expect(isThemeName('dark')).toBe(true);
      expect(isThemeName('light')).toBe(true);
    });

    it('rejects anything else', () => {
      [null, undefined, '', 'DARK', 'sepia', 0, {}].forEach((value) => {
        expect(isThemeName(value)).toBe(false);
      });
    });
  });
});
