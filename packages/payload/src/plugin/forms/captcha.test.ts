import type { BuilderDocument } from '@next-buildr/core';
import { describe, expect, it, vi } from 'vitest';
import {
  ancestorFormHasCaptcha,
  CAPTCHA_ACTION,
  CAPTCHA_FIELD,
  CAPTCHA_TYPE,
  captchaCData,
  createCaptchaGate,
  createTurnstileVerifier,
  findFormCaptchas,
} from './captcha.ts';
import { createMemoryRateLimiter } from './rate-limit.ts';

// Pin these exact UTF-8 JSON tuple vectors in the components package too.
const SIMPLE = '39d82018d38dd1145f9903261b443a1556acf5f672cc5a15e8fa61999b15d6bd';
const UNICODE = 'ea58a41440286e8b7194961ae8b63704e6ceca9e305a190cf7637bc8d6dc4cc5';
const SECRET = 'private-turnstile-secret';
const TOKEN = 'opaque-token';
const success = { success: true, hostname: 'example.com', action: CAPTCHA_ACTION, cdata: SIMPLE };
const signal = () => new AbortController().signal;
const run = (fetcher: typeof fetch, input = TOKEN, log = vi.fn()) =>
  createTurnstileVerifier({ secretKey: SECRET, fetch: fetcher, log }).verify({
    token: input,
    signal: signal(),
  });

describe('captcha contract', () => {
  it('pins constants and simple and Unicode golden vectors', () => {
    expect([CAPTCHA_FIELD, CAPTCHA_ACTION, CAPTCHA_TYPE]).toEqual([
      'buildr-captcha',
      'buildr_form',
      'buildr/captcha',
    ]);
    expect(captchaCData('pages:1', 'form000001')).toBe(SIMPLE);
    expect(
      captchaCData('pages:za\u017c\u00f3\u0142\u0107-\u6771\u4eac', 'formularz-\u{1f6e1}\ufe0f'),
    ).toBe(UNICODE);
  });
  it('gates per instance and releases idempotently', () => {
    const gate = createCaptchaGate(1);
    const release = gate.tryAcquire();
    expect(release).not.toBeNull();
    expect(gate.tryAcquire()).toBeNull();
    expect(createCaptchaGate(1).tryAcquire()).not.toBeNull();
    release?.();
    release?.();
    expect(gate.tryAcquire()).not.toBeNull();
    expect(gate.tryAcquire()).toBeNull();
  });
});

describe('Turnstile verifier', () => {
  it('uses the exact fixed, uncached, non-redirecting POST with only secret and response', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json(success));
    const abort = signal();
    const result = await createTurnstileVerifier({ secretKey: SECRET, fetch: fetcher }).verify({
      token: TOKEN,
      signal: abort,
    });
    expect(result).toEqual({
      ok: true,
      hostname: 'example.com',
      action: CAPTCHA_ACTION,
      cdata: SIMPLE,
    });
    expect(fetcher).toHaveBeenCalledOnce();
    const [url, init] = fetcher.mock.calls[0] ?? [];
    expect(url).toBe('https://challenges.cloudflare.com/turnstile/v0/siteverify');
    expect(init).toEqual({
      method: 'POST',
      body: new URLSearchParams({ secret: SECRET, response: TOKEN }),
      redirect: 'error',
      cache: 'no-store',
      signal: abort,
    });
    const body = init?.body;
    expect(body).toBeInstanceOf(URLSearchParams);
    expect(body instanceof URLSearchParams ? [...body.entries()] : []).toEqual([
      ['secret', SECRET],
      ['response', TOKEN],
    ]);
  });
  it.each(['', 'a b', 'non-ASCII-\u00e9', 'valid\n', 'a'.repeat(2049), ['one', 'two'], 123, null])(
    'makes no outbound call for malformed token %j',
    async (token) => {
      const fetcher = vi.fn<typeof fetch>();
      expect(await run(fetcher, token as string)).toEqual({ ok: false, reason: 'invalid' });
      expect(fetcher).not.toHaveBeenCalled();
    },
  );
  it.each([
    ['missing-input-secret', 'unavailable', 'configuration'],
    ['invalid-input-secret', 'unavailable', 'configuration'],
    ['timeout-or-duplicate', 'expired-or-reused', 'expired-or-reused'],
    ['internal-error', 'unavailable', 'unavailable'],
    ['invalid-input-response', 'invalid', 'invalid'],
    ['unknown-code', 'invalid', 'invalid'],
  ])('maps Cloudflare %s safely', async (code, reason, loggedReason) => {
    const log = vi.fn();
    expect(
      await run(
        vi
          .fn<typeof fetch>()
          .mockResolvedValue(Response.json({ success: false, 'error-codes': [code] })),
        TOKEN,
        log,
      ),
    ).toEqual({ ok: false, reason });
    expect(log).toHaveBeenCalledWith({ reason: loggedReason, codes: [code] });
    expect(JSON.stringify(log.mock.calls)).not.toContain(SECRET);
    expect(JSON.stringify(log.mock.calls)).not.toContain(TOKEN);
  });
  it('filters and caps logged codes and gives configuration errors precedence', async () => {
    const log = vi.fn();
    const codes = [
      TOKEN,
      SECRET,
      '<script>',
      'a'.repeat(65),
      'UPPER',
      'bad-code\n',
      'timeout-or-duplicate',
      'invalid-input-secret',
      ...Array.from({ length: 20 }, () => 'bad-request'),
    ];
    const response = { success: false, 'error-codes': codes, token: TOKEN, secret: SECRET };
    expect(
      await run(vi.fn<typeof fetch>().mockResolvedValue(Response.json(response)), TOKEN, log),
    ).toEqual({ ok: false, reason: 'unavailable' });
    expect(log.mock.calls[0]?.[0].codes).toHaveLength(10);
    expect(log.mock.calls[0]?.[0].codes).toEqual([
      'timeout-or-duplicate',
      'invalid-input-secret',
      ...Array.from({ length: 8 }, () => 'bad-request'),
    ]);
    expect(JSON.stringify(log.mock.calls)).not.toContain(SECRET);
    expect(JSON.stringify(log.mock.calls)).not.toContain(TOKEN);
  });
  it.each([302, 400, 500])('fails closed for HTTP %s', async (status) => {
    expect(
      await run(vi.fn<typeof fetch>().mockResolvedValue(new Response('', { status }))),
    ).toEqual({ ok: false, reason: 'unavailable' });
  });
  it.each([
    new TypeError('redirect'),
    new DOMException('abort', 'AbortError'),
    new DOMException('timeout', 'TimeoutError'),
    new Error(SECRET),
  ])('does not log thrown transport errors', async (error) => {
    const log = vi.fn();
    expect(await run(vi.fn<typeof fetch>().mockRejectedValue(error), TOKEN, log)).toEqual({
      ok: false,
      reason: 'unavailable',
    });
    expect(log).not.toHaveBeenCalled();
  });
  it.each([
    '{',
    '{}',
    'null',
    JSON.stringify({ success: 'true' }),
    JSON.stringify({ success: true, hostname: 1 }),
    JSON.stringify({ success: true, hostname: 'example.com' }),
    JSON.stringify({ success: false, 'error-codes': [1] }),
  ])('rejects malformed response %s', async (body) => {
    expect(await run(vi.fn<typeof fetch>().mockResolvedValue(new Response(body)))).toEqual({
      ok: false,
      reason: 'unavailable',
    });
  });
  it('defaults missing cdata to empty for the endpoint to reject', async () => {
    expect(
      await run(
        vi.fn<typeof fetch>().mockResolvedValue(Response.json({ ...success, cdata: undefined })),
      ),
    ).toMatchObject({ ok: true, cdata: '' });
  });
  it('accepts a chunked response at the byte limit and rejects a cumulative overflow', async () => {
    const bytes = new TextEncoder().encode(JSON.stringify(success));
    for (const extra of [0, 1]) {
      const cancel = vi.fn();
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(bytes.subarray(0, 10));
          controller.enqueue(bytes.subarray(10));
          controller.enqueue(
            new TextEncoder().encode(' '.repeat(16 * 1024 - bytes.byteLength + extra)),
          );
          if (extra === 0) controller.close();
        },
        cancel,
      });
      expect(await run(vi.fn<typeof fetch>().mockResolvedValue(new Response(body)))).toMatchObject(
        extra === 0 ? { ok: true } : { ok: false, reason: 'unavailable' },
      );
      expect(cancel).toHaveBeenCalledTimes(extra);
    }
  });
  it('cancels an oversized streaming body without waiting for cancellation', async () => {
    const cancel = vi.fn(() => new Promise<void>(() => {}));
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(16 * 1024 + 1));
      },
      cancel,
    });
    expect(await run(vi.fn<typeof fetch>().mockResolvedValue(new Response(body)))).toEqual({
      ok: false,
      reason: 'unavailable',
    });
    expect(cancel).toHaveBeenCalledOnce();
  });
  it('aborts a stalled body reader and a never-settling fetch', async () => {
    for (const stallBody of [true, false]) {
      const controller = new AbortController();
      const cancel = vi.fn();
      const fetcher = vi
        .fn<typeof fetch>()
        .mockImplementation(() =>
          stallBody
            ? Promise.resolve(new Response(new ReadableStream({ cancel })))
            : new Promise(() => {}),
        );
      const pending = createTurnstileVerifier({ secretKey: SECRET, fetch: fetcher }).verify({
        token: TOKEN,
        signal: controller.signal,
      });
      await vi.waitFor(() => expect(fetcher).toHaveBeenCalledOnce());
      controller.abort();
      expect(await pending).toEqual({ ok: false, reason: 'unavailable' });
      if (stallBody) expect(cancel).toHaveBeenCalledOnce();
    }
  });
  it('does not fetch with an already aborted signal', async () => {
    const fetcher = vi.fn<typeof fetch>();
    const controller = new AbortController();
    controller.abort();
    expect(
      await createTurnstileVerifier({ secretKey: SECRET, fetch: fetcher }).verify({
        token: TOKEN,
        signal: controller.signal,
      }),
    ).toEqual({ ok: false, reason: 'unavailable' });
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe('literal nearest-form detection', () => {
  const graph = (): BuilderDocument =>
    ({
      schemaVersion: 1,
      root: 'root',
      components: {},
      nodes: {
        root: { id: 'root', type: 'buildr/page', slots: { default: ['outer'] } },
        outer: {
          id: 'outer',
          type: 'buildr/form',
          slots: { default: ['wrapper', 'inner', 'dangling', 'toString'] },
        },
        wrapper: {
          id: 'wrapper',
          type: 'unregistered',
          slots: { anything: ['cap', 'cap', 'outer'] },
        },
        cap: {
          id: 'cap',
          type: CAPTCHA_TYPE,
          styles: { base: { visibility: { hidden: true } } },
          visibleIf: { kind: 'static', value: false },
        },
        inner: { id: 'inner', type: 'buildr/form', slots: { default: ['inside'] } },
        inside: { id: 'inside', type: CAPTCHA_TYPE },
      },
    }) as unknown as BuilderDocument;
  it('tolerates cycles, duplicate/dangling/prototype references, ignores conditions, and skips nested forms', () => {
    expect(findFormCaptchas(graph(), 'outer').map((node) => node.id)).toEqual(['cap']);
    expect(findFormCaptchas(graph(), 'inner').map((node) => node.id)).toEqual(['inside']);
    expect(findFormCaptchas(graph(), 'missing')).toEqual([]);
    expect(findFormCaptchas(graph(), 'toString')).toEqual([]);
  });
  it('detects any protected form ancestor even across corrupt reverse edges', () => {
    expect(ancestorFormHasCaptcha(graph(), 'inner')).toBe(true);
    expect(ancestorFormHasCaptcha(graph(), 'outer')).toBe(false);
    expect(ancestorFormHasCaptcha(graph(), 'missing')).toBe(false);
  });
});

it('retains live captcha counters at capacity and admits new keys only after expiry', async () => {
  let now = 0;
  const limiter = createMemoryRateLimiter({
    limit: 1,
    windowMs: 1000,
    now: () => now,
    failClosed: true,
  });
  for (let i = 0; i < 10000; i++) expect(await limiter.hit(String(i))).toEqual({ allowed: true });
  expect(await limiter.hit('new')).toEqual({ allowed: false, retryAfterSeconds: 1 });
  expect(await limiter.hit('0')).toEqual({ allowed: false, retryAfterSeconds: 1 });
  now = 1000;
  expect(await limiter.hit('new')).toEqual({ allowed: true });
});
