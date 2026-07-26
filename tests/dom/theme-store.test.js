// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The store reads `data-theme` at module-evaluation time, so each test resets
 * the DOM and re-imports it rather than sharing one instance.
 */
async function loadStore({ theme = 'dark' } = {}) {
  document.documentElement.dataset.theme = theme;
  vi.resetModules();
  return import('../../src/theme/theme-store.js');
}

beforeEach(() => {
  localStorage.clear();
  delete document.documentElement.dataset.theme;
});

describe('resolveTheme', () => {
  it('prefers an explicit stored choice over the OS setting', async () => {
    const { resolveTheme } = await loadStore();
    expect(resolveTheme({ stored: 'dark', prefersLight: true })).toBe('dark');
    expect(resolveTheme({ stored: 'light', prefersLight: false })).toBe('light');
  });

  it('follows the OS when nothing is stored', async () => {
    const { resolveTheme } = await loadStore();
    expect(resolveTheme({ stored: null, prefersLight: true })).toBe('light');
    expect(resolveTheme({ stored: null, prefersLight: false })).toBe('dark');
  });

  it('ignores a corrupted stored value', async () => {
    const { resolveTheme } = await loadStore();
    expect(resolveTheme({ stored: 'chartreuse', prefersLight: false })).toBe('dark');
    expect(resolveTheme({ stored: '', prefersLight: true })).toBe('light');
  });
});

describe('theme store', () => {
  it('adopts the theme the inline script already applied', async () => {
    const { getTheme } = await loadStore({ theme: 'light' });
    expect(getTheme()).toBe('light');
  });

  it('falls back to dark when the attribute is missing or junk', async () => {
    const { getTheme } = await loadStore({ theme: 'neon' });
    expect(getTheme()).toBe('dark');
  });

  it('writes the theme to the document and to storage', async () => {
    const { setTheme } = await loadStore();
    setTheme('light');

    expect(document.documentElement.dataset.theme).toBe('light');
    expect(localStorage.getItem('theme')).toBe('light');
  });

  it('rejects an unknown theme by falling back to the default', async () => {
    const { setTheme, getTheme } = await loadStore({ theme: 'light' });
    setTheme('vaporwave');
    expect(getTheme()).toBe('dark');
  });

  it('toggles between the two themes', async () => {
    const { toggleTheme, getTheme } = await loadStore({ theme: 'dark' });

    toggleTheme();
    expect(getTheme()).toBe('light');
    toggleTheme();
    expect(getTheme()).toBe('dark');
  });

  it('returns the matching palette, and the default for an unknown name', async () => {
    const { getPalette } = await loadStore({ theme: 'light' });

    expect(getPalette().grid.accents[0]).toBe('#4285F4');
    expect(getPalette('dark').grid.accents[0]).toBe('#FFC640');
    expect(getPalette('nonsense')).toEqual(getPalette('dark'));
  });

  it('notifies subscribers immediately on subscribe', async () => {
    const { onThemeChange } = await loadStore({ theme: 'light' });
    const seen = vi.fn();

    onThemeChange(seen);

    expect(seen).toHaveBeenCalledTimes(1);
    expect(seen.mock.calls[0][0]).toBe('light');
    expect(seen.mock.calls[0][1].grid.rest).toBe('#DADCE0');
  });

  it('notifies subscribers on every change', async () => {
    const { onThemeChange, setTheme } = await loadStore({ theme: 'dark' });
    const seen = vi.fn();

    onThemeChange(seen);
    setTheme('light');
    setTheme('dark');

    expect(seen).toHaveBeenCalledTimes(3); // initial + two changes
    expect(seen.mock.calls.map((c) => c[0])).toEqual(['dark', 'light', 'dark']);
  });

  it('stops notifying after unsubscribe', async () => {
    const { onThemeChange, setTheme } = await loadStore();
    const seen = vi.fn();

    const unsubscribe = onThemeChange(seen);
    unsubscribe();
    setTheme('light');

    expect(seen).toHaveBeenCalledTimes(1); // only the initial call
  });

  it('supports several independent subscribers', async () => {
    const { onThemeChange, setTheme } = await loadStore();
    const a = vi.fn();
    const b = vi.fn();

    onThemeChange(a);
    onThemeChange(b);
    setTheme('light');

    expect(a).toHaveBeenCalledTimes(2);
    expect(b).toHaveBeenCalledTimes(2);
  });

  it('still applies the theme when storage refuses writes', async () => {
    const { setTheme, getTheme } = await loadStore();
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError'); // private browsing
    });

    expect(() => setTheme('light')).not.toThrow();
    expect(getTheme()).toBe('light');
    expect(document.documentElement.dataset.theme).toBe('light');

    spy.mockRestore();
  });
});
