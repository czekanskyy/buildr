import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { name: '@next-buildr/playground', include: ['src/**/*.test.ts'] },
});
