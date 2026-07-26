import { expect, test } from '@playwright/test';

/**
 * These exist for one reason above all: GLSL compiles at runtime, in a real GL
 * context, and nothing else in the suite can see it. The bug that broke this
 * feature was a reserved word (`active`) in the fragment shader -- syntactically
 * fine JavaScript, a clean `vite build`, and a completely blank background.
 */

/** Collect console errors and uncaught exceptions for the life of the page. */
function watchForErrors(page) {
  const errors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(String(error)));
  return errors;
}

const ready = (page) => page.waitForFunction(() => window.__portfolio !== undefined);

test.describe('background rendering', () => {
  test('loads with no console errors', async ({ page }) => {
    const errors = watchForErrors(page);

    await page.goto('/');
    await ready(page);

    expect(errors).toEqual([]);
  });

  test('compiles both shaders', async ({ page }) => {
    const errors = watchForErrors(page);

    await page.goto('/');
    await ready(page);

    // Three.js reports a failed compile as a console error naming the stage.
    const shaderErrors = errors.filter((text) => /shader|GLSL|reserved word/i.test(text));
    expect(shaderErrors).toEqual([]);
  });

  test('links the field shader program on the GPU', async ({ page }) => {
    await page.goto('/');
    await ready(page);

    // Asserted against the driver rather than via renderer.info: Three still
    // counts the draw call when a program fails to link, so triangle counts
    // stay non-zero and would let a broken shader through.
    const status = await page.evaluate(async () => {
      const { renderer, grid } = window.__portfolio;
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

      const material = grid.scene.children[0].material;
      const program = renderer.properties.get(material)?.currentProgram?.program;
      if (!program) return { found: false };

      const gl = renderer.getContext();
      return { found: true, linked: gl.getProgramParameter(program, gl.LINK_STATUS) };
    });

    expect(status.found).toBe(true);
    expect(status.linked).toBe(true);
  });

  test('draws geometry every frame', async ({ page }) => {
    await page.goto('/');
    await ready(page);

    const triangles = await page.evaluate(async () => {
      const { renderer } = window.__portfolio;
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      return renderer.info.render.triangles;
    });

    expect(triangles).toBeGreaterThan(0);
  });

  test('shares a single WebGL context between both scenes', async ({ page }) => {
    await page.goto('/');
    await ready(page);

    await expect(page.locator('canvas')).toHaveCount(1);
  });

  test('builds a non-empty particle field', async ({ page }) => {
    await page.goto('/');
    await ready(page);

    const count = await page.evaluate(
      () => window.__portfolio.grid.scene.children[0].geometry.instanceCount
    );

    expect(count).toBeGreaterThan(0);
  });

  test('keeps drawing through a full scroll and a theme switch', async ({ page }) => {
    // The scene's textures are generated onto a canvas and its materials are
    // built at construction, so a bad map, a bad wrap mode or a material
    // property Three rejects only shows up in a real GL context. Scrolling and
    // toggling drives the paths that swap the body, recolour every material and
    // rescale the aura against a live camera distance.
    const errors = watchForErrors(page);

    await page.goto('/');
    await ready(page);

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(200);
    await page.locator('#theme-toggle').click();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(200);

    const triangles = await page.evaluate(async () => {
      const { renderer } = window.__portfolio;
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      return renderer.info.render.triangles;
    });

    expect(triangles).toBeGreaterThan(0);
    expect(errors).toEqual([]);
  });

  test('gives the aura a finite scale at both scroll extremes', async ({ page }) => {
    // A NaN here would not throw -- Three would just stop drawing the sprite,
    // which is exactly the "aura disappeared" symptom this is guarding.
    await page.goto('/');
    await ready(page);

    const scaleAt = (offset) =>
      page.evaluate(async (y) => {
        window.scrollTo(0, y);
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

        // Traversed rather than looked up by group: the torus is a Group too,
        // and it is added to the scene first.
        let glow = null;
        window.__portfolio.space.scene.traverse((child) => {
          if (!glow && child.isSprite && child.visible) glow = child;
        });

        return glow ? { scale: glow.scale.x, opacity: glow.material.opacity } : null;
      }, offset);

    const near = await scaleAt(0);
    const far = await scaleAt(await page.evaluate(() => document.body.scrollHeight));

    for (const state of [near, far]) {
      expect(state).not.toBeNull();
      expect(Number.isFinite(state.scale)).toBe(true);
      expect(state.scale).toBeGreaterThan(0);
      expect(state.opacity).toBeGreaterThan(0);
    }
  });

  test('rebuilds the field for a new viewport without erroring', async ({ page }) => {
    const errors = watchForErrors(page);

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await ready(page);

    const wide = await page.evaluate(
      () => window.__portfolio.grid.scene.children[0].geometry.instanceCount
    );

    await page.setViewportSize({ width: 600, height: 900 });
    await page.waitForTimeout(200);

    const narrow = await page.evaluate(
      () => window.__portfolio.grid.scene.children[0].geometry.instanceCount
    );

    expect(narrow).toBeGreaterThan(0);
    expect(narrow).toBeLessThan(wide); // a narrower viewport needs fewer dots
    expect(errors).toEqual([]);
  });
});

test.describe('theme', () => {
  test('resolves before first paint, so the page never flashes', async ({ page }) => {
    // Asserted on the very first evaluated script, ahead of the module bundle.
    await page.addInitScript(() => {
      window.__themeAtParse = null;
      document.addEventListener('DOMContentLoaded', () => {
        window.__themeAtParse = document.documentElement.dataset.theme;
      });
    });

    await page.goto('/');
    const atParse = await page.evaluate(() => window.__themeAtParse);

    expect(['dark', 'light']).toContain(atParse);
  });

  test('follows the OS preference when nothing is stored', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  });

  test('toggles, repaints and persists across a reload', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/');
    await ready(page);

    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    await page.locator('#theme-toggle').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  });

  test('recolours the page background', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/');
    await ready(page);

    const background = () =>
      page.evaluate(() => getComputedStyle(document.body).backgroundColor);

    const dark = await background();
    expect(dark).toBe('rgb(2, 2, 5)');

    await page.locator('#theme-toggle').click();

    // body carries a 0.4s background transition, so the computed value has to
    // be polled rather than read once -- a single read catches it mid-fade.
    await expect.poll(background, { timeout: 3000 }).toBe('rgb(250, 250, 250)');
  });

  test('keeps the toggle labelled for screen readers', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/');
    await ready(page);

    const toggle = page.locator('#theme-toggle');
    await expect(toggle).toHaveAttribute('aria-label', 'Switch to light theme');
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-label', 'Switch to dark theme');
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  });
});

test.describe('content', () => {
  test('renders the sections that carry the actual portfolio', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('h1')).toHaveText('Harshit Singhal');
    await expect(page.locator('.magic-text')).toBeVisible();
    await expect(page.locator('#projects .project-card')).toHaveCount(6);
    await expect(page.locator('#experience .experience-card').first()).toBeVisible();
  });
});
