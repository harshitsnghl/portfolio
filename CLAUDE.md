# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev            # Vite dev server
npm run build          # production build
npm run preview        # serve the built output

npm test               # unit + dom, then e2e
npm run test:unit      # vitest run  (tests/**/*.test.js)
npm run test:watch     # vitest in watch mode
npm run test:e2e       # playwright (starts its own dev server on :4173)
```

Single tests:

```bash
npx vitest run tests/unit/textures.test.js        # one file
npx vitest run -t "peaks the rim"                 # one case by name
npx playwright test -g "recolours the page background"
npx playwright test e2e/smoke.spec.js:216         # by line
npx playwright test -g "<name>" --repeat-each=6   # flake hunting
```

There is no linter or formatter configured. Match the style of the file you are editing.

`npm install` runs `prepare`, which points `core.hooksPath` at `.githooks/`. The pre-push hook
runs build + unit + e2e and blocks the push on failure. Bypass with `git push --no-verify`.

## Architecture

### One renderer, two scenes

`src/main.js` owns the only `WebGLRenderer`, the only animation loop, and every DOM event
listener. Neither scene module creates either — `createParticleGrid()` and `createSpaceScene()`
each return a handle (`scene`, `camera`, `update`, `resize`, `setTheme`, `dispose`, plus their own
extras: `uniforms`/`config` on the grid, `setPointer`/`applyScroll` on the space scene) and leave
the driving to `main.js`.

`renderer.autoClear = false`. Each frame clears once, draws the particle field, calls
`clearDepth()`, then draws the space scene on top. Anything that adds a third pass has to keep
that ordering or the field will paint over the foreground.

The loop parks when the tab is hidden and when `prefers-reduced-motion` is set; in both cases a
single composed frame is drawn instead of leaving a blank canvas. `refreshIfIdle()` exists so a
theme or resize change still repaints while parked — call it after anything that changes what a
frame would look like.

### Theming crosses three places

A theme change has to reach CSS and GL, and it has to be resolved before first paint or the page
flashes. So it lives in three files that must be kept in step:

1. **`index.html`** — inline script sets `data-theme` on `<html>` before anything loads.
   `theme-store.js` adopts whatever it decided rather than re-deciding.
2. **`src/style.css`** — `:root[data-theme='dark'|'light']` blocks, for everything CSS can express.
3. **`src/theme/palettes.js`** — everything CSS *cannot* express: Three.js material colours,
   light intensities, shader uniforms.

`palettes.js` is the single source for GL colour. `tests/unit/palettes.test.js` asserts the two
themes have **identical key sets**, so adding a key to one theme and not the other fails loudly.
That test is the guard against drift — don't work around it.

### Pure maths is extracted so it can be tested without GL

The strong convention here: anything that is arithmetic gets pulled into its own module with no
Three.js dependency, and is unit-tested directly.

- `src/particles/grid-layout.js`, `src/particles/cursor.js` — field layout and pointer response
- `src/scene/aura.js` — distance response for the glow sprite
- `src/scene/textures.js` — `ribProfile`, `glowStops`, `generateCraters`, `createTilingNoise`
  are pure and tested; the `create*Textures` functions around them touch canvas and are not

When adding scene behaviour, put the maths in a helper and the GL wiring in the scene module.
Behaviour that genuinely needs a GL context belongs in `e2e/`, not in a mocked unit test.

### What e2e is actually for

`e2e/smoke.spec.js` exists primarily because **GLSL compiles at runtime**. A reserved word in a
shader (`active`, `input`, `output`, `filter` …) is valid JavaScript, builds cleanly, and renders
a blank background. Nothing but a real GL context catches it. That is why the suite asserts
shader program linking and non-zero draw counts, not just that the page loads.

Playwright runs headless Chromium with `--enable-unsafe-swiftshader --use-angle=swiftshader`;
without them there is no GL context and every test fails for the wrong reason.

`window.__portfolio = { grid, space, loop, renderer }` is set only under `import.meta.env.DEV`.
It is both the live-tuning console handle and the e2e readiness signal
(`page.waitForFunction(() => window.__portfolio !== undefined)`).

### Textures are procedural and run before first paint

Everything in `src/scene/textures.js` draws into a canvas at startup, synchronously, on the path
to first paint. This is a real budget: a texture generator at 1024×256 with a `Math.hypot` per
candidate per texel pushed first paint far enough out that a CSS-transition assertion in the e2e
suite started catching the page mid-fade. Keep per-texel work cheap, and prefer squared distances
with a single `sqrt` at the end.

If an e2e test starts failing intermittently on a colour or timing assertion after a texture
change, suspect first-paint cost before suspecting the test.

## Three.js gotchas already hit in this codebase

- **Layers do not confine lights.** `light.layers.set(1)` does *not* restrict a light to layer-1
  objects. `WebGLRenderer.projectObject` collects a light whenever
  `light.layers.test(camera.layers)` passes, and the camera has layer 1 enabled. There is no
  per-object light masking — anything one object needs and the rest must not get has to come from
  its **material** (e.g. the moon's even full-moon brightness comes from an `emissiveMap`).
- **`LineBasicMaterial.linewidth` is capped at 1px** on every major platform and ignored above
  that, silently. Edge weight has to come from colour contrast and opacity.
- **`roughnessMap` multiplies `material.roughness`**, so set `roughness: 1` to hand the full range
  to the texture rather than flattening it back out.
- **A `map` multiplies `material.color`.** Since `setTheme` drives hue through `.color`, any
  texture used as a `map` must stay near-white or it will fight the theme.
- **Additive blending is a no-op over a near-white background.** The light-mode page is
  `rgb(250, 250, 250)`, so the sun's glow sprite uses `NormalBlending` while the moon's uses
  `AdditiveBlending` over the near-black sky.
- `dispose()` in `space-scene.js` enumerates every geometry, material and texture. Adding a
  resource means adding it there.

## Test environment note

`tests/setup.js` installs its own spec-shaped `MemoryStorage` as `localStorage`. Node 25 ships a
partial Web Storage global that wins over jsdom's and arrives inert (no `clear`, no `Storage`
prototype). That is also why `vitest.config.js` sets `environment: 'jsdom'` for the whole suite
rather than opting in per file — per-file environment selection is not reliable against that
global.
