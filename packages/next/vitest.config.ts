import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: '@next-buildr/next',
    passWithNoTests: true,
  },
});
