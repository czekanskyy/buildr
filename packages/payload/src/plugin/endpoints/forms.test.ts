import {
  type BuilderDocument,
  type ComponentMeta,
  createRegistryMeta,
  p,
  s,
} from '@next-buildr/core';
import { handleEndpoints } from 'payload';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildrPlugin } from '../index.ts';
import { BUILDR_WRITE } from '../write-guard.ts';
import {
  meta as baseMeta,
  migrations as baseMigrations,
  boot,
  type Harness,
} from './endpoints.test-kit.ts';

const field = (type: string, label: string, props: ComponentMeta['props'], formField: object) =>
  ({
    type,
    version: 1,
    label,
    category: 'forms',
    props,
    contentCategories: ['flow', 'form-control'],
    styles: { groups: [] },
    runtime: 'shared',
    formField,
  }) as unknown as ComponentMeta;

const common = {
  name: p.text({ label: 'Name', default: '' }),
  required: p.boolean({ label: 'Required', default: false }),
};

const components: ComponentMeta[] = [
  {
    type: 'buildr/form',
    version: 1,
    label: 'Form',
    category: 'forms',
    props: {},
    contentCategories: ['flow'],
    styles: { groups: [] },
    runtime: 'shared',
    slots: { default: {} },
  },
  field(
    'buildr/text-field',
    'Text',
    { ...common, maxLength: p.number({ label: 'Max length', default: 100 }) },
    { valueType: 'string', nameProp: 'name', requiredProp: 'required', maxLengthProp: 'maxLength' },
  ),
  field('buildr/email-field', 'Email', common, {
    valueType: 'email',
    nameProp: 'name',
    requiredProp: 'required',
  }),
  field(
    'buildr/choice',
    'Choice',
    {
      ...common,
      options: p.list(
        p.object({
          label: p.text({ label: 'Label', default: 'Option' }),
          value: p.text({ label: 'Value', default: '' }),
        }),
        { label: 'Options' },
      ),
    },
    { valueType: 'enum', nameProp: 'name', requiredProp: 'required', optionsProp: 'options' },
  ),
  field('buildr/check', 'Check', common, {
    valueType: 'boolean',
    nameProp: 'name',
    requiredProp: 'required',
  }),
];

const meta = createRegistryMeta({ components: [...baseMeta.list(), ...components] });
const migrations = {
  ...(baseMigrations as Record<string, unknown>),
  ...Object.fromEntries(
    components.map((component) => [component.type, { currentVersion: 1, steps: [] }]),
  ),
} as never;

interface NodeSpec {
  readonly id: string;
  readonly type: string;
  readonly props: Record<string, unknown>;
}

const FORM = 'form000001';
const fieldNodes = (extra: NodeSpec[] = []): NodeSpec[] => [
  {
    id: 'field00001',
    type: 'buildr/text-field',
    props: { name: s('subject'), required: s(true), maxLength: s(10) },
  },
  { id: 'field00002', type: 'buildr/email-field', props: { name: s('email'), required: s(true) } },
  {
    id: 'field00003',
    type: 'buildr/choice',
    props: {
      name: s('topic'),
      options: s([
        { label: 'Sales', value: 'sales' },
        { label: 'Help', value: 'help' },
      ]),
    },
  },
  { id: 'field00004', type: 'buildr/check', props: { name: s('consent') } },
  ...extra,
];

/** A page holding one form with `fields` inside it. */
const formLayout = (fields: NodeSpec[] = fieldNodes()): BuilderDocument => {
  const types = new Set(['buildr/page', 'buildr/form', ...fields.map((node) => node.type)]);
  return {
    schemaVersion: 1,
    root: 'root',
    nodes: {
      root: { id: 'root', type: 'buildr/page', slots: { default: [FORM] } },
      [FORM]: { id: FORM, type: 'buildr/form', slots: { default: fields.map((node) => node.id) } },
      ...Object.fromEntries(fields.map((node) => [node.id, node])),
    },
    components: Object.fromEntries([...types].map((type) => [type, 1])),
  } as never;
};

const valid = { subject: 'Hello', email: 'a@b.co', topic: 'help', consent: 'on' };

let h: Harness;
let counter = 0;
const mails: Record<string, unknown>[] = [];
let mailDown = false;
beforeAll(async () => {
  h = await boot(
    'forms',
    {
      registry: { meta, migrations },
      collections: { pages: { context: 'page', templates: true } },
      forms: {
        enabled: true,
        notifyAllowlist: ['@example.com'],
        notifyTo: ['ops@example.com'],
        rateLimit: { limit: 4, windowMs: 60_000 },
      },
    },
    {
      email: () => ({
        name: 'test',
        defaultFromAddress: 'noreply@example.com',
        defaultFromName: 'Site',
        sendEmail: async (message) => {
          if (mailDown) throw new Error('smtp down');
          mails.push(message as never);
        },
      }),
    },
  );
});
afterAll(() => h.close());

const publish = (layout: unknown, data: Record<string, unknown> = {}) =>
  h.payload.create({
    collection: 'pages',
    data: {
      title: 'Contact',
      slug: `p${++counter}`,
      layout,
      _status: 'published',
      ...data,
    } as never,
  });

interface Sent {
  readonly status: number;
  readonly body: any;
  readonly headers: Headers;
}

/** POSTs to the form endpoint from a fresh address (the limiter is per address). */
async function submit(
  path: string,
  values: Record<string, unknown>,
  options: { as?: 'json' | 'urlencoded'; ip?: string; headers?: Record<string, string> } = {},
): Promise<Sent> {
  const urlencoded = options.as === 'urlencoded';
  const response = await handleEndpoints({
    config: h.payload.config,
    request: new Request(`http://localhost/api/buildr/forms/${path}`, {
      method: 'POST',
      headers: {
        'content-type': urlencoded ? 'application/x-www-form-urlencoded' : 'application/json',
        'x-forwarded-for': options.ip ?? `10.0.0.${++counter}`,
        ...options.headers,
      },
      body: urlencoded
        ? new URLSearchParams(values as Record<string, string>).toString()
        : JSON.stringify(values),
    }),
  });
  const text = await response.text();
  return {
    status: response.status,
    body: text === '' ? undefined : JSON.parse(text),
    headers: response.headers,
  };
}

const submissions = async () =>
  (await h.payload.find({ collection: 'buildr-form-submissions' as never, limit: 100, depth: 0 }))
    .docs as unknown as Record<string, any>[];

describe('POST /buildr/forms/:collection/:id/:nodeId', () => {
  it('stores a valid submission and notifies the allowlisted recipient', async () => {
    const page = await publish(formLayout());
    const before = (await submissions()).length;
    const sent = await submit(`pages/${page.id}/${FORM}`, valid, {
      headers: { 'user-agent': 'vitest' },
    });
    expect(sent).toMatchObject({ status: 200, body: { ok: true } });

    const stored = (await submissions()).find((doc) => doc['form'].documentId === String(page.id));
    expect((await submissions()).length).toBe(before + 1);
    expect(stored).toMatchObject({
      form: { collection: 'pages', documentId: String(page.id), nodeId: FORM },
      data: { subject: 'Hello', email: 'a@b.co', topic: 'help', consent: true },
      meta: { userAgent: 'vitest' },
    });
    expect(stored?.['meta'].ipHash).toMatch(/^[0-9a-f]{32}$/);
    expect(mails).toEqual([
      expect.objectContaining({
        to: 'ops@example.com',
        text: expect.stringContaining('subject: Hello'),
      }),
    ]);
  });

  it('does not lose the submission when the notification fails', async () => {
    const page = await publish(formLayout());
    mailDown = true;
    const answer = await submit(`pages/${page.id}/${FORM}`, valid);
    mailDown = false;
    expect(answer.status).toBe(200);
    expect((await submissions()).some((doc) => doc['form'].documentId === String(page.id))).toBe(
      true,
    );
  });

  it('rejects invalid values, field by field', async () => {
    const page = await publish(formLayout());
    const sent = await submit(`pages/${page.id}/${FORM}`, {
      subject: 'much too long for this field',
      email: 'not-an-email',
      topic: 'refunds',
    });
    expect(sent.status).toBe(422);
    expect(sent.body.codes).toEqual({
      subject: 'too-long',
      email: 'invalid',
      topic: 'invalid',
    });
    expect(Object.keys(sent.body.errors)).toEqual(['subject', 'email', 'topic']);

    const missing = await submit(`pages/${page.id}/${FORM}`, {});
    expect(missing.body.codes).toEqual({ subject: 'required', email: 'required' });
  });

  it('never accepts a field the published document does not have', async () => {
    const page = await publish(formLayout());
    const sent = await submit(`pages/${page.id}/${FORM}`, {
      ...valid,
      isAdmin: 'true',
      _redirect: 'https://evil.example',
    });
    expect(sent.status).toBe(422);
    expect(sent.body.codes['isAdmin']).toBe('unknown');
    expect(sent.body.codes['_redirect']).toBe('unknown');
  });

  it('derives the schema from the published layout, not from a newer draft', async () => {
    const page = await publish(formLayout());
    const extended = formLayout(
      fieldNodes([
        {
          id: 'field00005',
          type: 'buildr/text-field',
          props: { name: s('phone'), maxLength: s(20) },
        },
      ]),
    );
    await h.payload.update({
      collection: 'pages',
      id: page.id,
      data: { layout: extended } as never,
      draft: true,
      context: { [BUILDR_WRITE]: true },
    });
    const sent = await submit(`pages/${page.id}/${FORM}`, { ...valid, phone: '123' });
    expect(sent.status).toBe(422);
    expect(sent.body.codes).toEqual({ phone: 'unknown' });
  });

  it('is unreachable for a document that was never published', async () => {
    const draft = await h.payload.create({
      collection: 'pages',
      data: { title: 'Wip', slug: `d${++counter}`, layout: formLayout() } as never,
      draft: true,
    });
    const sent = await submit(`pages/${draft.id}/${FORM}`, valid);
    expect(sent.status).toBe(404);
  });

  it('answers 404 for a node that is not a form, a missing node and a collection it does not serve', async () => {
    const page = await publish(formLayout());
    expect((await submit(`pages/${page.id}/field00001`, valid)).status).toBe(404);
    expect((await submit(`pages/${page.id}/nothing0001`, valid)).status).toBe(404);
    expect((await submit(`pages/99999/${FORM}`, valid)).status).toBe(404);
    expect((await submit(`users/${page.id}/${FORM}`, valid)).status).toBe(404);
  });

  it('turns a bot away quietly: the honeypot is answered as a success and stores nothing', async () => {
    const page = await publish(formLayout());
    const before = (await submissions()).length;
    const sent = await submit(`pages/${page.id}/${FORM}`, { ...valid, _hp: 'buy now' });
    expect(sent).toMatchObject({ status: 200, body: { ok: true } });
    expect((await submissions()).length).toBe(before);
    // An empty honeypot is what a person sends.
    expect((await submit(`pages/${page.id}/${FORM}`, { ...valid, _hp: '' })).status).toBe(200);
  });

  it('limits the submissions of one visitor to one form, with a 429 and a retry-after', async () => {
    const page = await publish(formLayout());
    const ip = '203.0.113.9';
    for (let attempt = 0; attempt < 4; attempt += 1) {
      expect((await submit(`pages/${page.id}/${FORM}`, valid, { ip })).status).toBe(200);
    }
    const limited = await submit(`pages/${page.id}/${FORM}`, valid, { ip });
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get('retry-after'))).toBeGreaterThan(0);
    // Another visitor is not affected.
    expect((await submit(`pages/${page.id}/${FORM}`, valid)).status).toBe(200);
  });

  it('refuses a body that is not a form or JSON, and an oversized one', async () => {
    const page = await publish(formLayout());
    const url = `http://localhost/api/buildr/forms/pages/${page.id}/${FORM}`;
    const text = await handleEndpoints({
      config: h.payload.config,
      request: new Request(url, {
        method: 'POST',
        headers: { 'content-type': 'text/plain' },
        body: 'x',
      }),
    });
    expect(text.status).toBe(415);
    const big = await handleEndpoints({
      config: h.payload.config,
      request: new Request(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'content-length': '1000000' },
        body: '{}',
      }),
    });
    expect(big.status).toBe(413);
  });

  it('serves a plain HTML form with a 303 back to the page it came from', async () => {
    const page = await publish(formLayout());
    const referer = 'http://localhost/contact?utm=1';
    const sent = await submit(`pages/${page.id}/${FORM}`, valid, {
      as: 'urlencoded',
      headers: { referer },
    });
    expect(sent.status).toBe(303);
    expect(sent.headers.get('location')).toBe('/contact?utm=1&buildr-form=sent');

    const invalid = await submit(
      `pages/${page.id}/${FORM}`,
      { subject: 'x' },
      {
        as: 'urlencoded',
        headers: { referer },
      },
    );
    expect(invalid.status).toBe(303);
    expect(invalid.headers.get('location')).toBe('/contact?utm=1&buildr-form=invalid');
  });

  it('never redirects off the site', async () => {
    const page = await publish(formLayout());
    const sent = await submit(`pages/${page.id}/${FORM}`, valid, {
      as: 'urlencoded',
      headers: { referer: 'https://evil.example/phish' },
    });
    expect(sent.status).toBe(303);
    expect(sent.headers.get('location')).toBe('/');
  });

  it('finds the form of an inherited layout in its template', async () => {
    const template = await h.payload.create({
      collection: 'buildr-templates' as never,
      data: {
        title: 'With form',
        targetCollection: 'pages',
        layout: formLayout(),
        _status: 'published',
      } as never,
    });
    const page = await publish(undefined, { template: template.id });
    expect((await submit(`pages/${page.id}/${FORM}`, valid)).status).toBe(200);
    expect((await submit(`buildr-templates/${template.id}/${FORM}`, valid)).status).toBe(200);
  });
});

describe('forms configuration', () => {
  it('needs a registry, and notifies only allowlisted recipients', () => {
    expect(() => buildrPlugin({ collections: {}, forms: { enabled: true } })).toThrow(/registry/);
    expect(() =>
      buildrPlugin({
        collections: {},
        registry: { meta },
        forms: { enabled: true, notifyAllowlist: ['@example.com'], notifyTo: ['x@evil.example'] },
      }),
    ).toThrow(/notifyAllowlist/);
  });
});
