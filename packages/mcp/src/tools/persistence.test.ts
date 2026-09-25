import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterEach, describe, expect, it } from 'vitest';
import { type McpBackend, mcpFail } from '../backend.ts';
import { createMemoryBackend, type MemoryBackendOptions } from '../backends/memory.ts';
import { createBuildrMcpServerWithTools } from '../default-server.ts';
import { loadDefaultManifest } from '../serialize/default-manifest.test-kit.ts';

const clients: Client[] = [];

interface Called {
  readonly isError: boolean;
  readonly text: string;
  readonly data: Record<string, unknown>;
}

async function setup(
  options: {
    session?: MemoryBackendOptions['session'];
    allowPublish?: boolean;
    wrap?: (backend: McpBackend) => McpBackend;
  } = {},
) {
  const memory = createMemoryBackend({
    manifest: loadDefaultManifest(),
    collections: ['pages'],
    documents: [{ ref: { collection: 'pages', id: '1' }, title: 'Home', slug: 'home' }],
    session: options.session ?? {},
    previewBaseUrl: 'https://example.test',
  });
  const backend = options.wrap ? options.wrap(memory) : memory;
  const { server, store } = await createBuildrMcpServerWithTools({
    backend,
    options: { allowPublish: options.allowPublish ?? true },
  });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test-client', version: '0.0.0' });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  clients.push(client);
  const call = async (name: string, args: Record<string, unknown>): Promise<Called> => {
    const result = await client.callTool({ name, arguments: args });
    const content = result.content as { type: string; text: string }[];
    return {
      isError: result.isError === true,
      text: content.map((c) => c.text).join('\n'),
      data: (result.structuredContent ?? {}) as Record<string, unknown>,
    };
  };
  const toolNames = async () => (await client.listTools()).tools.map((t) => t.name);
  return { memory, backend, store, client, call, toolNames };
}

type Ctx = Awaited<ReturnType<typeof setup>>;

afterEach(async () => {
  await Promise.all(clients.splice(0).map((client) => client.close()));
});

/** Opens page 1, inserts a hero and returns the session id (dirty). */
async function openWithHero(ctx: Ctx) {
  const opened = await ctx.call('open_document', { collection: 'pages', id: '1' });
  expect(opened.isError, opened.text).toBe(false);
  const sessionId = opened.data['sessionId'] as string;
  const inserted = await ctx.call('insert_nodes', { sessionId, template: 'buildr/hero' });
  expect(inserted.isError, inserted.text).toBe(false);
  return sessionId;
}

async function headingId(ctx: Ctx, sessionId: string) {
  const outline = await ctx.call('get_outline', { sessionId, depth: 6 });
  const line = outline.text
    .split('\n')
    .map((l) => l.trim().split(' '))
    .find((parts) => parts[1] === 'buildr/heading');
  if (!line?.[0]) throw new Error(outline.text);
  return line[0];
}

const published = async (ctx: Ctx) =>
  (await ctx.call('list_documents', { status: 'published' })).text;

describe('tool registration', () => {
  it('offers the complete tool list, publish included when allowed and permitted', async () => {
    const { toolNames } = await setup();
    const names = await toolNames();
    for (const name of [
      'validate',
      'save',
      'publish',
      'get_preview_url',
      'list_components',
      'insert_nodes',
    ]) {
      expect(names).toContain(name);
    }
  });

  it('leaves publish out unless the operator allows it', async () => {
    const { toolNames } = await setup({ allowPublish: false });
    expect(await toolNames()).not.toContain('publish');
  });

  it('leaves publish out when the user cannot publish', async () => {
    const { toolNames } = await setup({ session: { permissions: { canPublish: false } } });
    const names = await toolNames();
    expect(names).not.toContain('publish');
    expect(names).toContain('save');
  });
});

describe('validate', () => {
  it('reports findings against nodes with a suggested call', async () => {
    const ctx = await setup();
    const sessionId = await openWithHero(ctx);
    const clean = await ctx.call('validate', { sessionId });
    expect(clean.isError).toBe(false);
    const id = await headingId(ctx, sessionId);
    await ctx.call('update_node', { sessionId, nodeId: id, props: { text: '' } });
    const report = await ctx.call('validate', { sessionId });
    expect(report.data['ok']).toBe(false);
    const issues = report.data['issues'] as {
      nodeId?: string;
      code: string;
      suggestedCall?: unknown;
    }[];
    const empty = issues.find((i) => i.code === 'empty-heading');
    expect(empty?.nodeId).toBe(id);
    expect(empty?.suggestedCall).toBeDefined();
    expect(report.text).toContain('empty-heading');
  });
});

describe('save', () => {
  it('saves the draft, marks the session clean and never publishes', async () => {
    const ctx = await setup();
    const sessionId = await openWithHero(ctx);
    const saved = await ctx.call('save', { sessionId });
    expect(saved.isError, saved.text).toBe(false);
    expect(saved.data['revision']).toBe(1);
    expect(saved.data['dirty']).toBe(false);
    expect(ctx.store.list()[0]?.dirty).toBe(false);
    expect(ctx.store.list()[0]?.revision).toBe(1);
    expect(await published(ctx)).not.toContain('pages/1');
    const again = await ctx.call('save', { sessionId });
    expect(again.text).toContain('Nothing to save');
  });

  it('on 409 writes nothing and tells the agent to reopen and re-apply', async () => {
    const ctx = await setup();
    const a = await openWithHero(ctx);
    // The other writer: a second session saves first.
    const other = await ctx.call('open_document', { collection: 'pages', id: '1' });
    const b = other.data['sessionId'] as string;
    await ctx.call('insert_nodes', { sessionId: b, template: 'buildr/cta' });
    expect((await ctx.call('save', { sessionId: b })).isError).toBe(false);

    const conflict = await ctx.call('save', { sessionId: a });
    expect(conflict.isError).toBe(true);
    expect(conflict.text).toContain('revision 1');
    expect(conflict.text).toContain('Nothing was overwritten');
    expect(conflict.text).toContain('open_document');
    expect((conflict.data['error'] as { code: string }).code).toBe('conflict');
    // The other writer's document is intact.
    const reopened = await ctx.call('open_document', { collection: 'pages', id: '1' });
    const outline = await ctx.call('get_outline', {
      sessionId: reopened.data['sessionId'] as string,
      depth: 6,
    });
    expect(outline.text).toContain('buildr/cta');
    expect(outline.text).not.toContain('buildr/hero');
  });

  it('on 422 maps the diagnostics to nodes', async () => {
    let target = '';
    const ctx = await setup({
      wrap: (backend) => ({
        ...backend,
        save: async () =>
          mcpFail({
            code: 'invalid',
            message: 'The layout was rejected.',
            diagnostics: [
              {
                code: 'prop.invalid',
                message: 'text is too long',
                severity: 'error',
                path: ['nodes', target, 'props', 'text'],
              },
              { code: 'doc.limit', message: 'too big', severity: 'error' },
            ],
          }),
      }),
    });
    const sessionId = await openWithHero(ctx);
    target = await headingId(ctx, sessionId);
    const rejected = await ctx.call('save', { sessionId });
    expect(rejected.isError).toBe(true);
    expect(rejected.text).toContain(`${target} buildr/heading prop.invalid: text is too long`);
    expect(rejected.text).toContain('document doc.limit');
    const diags = (rejected.data['error'] as { diagnostics: { nodeId?: string }[] }).diagnostics;
    expect(diags[0]?.nodeId).toBe(target);
    expect(diags[1]?.nodeId).toBeUndefined();
    expect(ctx.store.list()[0]?.dirty).toBe(true);
  });

  it('on 403 explains the permission and keeps the working copy dirty', async () => {
    const ctx = await setup({
      wrap: (backend) => ({
        ...backend,
        save: async () =>
          mcpFail({ code: 'forbidden', message: 'This user may not edit documents.' }),
      }),
    });
    const sessionId = await openWithHero(ctx);
    const denied = await ctx.call('save', { sessionId });
    expect(denied.isError).toBe(true);
    expect(denied.text).toContain('permission');
    expect(ctx.store.list()[0]?.dirty).toBe(true);
  });

  it('refuses a read-only document', async () => {
    const ctx = await setup({ session: { permissions: { canEdit: false } } });
    const opened = await ctx.call('open_document', { collection: 'pages', id: '1' });
    const saved = await ctx.call('save', { sessionId: opened.data['sessionId'] as string });
    expect(saved.isError).toBe(true);
    expect(saved.text).toContain('read-only');
  });
});

describe('publish', () => {
  it('needs confirm: true and saved changes', async () => {
    const ctx = await setup();
    const sessionId = await openWithHero(ctx);
    const unconfirmed = await ctx.call('publish', { sessionId });
    expect(unconfirmed.isError).toBe(true);
    expect(unconfirmed.text).toContain('confirm: true');
    const unsaved = await ctx.call('publish', { sessionId, confirm: true });
    expect(unsaved.isError).toBe(true);
    expect(unsaved.text).toContain('save');
    expect(await published(ctx)).not.toContain('pages/1');
  });

  it('publishes a saved draft', async () => {
    const ctx = await setup();
    const sessionId = await openWithHero(ctx);
    await ctx.call('save', { sessionId });
    const result = await ctx.call('publish', { sessionId, confirm: true });
    expect(result.isError, result.text).toBe(false);
    expect(result.data['published']).toBe(true);
    expect(await published(ctx)).toContain('pages/1');
    expect(ctx.store.list()[0]?.dirty).toBe(false);
  });

  it('cannot publish a document with errors under publishPolicy block', async () => {
    const ctx = await setup({ session: { publishPolicy: 'block' } });
    const sessionId = await openWithHero(ctx);
    const id = await headingId(ctx, sessionId);
    await ctx.call('update_node', { sessionId, nodeId: id, props: { text: '' } });
    await ctx.call('save', { sessionId });
    const refused = await ctx.call('publish', { sessionId, confirm: true });
    expect(refused.isError).toBe(true);
    expect(refused.text).toContain('publish policy is "block"');
    expect(refused.text).toContain(id);
    expect(await published(ctx)).not.toContain('pages/1');
    // Fixing the error unblocks it.
    await ctx.call('update_node', { sessionId, nodeId: id, props: { text: 'Hello' } });
    await ctx.call('save', { sessionId });
    expect((await ctx.call('publish', { sessionId, confirm: true })).isError).toBe(false);
  });

  it('publishes a document with errors under the warn policy and says so', async () => {
    const ctx = await setup({ session: { publishPolicy: 'warn' } });
    const sessionId = await openWithHero(ctx);
    const id = await headingId(ctx, sessionId);
    await ctx.call('update_node', { sessionId, nodeId: id, props: { text: '' } });
    await ctx.call('save', { sessionId });
    const result = await ctx.call('publish', { sessionId, confirm: true });
    expect(result.isError, result.text).toBe(false);
    expect(result.text).toContain('error(s)');
  });

  it('on 409 writes nothing', async () => {
    const ctx = await setup({
      wrap: (backend) => ({
        ...backend,
        publish: async () => mcpFail({ code: 'conflict', message: 'moved on', currentRevision: 9 }),
      }),
    });
    const sessionId = await openWithHero(ctx);
    await ctx.call('save', { sessionId });
    const conflict = await ctx.call('publish', { sessionId, confirm: true });
    expect(conflict.isError).toBe(true);
    expect(conflict.text).toContain('revision 9');
  });

  it('on 422 maps the diagnostics, on 403 reports the permission', async () => {
    let mode: 'invalid' | 'forbidden' = 'invalid';
    const ctx = await setup({
      wrap: (backend) => ({
        ...backend,
        publish: async () =>
          mode === 'invalid'
            ? mcpFail({
                code: 'invalid',
                message: 'Accessibility errors.',
                diagnostics: [
                  {
                    code: 'a11y.empty-heading',
                    message: 'empty',
                    severity: 'error',
                    path: ['nodes', 'nope'],
                  },
                ],
              })
            : mcpFail({ code: 'forbidden', message: 'No publish rights.' }),
      }),
    });
    const sessionId = await openWithHero(ctx);
    await ctx.call('save', { sessionId });
    const invalid = await ctx.call('publish', { sessionId, confirm: true });
    expect(invalid.text).toContain('a11y.empty-heading');
    mode = 'forbidden';
    const denied = await ctx.call('publish', { sessionId, confirm: true });
    expect(denied.isError).toBe(true);
    expect(denied.text).toContain('No publish rights.');
  });

  it('refuses when the permission was withdrawn after registration', async () => {
    let canPublish = true;
    const ctx = await setup({
      wrap: (backend) => ({
        ...backend,
        getSession: async () => {
          const s = await backend.getSession();
          return s.ok
            ? {
                ok: true as const,
                value: { ...s.value, permissions: { ...s.value.permissions, canPublish } },
              }
            : s;
        },
      }),
    });
    const sessionId = await openWithHero(ctx);
    await ctx.call('save', { sessionId });
    canPublish = false;
    const denied = await ctx.call('publish', { sessionId, confirm: true });
    expect(denied.isError).toBe(true);
    expect(denied.text).toContain('not allowed');
  });
});

describe('get_preview_url', () => {
  it('returns the URL and warns about unsaved changes', async () => {
    const ctx = await setup();
    const sessionId = await openWithHero(ctx);
    const preview = await ctx.call('get_preview_url', { sessionId, locale: 'pl' });
    expect(preview.data['url']).toBe('https://example.test/home?locale=pl');
    expect(preview.text).toContain('unsaved');
  });
});
