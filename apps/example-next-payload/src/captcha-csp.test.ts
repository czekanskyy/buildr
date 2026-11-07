import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@payloadcms/next/withPayload', () => ({ withPayload: (config: unknown) => config }));
afterEach(() => vi.unstubAllEnvs());

describe('public captcha frame CSP', () => {
  it.each([
    ['', false],
    ['invalid key', false],
    ['a'.repeat(129), false],
    ['1x00000000000000000000AA', true],
  ])('validates site key %s', async (key, enabled) => {
    vi.resetModules();
    vi.stubEnv('TURNSTILE_SITE_KEY', key);
    vi.stubEnv('GOOGLE_MAPS_EMBED_API_KEY', '');
    const { default: config } = await import('../next.config.ts');
    const rules = await config.headers?.();
    const publicRule = rules?.find((rule) => rule.source === '/((?!buildr/canvas|buildr/edit).*)');
    expect(publicRule?.headers[0]?.value).toBe(
      enabled
        ? "frame-ancestors 'self'; frame-src https://challenges.cloudflare.com"
        : "frame-ancestors 'self'",
    );
  });
});
