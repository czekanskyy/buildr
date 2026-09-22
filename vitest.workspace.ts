import { defineConfig } from 'vitest/config';

// Uses `test.projects` (not `defineWorkspace`, removed in Vitest 4) for `vitest --config vitest.workspace.ts` local runs; CI/`pnpm test` go through Turborepo per package instead.
export default defineConfig({
  test: {
    projects: ['packages/*', 'tooling/smoke'],
  },
});
