// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

async function mount({ theme = 'dark', markup } = {}) {
  document.documentElement.dataset.theme = theme;
  document.body.innerHTML =
    markup ??
    `<button id="theme-toggle" type="button" aria-label="Switch theme">
       <i class="fa-solid fa-sun"></i>
     </button>`;

  vi.resetModules();
  const { initThemeToggle } = await import('../../src/theme/theme-toggle.js');
  const store = await import('../../src/theme/theme-store.js');

  return { teardown: initThemeToggle(), store, button: document.querySelector('#theme-toggle') };
}

beforeEach(() => {
  localStorage.clear();
  document.body.innerHTML = '';
});

describe('initThemeToggle', () => {
  it('labels the button with the destination theme, not the current one', async () => {
    const { button } = await mount({ theme: 'dark' });
    expect(button.getAttribute('aria-label')).toBe('Switch to light theme');
  });

  it('shows a sun in dark mode and a moon in light mode', async () => {
    const { button } = await mount({ theme: 'dark' });
    const icon = button.querySelector('i');

    expect(icon.className).toBe('fa-solid fa-sun');
    button.click();
    expect(icon.className).toBe('fa-solid fa-moon');
  });

  it('reflects the theme in aria-pressed', async () => {
    const { button } = await mount({ theme: 'dark' });

    expect(button.getAttribute('aria-pressed')).toBe('false');
    button.click();
    expect(button.getAttribute('aria-pressed')).toBe('true');
  });

  it('switches the theme on click', async () => {
    const { button, store } = await mount({ theme: 'dark' });

    button.click();
    expect(store.getTheme()).toBe('light');
    expect(document.documentElement.dataset.theme).toBe('light');

    button.click();
    expect(store.getTheme()).toBe('dark');
  });

  it('persists the choice across clicks', async () => {
    const { button } = await mount({ theme: 'dark' });
    button.click();
    expect(localStorage.getItem('theme')).toBe('light');
  });

  it('syncs the button when the theme changes elsewhere', async () => {
    const { button, store } = await mount({ theme: 'dark' });

    store.setTheme('light');

    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(button.querySelector('i').className).toBe('fa-solid fa-moon');
  });

  it('is a no-op when the button is absent', async () => {
    document.documentElement.dataset.theme = 'dark';
    document.body.innerHTML = '<div>no toggle here</div>';
    vi.resetModules();
    const { initThemeToggle } = await import('../../src/theme/theme-toggle.js');

    expect(() => initThemeToggle()).not.toThrow();
    expect(typeof initThemeToggle()).toBe('function');
  });

  it('tolerates a button with no icon element', async () => {
    const { button, store } = await mount({
      markup: '<button id="theme-toggle" type="button"></button>',
    });

    expect(() => button.click()).not.toThrow();
    expect(store.getTheme()).toBe('light');
  });

  it('stops responding after teardown', async () => {
    const { button, store, teardown } = await mount({ theme: 'dark' });

    teardown();
    button.click();

    expect(store.getTheme()).toBe('dark');
  });
});
