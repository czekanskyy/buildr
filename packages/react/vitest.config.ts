import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: '@next-buildr/react',
    passWithNoTests: true,
    exclude: [...configDefaults.exclude, '**/dist/**'],
  },
});
