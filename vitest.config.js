import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.js'],
    // jsdom everywhere. The pure-maths suites don't need it, but Node 25 ships
    // its own partial `localStorage` global that shadows the real one under the
    // node environment, so per-file opt-in via docblock is not reliable here.
    // The whole suite runs in well under a second either way.
    environment: 'jsdom',
    setupFiles: ['tests/setup.js'],
    restoreMocks: true,
    clearMocks: true,
  },
});
