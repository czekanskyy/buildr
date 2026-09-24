import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { name: '@buildr/playground', include: ['src/**/*.test.ts'] },
});
