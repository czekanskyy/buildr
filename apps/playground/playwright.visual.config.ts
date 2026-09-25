import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e/visual',
  snapshotPathTemplate: '{testDir}/__screenshots__/{arg}{ext}',
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.002 } },
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  webServer: {
    command: 'pnpm exec vite --port 5173 --strictPort',
    url: 'http://localhost:5173/gallery',
    reuseExistingServer: !process.env.CI,
  },
  use: { baseURL: 'http://localhost:5173' },
});
