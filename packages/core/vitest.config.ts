import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: '@next-buildr/core',
    passWithNoTests: true,
    // The property tests run many command sequences; a busy CI runner needs more than the 5 s default.
    testTimeout: 30_000,
  },
});
