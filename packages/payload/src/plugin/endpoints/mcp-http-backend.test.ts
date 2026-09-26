import { runBackendContract } from '@next-buildr/mcp/testing';
import { handleEndpoints } from 'payload';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPayloadMcpBackend } from '../../mcp/http-backend.ts';
import { boot, type Harness, withChild } from './endpoints.test-kit.ts';

const KEYS = {
  agent: 'agent-key-0123456789',
  readOnly: 'ro-key-0123456789',
  plain: 'plain-key-0123456789',
};
let h: Harness;

/** A `fetch` that answers from the live Payload of the harness, exactly as the site would over HTTP. */
const payloadFetch: typeof fetch = (input, init) =>
  handleEndpoints({ config: h.payload.config, request: new Request(input, init) });

const backendFor = (apiKey: string) =>
  createPayloadMcpBackend({
    baseUrl: 'http://localhost/api',
    apiKey,
    collections: ['pages'],
    fetch: payloadFetch,
    retries: 0,
  });

beforeAll(async () => {
  h = await boot(
    'mcp-http-backend',
    {
      mcp: { enabled: true, allowPublish: true, collections: ['pages'] },
      access: {
        edit: ({ req }) => !String((req.user as { email?: string }).email).startsWith('ro'),
        publish: ({ req }) => String((req.user as { email?: string }).email).startsWith('pub'),
      },
    },
    { collections: [{ slug: 'users', auth: { useAPIKey: true }, fields: [] }] },
  );
  const users = [
    { email: 'pub-agent@example.com', apiKey: KEYS.agent },
    { email: 'ro-agent@example.com', apiKey: KEYS.readOnly },
    { email: 'plain-agent@example.com', apiKey: KEYS.plain },
  ];
  for (const user of users) {
    await h.payload.create({
      collection: 'users',
      data: { ...user, password: 'secret-password', enableAPIKey: true },
    });
  }
});
afterAll(() => h.close());

runBackendContract({
  name: 'payload HTTP backend (live Payload, SQLite)',
  async create() {
    const doc = await h.payload.create({
      collection: 'pages',
      data: { title: 'Existing', slug: `existing-${Date.now()}`, buildrRevision: 0 },
      draft: true,
    });
    // Give the draft a real layout so load/save round-trip a non-empty document.
    await h.payload.update({
      collection: 'pages',
      id: doc.id,
      data: { layout: withChild({ title: { kind: 'static', value: 'Hi' } }), buildrRevision: 1 },
      draft: true,
    });
    return {
      backend: backendFor(KEYS.agent),
      existing: { collection: 'pages', id: String(doc.id) },
      missing: { collection: 'pages', id: '999999' },
      collection: 'pages',
      unknownCollection: 'nope',
      dataSchemaCollection: 'pages',
      noDataSchemaCollection: 'nope',
      readOnlyBackend: backendFor(KEYS.readOnly),
      noPublishBackend: backendFor(KEYS.plain),
    };
  },
});

describe('against a live Payload', () => {
  it('reports the agent user and its permissions', async () => {
    const session = await backendFor(KEYS.agent).getSession();
    expect(session.ok && session.value.user.email).toBe('pub-agent@example.com');
    expect(session.ok && session.value.permissions.canPublish).toBe(true);
  });

  it('turns a rejected key into forbidden without echoing it', async () => {
    const result = await backendFor('not-a-real-key-000000').getSession();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('forbidden');
      expect(JSON.stringify(result.error)).not.toContain('not-a-real-key-000000');
    }
  });
});
