import { createHash } from 'node:crypto';
import {
  type BuilderDocument,
  type ComponentMeta,
  createRegistryMeta,
  p,
  s,
} from '@next-buildr/core';
import type { Config, PayloadRequest } from 'payload';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CAPTCHA_ACTION,
  CAPTCHA_FIELD,
  CAPTCHA_TYPE,
  type CaptchaVerification,
  captchaCData,
  createCaptchaGate,
} from '../forms/captcha.ts';
import { createMemoryRateLimiter } from '../forms/rate-limit.ts';
import { buildrPlugin } from '../index.ts';
import { resolveOptions } from '../options.ts';
import type { EndpointEnv } from './context.ts';
import { meta as baseMeta, boot, type Harness } from './endpoints.test-kit.ts';
import { formsEndpoint } from './forms.ts';

const FORM = 'form000001';
const FIELD = 'field00001';
const CAP = 'captcha001';
const SECRET = 'private-captcha-secret';
const TOKEN = 'private-visitor-token';
const component = (type: string, props: ComponentMeta['props'] = {}): ComponentMeta => ({
  type,
  version: 1,
  label: type,
  category: 'forms',
  props,
  contentCategories: ['flow'],
  styles: { groups: [] },
  runtime: 'shared',
});
const meta = createRegistryMeta({
  components: [
    ...baseMeta.list(),
    { ...component('buildr/form'), slots: { default: {} } },
    component(CAPTCHA_TYPE),
    {
      ...component('test/field', { name: p.text({ label: 'Name', default: '' }) }),
      formField: { valueType: 'string', nameProp: 'name' },
    },
  ],
});
const layout = (captcha = true, name = 'message'): BuilderDocument => ({
  schemaVersion: 1,
  root: 'root',
  components: {
    'buildr/page': 1,
    'buildr/form': 1,
    'test/field': 1,
    ...(captcha ? { [CAPTCHA_TYPE]: 1 } : {}),
  },
  nodes: {
    root: { id: 'root', type: 'buildr/page', slots: { default: [FORM] } },
    [FORM]: {
      id: FORM,
      type: 'buildr/form',
      slots: { default: [FIELD, ...(captcha ? [CAP] : [])] },
    },
    [FIELD]: { id: FIELD, type: 'test/field', props: { name: s(name) } },
    ...(captcha ? { [CAP]: { id: CAP, type: CAPTCHA_TYPE } } : {}),
  },
});
let h: Harness;
let env: EndpointEnv;
let counter = 0;
const siteverifyFetch = vi.fn<typeof fetch>();
const verify =
  vi.fn<(input: { token: string; signal: AbortSignal }) => Promise<CaptchaVerification>>();
const allowed = { allowed: true, retryAfterSeconds: 0 } as const;
const hit = vi.fn(
  async (_key: string) => allowed as { allowed: boolean; retryAfterSeconds: number },
);
const publish = async (doc: BuilderDocument | undefined = layout(), extra: object = {}) =>
  h.payload.create({
    collection: 'pages',
    data: {
      title: 'Captcha',
      slug: `captcha-${++counter}`,
      layout: doc,
      _status: 'published',
      ...extra,
    } as never,
  });
const bind = (ref: string, form = FORM, hostname = 'example.com') =>
  verify.mockResolvedValue({
    ok: true,
    hostname,
    action: CAPTCHA_ACTION,
    cdata: captchaCData(ref, form),
  });
const submit = async (
  id: string | number,
  values: Record<string, unknown> = { message: 'hello', [CAPTCHA_FIELD]: TOKEN },
  options: {
    collection?: string;
    node?: string;
    html?: boolean;
    repeated?: boolean;
    plugin?: boolean | 'fresh';
    hostLimiter?: boolean;
  } = {},
) => {
  const request = new Request(
    `http://localhost/api/buildr/forms/${options.collection ?? 'pages'}/${id}/${options.node ?? FORM}`,
    {
      method: 'POST',
      headers: {
        'content-type': options.html ? 'application/x-www-form-urlencoded' : 'application/json',
        'trusted-ip': '192.0.2.1',
        referer: 'http://localhost/contact?x=1',
      },
      body: options.html
        ? new URLSearchParams(Object.entries(values).map(([key, value]) => [key, String(value)]))
        : JSON.stringify(values),
    },
  );
  if (options.repeated) {
    const form = new FormData();
    form.append('message', 'hello');
    form.append(CAPTCHA_FIELD, TOKEN);
    form.append(CAPTCHA_FIELD, TOKEN);
    Object.defineProperty(request, 'formData', { value: async () => form });
  }
  const req = Object.assign(request, {
    payload: h.payload,
    routeParams: {
      collection: options.collection ?? 'pages',
      id: String(id),
      nodeId: options.node ?? FORM,
    },
    searchParams: new URLSearchParams(),
  }) as unknown as PayloadRequest;
  const fresh =
    options.plugin === 'fresh'
      ? await buildrPlugin({
          registry: { meta },
          collections: { pages: { context: 'page' } },
          forms: {
            enabled: true,
            clientIp: { header: 'trusted-ip' },
            rateLimiter: options.hostLimiter ? { hit } : undefined,
            rateLimit: { limit: 1, windowMs: 60000 },
            captcha: { secretKey: SECRET, hostnames: ['example.com'] },
          },
        })({
          collections: [{ slug: 'pages', fields: [], versions: { drafts: true } }],
        } as unknown as Config)
      : undefined;
  const endpoint = fresh
    ? fresh.endpoints?.find((entry) => entry.path === '/buildr/forms/:collection/:id/:nodeId')
    : options.plugin
      ? h.payload.config.endpoints.find(
          (entry) => entry.path === '/buildr/forms/:collection/:id/:nodeId',
        )
      : formsEndpoint(env);
  if (endpoint === undefined) throw new Error('Missing forms endpoint');
  const response = await endpoint.handler(req);
  const text = await response.text();
  expect(text).not.toContain(SECRET);
  expect(JSON.stringify([...response.headers])).not.toContain(SECRET);
  return { response, status: response.status, body: text ? JSON.parse(text) : undefined };
};
const count = async () =>
  (await h.payload.find({ collection: 'buildr-form-submissions', pagination: false })).docs;

beforeAll(async () => {
  vi.stubGlobal('fetch', siteverifyFetch);
  h = await boot('forms-captcha', {
    registry: { meta },
    collections: { pages: { context: 'page', templates: true } },
    forms: {
      enabled: true,
      clientIp: { header: 'trusted-ip' },
      captcha: { secretKey: SECRET, hostnames: ['example.com'], maxInFlight: 1 },
      rateLimit: { limit: 100, windowMs: 60_000 },
    },
  });
});
afterAll(() => {
  h.close();
  vi.unstubAllGlobals();
});
beforeEach(() => {
  vi.restoreAllMocks();
  verify.mockReset();
  siteverifyFetch.mockReset();
  hit.mockReset().mockResolvedValue(allowed);
  env = {
    options: resolveOptions({
      registry: { meta },
      collections: { pages: { context: 'page', templates: true } },
      forms: {
        enabled: true,
        clientIp: { header: 'trusted-ip' },
        captcha: { secretKey: SECRET, hostnames: ['example.com'], maxInFlight: 1 },
      },
    }),
    captcha: {
      verifier: { verify },
      gate: createCaptchaGate(1),
      rateLimiter: { hit },
      hostnames: ['example.com'],
    },
    rateLimiter: { hit },
  };
});

describe('published form captcha endpoint', () => {
  it('uses the host limiter with a separate captcha namespace', async () => {
    const page = await publish();
    siteverifyFetch.mockResolvedValue(Response.json({ success: false }));
    expect((await submit(page.id, undefined, { plugin: 'fresh', hostLimiter: true })).status).toBe(
      422,
    );
    expect(hit).toHaveBeenCalledTimes(2);
    expect(hit.mock.calls[0]?.[0]).not.toMatch(/^captcha:/);
    expect(hit.mock.calls[1]?.[0]).toMatch(/^captcha:/);
  });
  it('uses an independent memory limiter when no host limiter is supplied', async () => {
    const page = await publish();
    siteverifyFetch.mockResolvedValue(Response.json({ success: false }));
    expect((await submit(page.id, undefined, { plugin: 'fresh' })).status).toBe(422);
    expect(hit).not.toHaveBeenCalled();
    expect(siteverifyFetch).toHaveBeenCalledOnce();
  });
  it('logs and returns 503 when the verifier returns undefined', async () => {
    const page = await publish();
    const log = vi.spyOn(h.payload.logger, 'error').mockImplementation(() => {});
    verify.mockResolvedValueOnce(undefined as never);
    expect((await submit(page.id)).status).toBe(503);
    expect(log).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ reason: 'unavailable' }));
  });
  it('does not evict the captcha IP counter with invented form keys at a frozen clock', async () => {
    const page = await publish();
    const limiter = createMemoryRateLimiter({ limit: 1, windowMs: 60000, now: () => 123 });
    const captcha = env.captcha;
    if (!captcha) throw new Error('Missing captcha');
    env = {
      ...env,
      rateLimiter: limiter,
      captcha: {
        ...captcha,
        rateLimiter: createMemoryRateLimiter({
          limit: 1,
          windowMs: 60000,
          now: () => 123,
          failClosed: true,
        }),
      },
    };
    verify.mockResolvedValue({ ok: false, reason: 'invalid' });
    expect((await submit(page.id)).status).toBe(422);
    for (let i = 0; i < 10001; i++) {
      expect((await submit(page.id, { _hp: 'spam' }, { node: `invented${i}` })).status).toBe(200);
    }
    expect((await submit(page.id)).status).toBe(429);
    expect(verify).toHaveBeenCalledOnce();
  });
  it.each(['invalid', 'expired-or-reused'] as const)(
    'logs built-in %s once at warn before onInit using the live request logger',
    async (reason) => {
      const page = await publish();
      const warn = vi.spyOn(h.payload.logger, 'warn').mockImplementation(() => {});
      const error = vi.spyOn(h.payload.logger, 'error').mockImplementation(() => {});
      siteverifyFetch.mockResolvedValueOnce(
        Response.json({
          success: false,
          'error-codes': [reason === 'invalid' ? 'invalid-input-response' : 'timeout-or-duplicate'],
        }),
      );
      expect((await submit(page.id, undefined, { plugin: 'fresh' })).status).toBe(422);
      expect(warn).toHaveBeenCalledOnce();
      expect(error).not.toHaveBeenCalled();
    },
  );
  it('wires the built-in verifier and safe configuration logger through the plugin endpoint', async () => {
    const page = await publish();
    const log = vi.spyOn(h.payload.logger, 'error').mockImplementation(() => {});
    siteverifyFetch.mockResolvedValueOnce(
      Response.json({ success: false, 'error-codes': ['invalid-input-secret', SECRET, TOKEN] }),
    );
    expect((await submit(page.id, undefined, { plugin: true })).status).toBe(503);
    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'configuration', codes: ['invalid-input-secret'] }),
    );
    siteverifyFetch.mockResolvedValueOnce(
      Response.json({
        success: true,
        hostname: 'EXAMPLE.COM',
        action: CAPTCHA_ACTION,
        cdata: captchaCData(`pages:${page.id}`, FORM),
      }),
    );
    expect((await submit(page.id, undefined, { plugin: true })).status).toBe(200);
    expect(siteverifyFetch).toHaveBeenCalledTimes(2);
    expect(verify).not.toHaveBeenCalled();
    expect(JSON.stringify(log.mock.calls)).not.toContain(SECRET);
    expect(JSON.stringify(log.mock.calls)).not.toContain(TOKEN);
  });
  it('verifies one token with a 5s signal, stores and emails only author data, and logs no secrets or tokens', async () => {
    const page = await publish();
    bind(`pages:${page.id}`);
    const controller = new AbortController();
    const timeout = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(controller.signal);
    const logger = vi.spyOn(h.payload.logger, 'error').mockImplementation(() => {});
    const mail = vi.spyOn(h.payload, 'sendEmail').mockResolvedValue(undefined);
    env = {
      ...env,
      options: {
        ...env.options,
        forms: {
          ...env.options.forms,
          notifyTo: ['ops@example.com'],
          notifyAllowlist: ['@example.com'],
        },
      },
    };
    expect((await submit(page.id)).status).toBe(200);
    expect(timeout).toHaveBeenCalledWith(5000);
    expect(verify).toHaveBeenCalledExactlyOnceWith({ token: TOKEN, signal: controller.signal });
    const records = await count();
    const stored = records.find(
      (record) =>
        (record as unknown as { form: { documentId: string } }).form.documentId === String(page.id),
    );
    expect(stored).toMatchObject({ data: { message: 'hello' } });
    expect(JSON.stringify(stored)).not.toContain(TOKEN);
    expect(JSON.stringify(stored)).not.toContain(SECRET);
    expect(mail).toHaveBeenCalledOnce();
    expect(JSON.stringify(mail.mock.calls)).not.toContain(TOKEN);
    expect(JSON.stringify(logger.mock.calls)).not.toContain(TOKEN);
    expect(JSON.stringify(logger.mock.calls)).not.toContain(SECRET);
  });
  it.each(['invalid', 'expired-or-reused', 'unavailable'] as const)(
    'fails closed for verifier reason %s',
    async (reason) => {
      const page = await publish();
      const before = (await count()).length;
      const logger = vi.spyOn(h.payload.logger, 'error').mockImplementation(() => {});
      verify.mockResolvedValue({ ok: false, reason });
      const sent = await submit(page.id);
      expect(sent.status).toBe(reason === 'unavailable' ? 503 : 422);
      expect(sent.body).toEqual(
        reason === 'unavailable'
          ? { error: 'Verification is unavailable. Try again later.', code: 'captcha-unavailable' }
          : {
              errors: { [CAPTCHA_FIELD]: 'The verification failed. Try again.' },
              codes: { [CAPTCHA_FIELD]: 'captcha' },
            },
      );
      expect((await count()).length).toBe(before);
      expect(JSON.stringify(logger.mock.calls)).not.toContain(TOKEN);
      expect(JSON.stringify(logger.mock.calls)).not.toContain(SECRET);
    },
  );
  it.each([undefined, null, 42, '', ['one', 'two'], 'a b', 'valid\n', '\u00e9', 'x'.repeat(2049)])(
    'rejects a missing or malformed token without verification: %j',
    async (token) => {
      const page = await publish();
      expect((await submit(page.id, { message: 'hello', [CAPTCHA_FIELD]: token })).status).toBe(
        422,
      );
      expect(verify).not.toHaveBeenCalled();
      expect(hit).toHaveBeenCalledOnce();
    },
  );
  it('rejects repeated token fields on the HTML path', async () => {
    const page = await publish();
    const sent = await submit(page.id, {}, { html: true, repeated: true });
    expect(sent.status).toBe(303);
    expect(sent.response.headers.get('location')).toBe('/contact?x=1&buildr-form=invalid');
    expect(verify).not.toHaveBeenCalled();
  });
  it('fails closed without server captcha configuration', async () => {
    const page = await publish();
    env = { ...env, captcha: undefined };
    expect((await submit(page.id)).status).toBe(503);
    expect(verify).not.toHaveBeenCalled();
  });
  it.each([
    { hostname: 'evil.example' },
    { action: 'other' },
    { cdata: '' },
    { hostname: undefined },
    { action: 123 },
    { cdata: {} },
  ])('rejects mismatched or malformed ok results: %j', async (override) => {
    const page = await publish();
    bind(`pages:${page.id}`);
    verify.mockResolvedValue({
      ok: true,
      hostname: 'example.com',
      action: CAPTCHA_ACTION,
      cdata: captchaCData(`pages:${page.id}`, FORM),
      ...override,
    } as CaptchaVerification);
    expect((await submit(page.id)).status).toBe(422);
  });
  it('normalises verified hostname case', async () => {
    const page = await publish();
    bind(`pages:${page.id}`, FORM, 'EXAMPLE.COM');
    expect((await submit(page.id)).status).toBe(200);
  });
  it('rejects form A binding on form B and another document or template binding', async () => {
    const doc = layout();
    const second = 'form000002';
    const two: BuilderDocument = {
      ...doc,
      nodes: {
        ...doc.nodes,
        root: { id: 'root', type: 'buildr/page', slots: { default: [FORM, second] } },
        [second]: { id: second, type: 'buildr/form', slots: { default: ['captcha002'] } },
        captcha002: { id: 'captcha002', type: CAPTCHA_TYPE },
      },
    };
    const page = await publish(two);
    bind(`pages:${page.id}`);
    expect((await submit(page.id, { [CAPTCHA_FIELD]: TOKEN }, { node: second })).status).toBe(422);
    const other = await publish();
    expect((await submit(other.id)).status).toBe(422);
    bind('buildr-templates:123');
    expect((await submit(page.id)).status).toBe(422);
  });
  it('pages sharing a template and the template endpoint share the canonical digest', async () => {
    const template = await h.payload.create({
      collection: 'buildr-templates' as never,
      data: {
        title: 'Protected template',
        targetCollection: 'pages',
        layout: layout(),
        _status: 'published',
      } as never,
    });
    const one = await publish(undefined, { template: template.id, layout: undefined });
    const two = await publish(undefined, { template: template.id, layout: undefined });
    const ref = `buildr-templates:${template.id}`;
    bind(ref);
    expect((await submit(one.id)).status).toBe(200);
    expect((await submit(two.id)).status).toBe(200);
    expect((await submit(template.id, undefined, { collection: 'buildr-templates' })).status).toBe(
      200,
    );
    expect(captchaCData(ref, FORM)).not.toBe(captchaCData(`pages:${one.id}`, FORM));
    expect(verify).toHaveBeenCalledTimes(3);
  });
  it('keeps schema and captcha requirement from one snapshot across verification', async () => {
    const page = await publish();
    const lookup = vi.spyOn(h.payload, 'findByID');
    verify.mockImplementation(async () => {
      // A later read would now see another schema and no challenge.
      lookup.mockResolvedValue({
        id: page.id,
        _status: 'published',
        layout: layout(false, 'other'),
      } as never);
      return {
        ok: true,
        hostname: 'example.com',
        action: CAPTCHA_ACTION,
        cdata: captchaCData(`pages:${page.id}`, FORM),
      };
    });
    expect((await submit(page.id)).status).toBe(200);
    expect(lookup).toHaveBeenCalledOnce();
  });
  it('leaves no-captcha forms unchanged, including unknown buildr-captcha submissions', async () => {
    const page = await publish(layout(false));
    expect((await submit(page.id, { message: 'hello' })).status).toBe(200);
    const extra = await submit(page.id);
    expect(extra.status).toBe(422);
    expect(extra.body.codes).toEqual({ [CAPTCHA_FIELD]: 'unknown' });
    expect(verify).not.toHaveBeenCalled();
    expect(hit).toHaveBeenCalledTimes(2);
  });
  it.each([true, false])(
    'rejects the reserved author field even with captcha=%s',
    async (captcha) => {
      const page = await publish(layout(captcha, CAPTCHA_FIELD));
      const logger = vi.spyOn(h.payload.logger, 'error').mockImplementation(() => {});
      expect((await submit(page.id)).status).toBe(503);
      expect(verify).not.toHaveBeenCalled();
      expect(logger).toHaveBeenCalledWith(expect.objectContaining({ reason: 'configuration' }));
    },
  );
  it.each([true, false])(
    'redirects HTML verification errors (unavailable=%s)',
    async (unavailable) => {
      const page = await publish();
      verify.mockResolvedValue({ ok: false, reason: unavailable ? 'unavailable' : 'invalid' });
      const sent = await submit(page.id, undefined, { html: true });
      expect(sent.status).toBe(303);
      expect(sent.response.headers.get('location')).toBe('/contact?x=1&buildr-form=invalid');
    },
  );
  it('honours the honeypot and both rate limit checks before verification', async () => {
    const page = await publish();
    expect((await submit(page.id, { _hp: 'spam' })).status).toBe(200);
    expect(verify).not.toHaveBeenCalled();
    hit.mockResolvedValueOnce({ allowed: false, retryAfterSeconds: 10 });
    const first = await submit(page.id);
    expect(first.status).toBe(429);
    expect(first.response.headers.get('retry-after')).toBe('10');
    expect(verify).not.toHaveBeenCalled();
    hit
      .mockResolvedValueOnce(allowed)
      .mockResolvedValueOnce({ allowed: false, retryAfterSeconds: 12 });
    expect((await submit(page.id)).status).toBe(429);
    expect(verify).not.toHaveBeenCalled();
    const hash = createHash('sha256')
      .update(`${h.payload.secret}:192.0.2.1`)
      .digest('hex')
      .slice(0, 32);
    expect(hit.mock.calls.at(-1)?.[0]).toBe(hash);
    expect(hit.mock.calls.at(-2)?.[0]).toBe(`${hash}:pages:${page.id}:${FORM}`);
  });
  it('uses the shared unknown IP bucket without fallback when the configured source fails', async () => {
    const page = await publish();
    bind(`pages:${page.id}`);
    env = {
      ...env,
      options: {
        ...env.options,
        forms: {
          ...env.options.forms,
          clientIp: () => {
            throw new Error(TOKEN);
          },
        },
      },
    };
    expect((await submit(page.id)).status).toBe(200);
    expect(hit.mock.calls.at(-1)?.[0]).toBe(
      createHash('sha256').update(`${h.payload.secret}:unknown`).digest('hex').slice(0, 32),
    );
  });
  it('caps in-flight work without an extra call and releases on success and throws', async () => {
    const page = await publish();
    let finish: (value: CaptchaVerification) => void = () => {};
    verify.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const pending = submit(page.id);
    await vi.waitFor(() => expect(verify).toHaveBeenCalledOnce());
    expect((await submit(page.id)).status).toBe(503);
    expect(verify).toHaveBeenCalledOnce();
    finish({
      ok: true,
      hostname: 'example.com',
      action: CAPTCHA_ACTION,
      cdata: captchaCData(`pages:${page.id}`, FORM),
    });
    expect((await pending).status).toBe(200);
    verify.mockRejectedValueOnce(new Error(`${SECRET} ${TOKEN}`));
    expect((await submit(page.id)).status).toBe(503);
    bind(`pages:${page.id}`);
    expect((await submit(page.id)).status).toBe(200);
  });
  it('races a never-settling verifier, releases at the deadline and discards late results', async () => {
    const page = await publish();
    const controller = new AbortController();
    const timeout = vi.spyOn(AbortSignal, 'timeout').mockImplementationOnce((ms) => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      setTimeout(() => controller.abort(), ms);
      return controller.signal;
    });
    let finish: (value: CaptchaVerification) => void = () => {};
    verify.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const pending = submit(page.id);
    while (verify.mock.calls.length === 0)
      await new Promise<void>((resolve) => setImmediate(resolve));
    expect(timeout).toHaveBeenCalledWith(5000);
    await vi.advanceTimersByTimeAsync(4999);
    expect(controller.signal.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(controller.signal.aborted).toBe(true);
    vi.useRealTimers();
    expect((await pending).status).toBe(503);
    bind(`pages:${page.id}`);
    expect((await submit(page.id)).status).toBe(200);
    const before = (await count()).length;
    const log = vi.spyOn(h.payload.logger, 'error');
    const warn = vi.spyOn(h.payload.logger, 'warn');
    finish({
      ok: true,
      hostname: 'example.com',
      action: CAPTCHA_ACTION,
      cdata: captchaCData(`pages:${page.id}`, FORM),
    });
    await Promise.resolve();
    expect((await count()).length).toBe(before);
    expect(log).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });
});

describe('published graph configuration checks', () => {
  // These fixtures bypass publication validation to exercise fail-closed handling of corrupt storage.
  const stored = (doc: BuilderDocument, id: number | undefined = 123) =>
    vi
      .spyOn(h.payload, 'findByID')
      .mockResolvedValue({ id, _status: 'published', layout: doc } as never);
  it('requires hidden and conditional captchas too', async () => {
    const doc = layout();
    stored({
      ...doc,
      nodes: {
        ...doc.nodes,
        [CAP]: {
          id: CAP,
          type: CAPTCHA_TYPE,
          styles: { base: { visibility: { hidden: true } } },
          visibleIf: s(false),
        },
      },
    } as unknown as BuilderDocument);
    expect((await submit(123, { message: 'hello' })).status).toBe(422);
    expect(verify).not.toHaveBeenCalled();
  });
  it('rejects multiple captchas in the nearest form', async () => {
    const doc = layout();
    stored({
      ...doc,
      nodes: {
        ...doc.nodes,
        [FORM]: { id: FORM, type: 'buildr/form', slots: { default: [CAP, 'captcha002'] } },
        captcha002: { id: 'captcha002', type: CAPTCHA_TYPE },
      },
    });
    expect((await submit(123)).status).toBe(503);
    expect(verify).not.toHaveBeenCalled();
  });
  it.each([true, false])(
    'rejects a captcha-bearing ancestor even when the inner form captcha=%s',
    async (innerCaptcha) => {
      const doc = layout();
      const inner = 'form000002';
      stored({
        ...doc,
        nodes: {
          ...doc.nodes,
          [FORM]: { id: FORM, type: 'buildr/form', slots: { default: [CAP, inner] } },
          [inner]: {
            id: inner,
            type: 'buildr/form',
            slots: { default: innerCaptcha ? ['captcha002'] : [] },
          },
          captcha002: { id: 'captcha002', type: CAPTCHA_TYPE },
        },
      });
      expect((await submit(123, {}, { node: inner })).status).toBe(503);
      expect(verify).not.toHaveBeenCalled();
    },
  );
  it('keeps nested-form captchas out of the outer form requirement', async () => {
    const doc = layout(false);
    stored({
      ...doc,
      components: { ...doc.components, [CAPTCHA_TYPE]: 1 },
      nodes: {
        ...doc.nodes,
        [FORM]: { id: FORM, type: 'buildr/form', slots: { default: [FIELD, 'form000002'] } },
        form000002: { id: 'form000002', type: 'buildr/form', slots: { default: [CAP] } },
        [CAP]: { id: CAP, type: CAPTCHA_TYPE },
      },
    });
    expect((await submit(123, { message: 'hello' })).status).toBe(200);
    expect(verify).not.toHaveBeenCalled();
  });
  it('handles corrupt graph edges without duplicating a captcha or hanging', async () => {
    const doc = layout();
    stored({
      ...doc,
      nodes: {
        ...doc.nodes,
        [FORM]: {
          id: FORM,
          type: 'buildr/form',
          slots: { default: [FIELD, CAP, CAP, 'dangling01', FORM] },
        },
      },
    });
    bind('pages:123');
    expect((await submit(123)).status).toBe(200);
    expect(verify).toHaveBeenCalledOnce();
  });
  it.each(['pages', 'buildr-templates'])(
    'answers 404 without verification when canonical reference is null: %s',
    async (collection) => {
      stored(layout(), undefined);
      // Explicit undefined would trigger the helper default; replace the row without an id instead.
      vi.mocked(h.payload.findByID).mockResolvedValue({
        _status: 'published',
        layout: layout(),
      } as never);
      expect((await submit(123, undefined, { collection })).status).toBe(404);
      expect(verify).not.toHaveBeenCalled();
    },
  );
  it('excludes the captcha token from the 200 author-field limit', async () => {
    const doc = layout();
    const fields = Array.from({ length: 200 }, (_, i) => ({
      id: `field${String(i).padStart(5, '0')}`,
      type: 'test/field',
      props: { name: s(`f${i}`) },
    }));
    stored({
      ...doc,
      nodes: {
        root: doc.nodes['root'],
        [FORM]: {
          id: FORM,
          type: 'buildr/form',
          slots: { default: [...fields.map((node) => node.id), CAP] },
        },
        ...Object.fromEntries(fields.map((node) => [node.id, node])),
        [CAP]: { id: CAP, type: CAPTCHA_TYPE },
      },
    } as BuilderDocument);
    bind('pages:123');
    const values = Object.fromEntries(fields.map((_, i) => [`f${i}`, 'value']));
    expect((await submit(123, { ...values, [CAPTCHA_FIELD]: TOKEN })).status).toBe(200);
    expect(verify).toHaveBeenCalledOnce();
    expect((await submit(123, { ...values, extra: 'value', [CAPTCHA_FIELD]: TOKEN })).status).toBe(
      422,
    );
    expect(verify).toHaveBeenCalledOnce();
  });
  it('rejects a reserved author field even beyond schema derivation limits', async () => {
    const doc = layout(false);
    const fields = Array.from({ length: 201 }, (_, i) => ({
      id: `field${String(i).padStart(5, '0')}`,
      type: 'test/field',
      props: { name: s(i === 200 ? CAPTCHA_FIELD : `f${i}`) },
    }));
    stored({
      ...doc,
      nodes: {
        root: doc.nodes['root'],
        [FORM]: {
          id: FORM,
          type: 'buildr/form',
          slots: { default: fields.map((node) => node.id) },
        },
        ...Object.fromEntries(fields.map((node) => [node.id, node])),
      },
    } as BuilderDocument);
    expect((await submit(123, {})).status).toBe(503);
    expect(verify).not.toHaveBeenCalled();
  });
});
