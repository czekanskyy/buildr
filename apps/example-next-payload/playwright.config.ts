import { defineConfig } from '@playwright/test';

const port = process.env.E2E_PORT ?? '3100';

export default defineConfig({
  testDir: 'e2e',
  // The scripted MCP client suite needs the app started with agents enabled (docs/mcp.md); without
  // BUILDR_MCP=1 it is skipped and the default suite runs exactly as before.
  testIgnore: process.env.BUILDR_MCP === '1' ? [] : ['mcp/**'],
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: `http://localhost:${port}`, trace: 'retain-on-failure' },
  webServer: {
    command: 'node e2e/serve.mjs',
    url: `http://localhost:${port}/pl`,
    timeout: 600_000,
    reuseExistingServer: !process.env.CI,
  },
});
