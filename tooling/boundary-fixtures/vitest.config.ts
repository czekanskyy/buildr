import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'boundary-fixtures',
    include: ['*.test.ts'],
    // Each test runs dependency-cruiser over a fixture tree; on a busy CI runner that takes a while.
    testTimeout: 60_000,
  },
});
