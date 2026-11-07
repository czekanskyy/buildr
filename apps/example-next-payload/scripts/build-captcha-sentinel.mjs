import { spawnSync } from 'node:child_process';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const marker = new URL('../.next/captcha-sentinel.json', import.meta.url);
const secret = 'buildr-captcha-client-leak-test-secret';
await rm(marker, { force: true });
const build = spawnSync(
  process.execPath,
  [createRequire(import.meta.url).resolve('next/dist/bin/next'), 'build'],
  {
    cwd: root,
    stdio: 'inherit',
    env: {
      ...process.env,
      TURNSTILE_SITE_KEY: '1x00000000000000000000AA',
      TURNSTILE_SECRET_KEY: secret,
      CAPTCHA_HOSTNAMES: 'localhost',
      CLIENT_IP_HEADER: 'x-real-ip',
    },
  },
);
if (build.error) throw build.error;
if (build.status !== 0) process.exit(build.status ?? 1);
const buildId = (await readFile(new URL('../.next/BUILD_ID', import.meta.url), 'utf8')).trim();
await writeFile(marker, JSON.stringify({ buildId, secret }));
if (!process.argv.includes('--build-only')) await import('./check-captcha-secret.mjs');
