/** Wires the theme button: label, pressed state and icon follow the store. */

import { onThemeChange, toggleTheme } from './theme-store.js';

export function initThemeToggle(selector = '#theme-toggle') {
  const button = document.querySelector(selector);
  if (!button) return () => {};

  const icon = button.querySelector('i');

  const unsubscribe = onThemeChange((name) => {
    // The icon shows the destination, not the current state.
    const goingTo = name === 'dark' ? 'light' : 'dark';
    button.setAttribute('aria-label', `Switch to ${goingTo} theme`);
    button.setAttribute('aria-pressed', String(name === 'light'));
    if (icon) icon.className = name === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
  });

  button.addEventListener('click', toggleTheme);

  return () => {
    unsubscribe();
    button.removeEventListener('click', toggleTheme);
  };
}
