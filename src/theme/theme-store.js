/**
 * Theme state: resolution, persistence and change notification.
 *
 * An inline script in index.html sets `data-theme` on <html> before first paint
 * so the page never flashes the wrong palette. This module adopts whatever that
 * script decided, then owns every change after it.
 */

import { DEFAULT_THEME, THEMES, isThemeName } from './palettes.js';

const STORAGE_KEY = 'theme';

/**
 * Pure resolution rule, shared in spirit with the inline script in index.html:
 * an explicit stored choice wins, otherwise follow the OS.
 */
export function resolveTheme({ stored, prefersLight }) {
  if (isThemeName(stored)) return stored;
  return prefersLight ? 'light' : DEFAULT_THEME;
}

const listeners = new Set();

let current = isThemeName(document.documentElement.dataset.theme)
  ? document.documentElement.dataset.theme
  : DEFAULT_THEME;

export function getTheme() {
  return current;
}

export function getPalette(name = current) {
  return THEMES[name] ?? THEMES[DEFAULT_THEME];
}

export function setTheme(name) {
  current = isThemeName(name) ? name : DEFAULT_THEME;
  document.documentElement.dataset.theme = current;

  try {
    localStorage.setItem(STORAGE_KEY, current);
  } catch {
    // Private browsing can refuse writes; the theme still applies for this visit.
  }

  listeners.forEach((fn) => fn(current, THEMES[current]));
}

export function toggleTheme() {
  setTheme(current === 'dark' ? 'light' : 'dark');
}

/**
 * Subscribers fire immediately with the current theme, so callers don't have to
 * apply the palette once and then subscribe separately.
 *
 * @returns {() => void} unsubscribe
 */
export function onThemeChange(fn) {
  listeners.add(fn);
  fn(current, THEMES[current]);
  return () => listeners.delete(fn);
}

/** Test seam: drop all subscribers and re-read the DOM. */
export function __resetThemeStore() {
  listeners.clear();
  current = isThemeName(document.documentElement.dataset.theme)
    ? document.documentElement.dataset.theme
    : DEFAULT_THEME;
}
