import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'repo-smoke',
    include: ['**/*.test.ts'],
  },
});
