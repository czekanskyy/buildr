import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  webServer: {
    command: 'pnpm exec vite --port 5173 --strictPort',
    url: 'http://localhost:5173/gallery',
    reuseExistingServer: true,
  },
  use: { baseURL: 'http://localhost:5173' },
});
