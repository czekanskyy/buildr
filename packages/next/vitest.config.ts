import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: '@buildr/next',
    passWithNoTests: true,
  },
});
