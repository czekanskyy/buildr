import { defineConfig } from 'vitest/config';

// The Playwright suite in e2e/ runs with `pnpm e2e`, not here.
export default defineConfig({ test: { include: ['src/**/*.test.ts'] } });
