import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  // Screenshots have their own config (playwright.visual.config.ts) and run in the Docker image only.
  testIgnore: 'visual/**',
  webServer: {
    command: 'pnpm exec vite --port 5173 --strictPort',
    url: 'http://localhost:5173/gallery',
    reuseExistingServer: true,
  },
  use: { baseURL: 'http://localhost:5173' },
});
