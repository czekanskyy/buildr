import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'repo-smoke',
    include: ['**/*.test.ts'],
    // A cold import of a package transforms its whole source tree, which takes longer on a busy CI runner.
    testTimeout: 30_000,
  },
});
