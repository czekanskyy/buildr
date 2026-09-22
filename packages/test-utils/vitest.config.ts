import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: '@buildr/test-utils',
    passWithNoTests: true,
  },
});
