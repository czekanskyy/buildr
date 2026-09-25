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
