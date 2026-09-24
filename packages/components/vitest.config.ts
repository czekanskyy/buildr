import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: '@buildr/components',
    passWithNoTests: true,
    // `tsc -b` emits the tests too; only the sources are run.
    exclude: [...configDefaults.exclude, '**/dist/**'],
  },
});
