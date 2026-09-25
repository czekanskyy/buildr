// Prepares a fresh database, seeds it and serves the production build. Used by playwright.config.ts.
import { spawn, spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';

const port = process.env.E2E_PORT ?? '3100';
const dbFile = 'e2e.db';
const env = {
  ...process.env,
  SQLITE_URL: `file:./${dbFile}`,
  PAYLOAD_SECRET: 'e2e-secret',
  SEED_ADMIN_EMAIL: 'e2e@buildr.test',
  SEED_ADMIN_PASSWORD: 'e2e-password-1',
  NEXT_PUBLIC_SITE_URL: `http://localhost:${port}`,
  // The MCP suite (e2e/mcp) runs only with BUILDR_MCP=1: the agent user and its API key are seeded then.
  ...(process.env.BUILDR_MCP === '1'
    ? {
        SEED_AGENT_EMAIL: 'agent@buildr.test',
        SEED_AGENT_API_KEY: 'e2e-agent-key-0123456789',
        // The scripted agent writes a lot in a minute (and the suite may be repeated): no throttling here.
        BUILDR_MCP_RATE_LIMIT: '100000',
      }
    : {}),
};
const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const run = (args) => {
  const result = spawnSync(pnpm, args, {
    env,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
};

for (const suffix of ['', '-shm', '-wal', '-journal'])
  rmSync(`${dbFile}${suffix}`, { force: true });
run(['seed']);
run(['build']);
const server = spawn(pnpm, ['exec', 'next', 'start', '-p', port], {
  env,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
server.on('exit', (code) => process.exit(code ?? 0));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.kill());
