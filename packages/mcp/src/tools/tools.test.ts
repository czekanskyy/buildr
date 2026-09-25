import { assertDocumentInvariants } from '@buildr/core';
import { coreCommandHandlers, createCommandRegistry } from '@buildr/core/commands';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterEach, describe, expect, it } from 'vitest';
import { createMemoryBackend } from '../backends/memory.ts';
import { loadDefaultManifest } from '../serialize/default-manifest.test-kit.ts';
import { createBuildrMcpServer } from '../server.ts';
import { createSessionStore } from '../session/index.ts';
import { createDocumentTools } from './documents.ts';
import { createEditingTools } from './editing.ts';

const clients: Client[] = [];

interface Called {
  readonly isError: boolean;
  readonly text: string;
  readonly data: Record<string, unknown>;
}

async function setup(options: { readOnly?: boolean } = {}) {
  const backend = createMemoryBackend({
    manifest: loadDefaultManifest(),
    collections: ['pages'],
    documents: [{ ref: { collection: 'pages', id: '1' }, title: 'Home', slug: 'home' }],
    session: {
      permissions: { canEdit: options.readOnly !== true },
      locales: {
        locales: ['en', 'pl'],
        default: 'en',
        fallback: true,
        intl: { en: 'en-US', pl: 'pl-PL' },
      },
    },
  });
  const store = createSessionStore({ backend });
  const tools = [...createDocumentTools({ store }), ...createEditingTools({ store })];
  const server = createBuildrMcpServer({ backend, options: { tools } });
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
  return { backend, store, client, call, tools };
}

afterEach(async () => {
  await Promise.all(clients.splice(0).map((client) => client.close()));
});

/** The id of the first outline line of `type`. */
function idOf(outline: string, type: string, nth = 0): string {
  const ids = outline
    .split('\n')
    .map((line) => line.trim().split(' '))
    .filter((parts) => parts[1] === type)
    .map((parts) => parts[0] ?? '');
  const id = ids[nth];
  if (id === undefined) throw new Error(`no ${type} #${nth} in outline:\n${outline}`);
  return id;
}

describe('tool surface', () => {
  it('lists the document and editing tools with annotations', async () => {
    const { client } = await setup();
    const listed = (await client.listTools()).tools;
    expect(listed.map((t) => t.name).sort()).toEqual(
      [
        'apply_commands',
        'close_document',
        'create_document',
        'duplicate_nodes',
        'get_node',
        'get_outline',
        'insert_nodes',
        'list_documents',
        'move_nodes',
        'open_document',
        'redo',
        'remove_nodes',
        'undo',
        'unwrap_node',
        'update_node',
        'wrap_nodes',
      ].sort(),
    );
    const byName = new Map(listed.map((t) => [t.name, t]));
    expect(byName.get('remove_nodes')?.annotations?.destructiveHint).toBe(true);
    expect(byName.get('update_node')?.annotations?.idempotentHint).toBe(true);
    expect(byName.get('get_outline')?.annotations?.readOnlyHint).toBe(true);
    expect(byName.get('insert_nodes')?.inputSchema).toMatchObject({ required: ['sessionId'] });
  });
});

describe('scenario 1: a landing page built purely through tools', () => {
  it('builds Hero + FeatureGrid + CTA, edits text and translates it', async () => {
    const { call, store } = await setup();

    const listed = await call('list_documents', { collection: 'pages' });
    expect(listed.text).toContain('pages/1 "Home"');

    const created = await call('create_document', {
      collection: 'pages',
      title: 'Landing',
      slug: 'landing',
    });
    expect(created.isError).toBe(false);
    const sessionId = created.data['sessionId'] as string;
    expect(created.data['layoutSource']).toBe('builtin');
    expect(created.data['dirty']).toBe(false);

    for (const template of ['buildr/hero', 'buildr/feature-grid', 'buildr/cta']) {
      const inserted = await call('insert_nodes', { sessionId, template });
      expect(inserted.isError, inserted.text).toBe(false);
      expect((inserted.data['newIds'] as string[]).length).toBeGreaterThan(1);
      expect(inserted.text).toContain(`${template}`);
    }

    const outline = await call('get_outline', { sessionId, depth: 6 });
    const headingId = idOf(outline.text, 'buildr/heading');
    expect(outline.text).toContain('A headline that says what you do');

    const updated = await call('update_node', {
      sessionId,
      nodeId: headingId,
      props: { text: 'Build pages with agents' },
    });
    expect(updated.isError, updated.text).toBe(false);

    const translated = await call('update_node', {
      sessionId,
      nodeId: headingId,
      props: { text: 'Buduj strony z agentami' },
      locale: 'pl',
    });
    expect(translated.isError, translated.text).toBe(false);

    const session = await store.get(sessionId);
    if (!session.ok) throw new Error('session lost');
    const node = session.value.doc.nodes[headingId];
    expect(node?.props?.['text']).toEqual({
      kind: 'static',
      value: 'Build pages with agents',
      l10n: { pl: 'Buduj strony z agentami' },
    });
    assertDocumentInvariants(session.value.doc);

    // A style edit on a breakpoint and an attribute in the same atomic step.
    const styled = await call('update_node', {
      sessionId,
      nodeId: headingId,
      styles: [{ group: 'typography', property: 'fontSize', value: '$fontSize.3xl', bp: 'mobile' }],
      attributes: { name: 'Main headline', anchor: 'top' },
    });
    expect(styled.isError, styled.text).toBe(false);
    const detail = await call('get_node', { sessionId, nodeId: headingId });
    expect(detail.text).toContain('anchor: top');
    expect(detail.text).toContain('Main headline');

    const sections = (await call('get_outline', { sessionId, depth: 1 })).text;
    expect(sections.match(/buildr\/section/g)?.length).toBe(3);
    expect(sessions(store)).toBe(1);
  });
});

function sessions(store: ReturnType<typeof createSessionStore>): number {
  return store.size;
}

describe('rejections leave the document untouched', () => {
  it('explains a forbidden insert and changes nothing', async () => {
    const { call, store } = await setup();
    const created = await call('create_document', {
      collection: 'pages',
      title: 'Locked',
      template: 'buildr/hero',
    });
    const sessionId = created.data['sessionId'] as string;
    const outline = (await call('get_outline', { sessionId, depth: 6 })).text;
    const stack = idOf(outline, 'buildr/stack');
    const live = await store.get(sessionId);
    if (!live.ok) throw new Error('no session');
    const before = live.value.doc;

    const forbidden = await call('insert_nodes', {
      sessionId,
      parentId: stack,
      tree: { type: 'buildr/text', props: { text: 'extra' } },
    });
    expect(forbidden.isError).toBe(true);
    expect(forbidden.text).toMatch(/lock|structure/i);
    expect(live.value.doc).toBe(before);

    const removal = await call('remove_nodes', {
      sessionId,
      nodeIds: [idOf(outline, 'buildr/heading')],
    });
    expect(removal.isError).toBe(true);
    expect(live.value.doc).toBe(before);

    // A content edit of a structure-locked template stays possible.
    const edit = await call('update_node', {
      sessionId,
      nodeId: idOf(outline, 'buildr/heading'),
      props: { text: 'Still editable' },
    });
    expect(edit.isError, edit.text).toBe(false);
  });

  it('reports every issue of an invalid tree with alternatives, and points lone list items to their parent', async () => {
    const { call } = await setup();
    const { data } = await call('create_document', { collection: 'pages', title: 'T' });
    const sessionId = data['sessionId'] as string;

    const bad = await call('insert_nodes', {
      sessionId,
      tree: { type: 'buildr/headng', props: { txt: 'x' } },
    });
    expect(bad.isError).toBe(true);
    expect(bad.text).toContain('buildr/heading');

    const lone = await call('insert_nodes', { sessionId, tree: { type: 'buildr/list-item' } });
    expect(lone.isError).toBe(true);
    expect(lone.text).toContain('parent');
    expect(lone.text).toContain('duplicate_nodes');

    const both = await call('insert_nodes', {
      sessionId,
      template: 'buildr/hero',
      tree: { type: 'buildr/text' },
    });
    expect(both.isError).toBe(true);
    const missing = await call('insert_nodes', { sessionId, template: 'buildr/nope' });
    expect(missing.text).toContain('buildr/hero');
  });

  it('refuses everything on a read-only document and an unknown session', async () => {
    const { call } = await setup({ readOnly: true });
    const opened = await call('open_document', { collection: 'pages', id: '1' });
    expect(opened.isError).toBe(false);
    expect(opened.text).toContain('read-only');
    const sessionId = opened.data['sessionId'] as string;
    const insert = await call('insert_nodes', { sessionId, tree: { type: 'buildr/text' } });
    expect(insert.isError).toBe(true);
    const gone = await call('get_outline', { sessionId: 's_unknown' });
    expect(gone.isError).toBe(true);
    expect(gone.text).toContain('open');
  });
});

describe('undo, redo, close', () => {
  it('undoes and redoes one tool call as one step and guards unsaved closes', async () => {
    const { call } = await setup();
    const { data } = await call('create_document', { collection: 'pages', title: 'U' });
    const sessionId = data['sessionId'] as string;
    await call('insert_nodes', {
      sessionId,
      tree: { type: 'buildr/section', children: [{ type: 'buildr/heading' }] },
    });
    expect((await call('undo', { sessionId })).isError).toBe(false);
    expect((await call('get_outline', { sessionId })).text).not.toContain('buildr/section');
    expect((await call('redo', { sessionId })).isError).toBe(false);
    expect((await call('get_outline', { sessionId })).text).toContain('buildr/section');
    expect((await call('redo', { sessionId })).isError).toBe(true);

    const refused = await call('close_document', { sessionId });
    expect(refused.isError).toBe(true);
    expect(refused.text).toMatch(/unsaved/i);
    const closed = await call('close_document', { sessionId, discard: true });
    expect(closed.isError).toBe(false);
  });
});

describe('every command type is reachable', () => {
  it('runs each core command through apply_commands', async () => {
    const { call, store } = await setup();
    const { data } = await call('create_document', { collection: 'pages', title: 'All' });
    const sessionId = data['sessionId'] as string;
    const live = await store.get(sessionId);
    if (!live.ok) throw new Error('no session');
    const session = live.value;
    const root = session.doc.root;

    const seen = new Set<string>();
    const run = async (commands: { type: string; payload: unknown }[]) => {
      const result = await call('apply_commands', { sessionId, commands });
      expect(result.isError, result.text).toBe(false);
      for (const c of commands) seen.add(c.type);
      assertDocumentInvariants(session.doc);
      return result;
    };
    const fragment = (id: string, type: string, extra: Record<string, unknown> = {}) => ({
      format: 'buildr/fragment',
      schemaVersion: 1,
      components: { [type]: 1 },
      roots: [id],
      nodes: { [id]: { id, type, ...extra } },
    });

    await run([
      {
        type: 'node.insert',
        payload: {
          parentId: root,
          slot: 'default',
          index: 0,
          fragment: fragment('aaaaaaaa01', 'buildr/heading'),
        },
      },
    ]);
    await run([
      {
        type: 'node.insert',
        payload: {
          parentId: root,
          slot: 'default',
          index: 1,
          fragment: fragment('aaaaaaaa02', 'buildr/stack'),
        },
      },
    ]);
    await run([
      {
        type: 'node.setProp',
        payload: { id: 'aaaaaaaa01', prop: 'text', value: { kind: 'static', value: 'Hi' } },
      },
      {
        type: 'node.setProp',
        payload: {
          id: 'aaaaaaaa01',
          prop: 'text',
          locale: 'pl',
          value: { kind: 'static', value: 'Cześć' },
        },
      },
      { type: 'node.unsetProp', payload: { id: 'aaaaaaaa01', prop: 'text', locale: 'pl' } },
      {
        type: 'node.setStyle',
        payload: {
          id: 'aaaaaaaa01',
          layer: {},
          group: 'spacing',
          property: 'padding',
          side: 'top',
          value: '$space.4',
        },
      },
      {
        type: 'node.unsetStyle',
        payload: {
          id: 'aaaaaaaa01',
          layer: {},
          group: 'spacing',
          property: 'padding',
          side: 'top',
        },
      },
      {
        type: 'node.setStyle',
        payload: {
          id: 'aaaaaaaa01',
          layer: { state: 'hover' },
          group: 'effects',
          property: 'opacity',
          value: 0.8,
        },
      },
      { type: 'node.resetStyles', payload: { id: 'aaaaaaaa01' } },
      { type: 'node.setAttr', payload: { id: 'aaaaaaaa01', key: 'name', value: 'Title' } },
      { type: 'node.unsetProp', payload: { id: 'aaaaaaaa01', prop: 'text' } },
    ]);
    await run([
      {
        type: 'node.move',
        payload: { ids: ['aaaaaaaa01'], parentId: 'aaaaaaaa02', slot: 'default', index: 0 },
      },
    ]);
    await run([{ type: 'node.duplicate', payload: { ids: ['aaaaaaaa01'] } }]);
    await run([
      { type: 'node.wrap', payload: { ids: ['aaaaaaaa02'], wrapper: { type: 'buildr/section' } } },
    ]);
    const wrapper = session.doc.nodes[session.doc.root]?.slots?.['default']?.[0] as string;
    await run([{ type: 'node.unwrap', payload: { id: wrapper } }]);
    await run([{ type: 'node.remove', payload: { ids: ['aaaaaaaa02'] } }]);

    expect([...seen].sort()).toEqual([...createCommandRegistry(coreCommandHandlers).types].sort());

    const replace = await call('apply_commands', {
      sessionId,
      commands: [{ type: 'doc.replace', payload: {} }],
    });
    expect(replace.isError).toBe(true);
    const unknown = await call('apply_commands', {
      sessionId,
      commands: [{ type: 'node.explode', payload: {} }],
    });
    expect(unknown.isError).toBe(true);
    // An atomic batch: the second command fails, so the first is not applied.
    const before = session.doc;
    const partial = await call('apply_commands', {
      sessionId,
      commands: [
        { type: 'node.setAttr', payload: { id: root, key: 'name', value: 'x' } },
        { type: 'node.remove', payload: { ids: ['nope'] } },
      ],
    });
    expect(partial.isError).toBe(true);
    expect(partial.text).toContain('Command 2');
    expect(session.doc).toBe(before);
  });
});

// A small seeded generator (mulberry32) so failures reproduce.
function rng(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('no tool can produce an invalid document', () => {
  it.each([1, 2, 3])('survives random and hostile inputs (seed %i)', async (seed) => {
    const { call, store } = await setup();
    const created = await call('create_document', { collection: 'pages', title: 'Fuzz' });
    const sessionId = created.data['sessionId'] as string;
    const live = await store.get(sessionId);
    if (!live.ok) throw new Error('no session');
    const session = live.value;
    const random = rng(seed);
    const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)] as T;

    const types = [
      'buildr/section',
      'buildr/stack',
      'buildr/grid',
      'buildr/heading',
      'buildr/text',
      'buildr/list',
      'buildr/list-item',
      'buildr/accordion',
      'buildr/card',
      'buildr/button',
      'buildr/page',
      'buildr/nope',
    ];
    const hostile = [
      '__proto__',
      'constructor',
      'toString',
      '',
      ' ',
      'a'.repeat(300),
      '../x',
      '\u0000',
      'root',
    ];
    const values: unknown[] = [
      'text',
      42,
      null,
      true,
      [],
      {},
      { kind: 'binding', path: '' },
      { kind: 'expression', expr: '((' },
      { kind: 'static' },
      { kind: 'static', value: { deep: [1] } },
      'x'.repeat(5000),
    ];
    const realIds = () => Object.keys(session.doc.nodes);
    const anyId = () => (random() < 0.1 ? pick(hostile) : pick(realIds()));
    const tree = (depth = 0): Record<string, unknown> => ({
      type: pick(types),
      ...(random() < 0.5
        ? { props: { [pick(['text', 'level', 'label', '__proto__', 'href'])]: pick(values) } }
        : {}),
      ...(depth < 3 && random() < 0.6
        ? { children: Array.from({ length: Math.floor(random() * 3) }, () => tree(depth + 1)) }
        : {}),
    });
    const position = () =>
      random() < 0.5
        ? {
            parentId: anyId(),
            slot: random() < 0.8 ? 'default' : pick(['nope', ...hostile]),
            index: pick([0, 0, 1, 2, 999]),
          }
        : { after: anyId() };

    await call('insert_nodes', {
      sessionId,
      tree: {
        type: 'buildr/section',
        children: [
          { type: 'buildr/stack', children: [{ type: 'buildr/heading' }, { type: 'buildr/text' }] },
        ],
      },
    });
    await call('insert_nodes', { sessionId, template: 'buildr/faq' });
    let accepted = 0;
    for (let step = 0; step < 150; step++) {
      const before = session.doc;
      let result: Called;
      switch (Math.floor(random() * 10)) {
        case 0:
          result = await call('insert_nodes', { sessionId, tree: tree(), ...position() });
          break;
        case 1:
          result = await call('insert_nodes', {
            sessionId,
            template: pick(['buildr/hero', 'buildr/faq', 'buildr/cta', 'nope']),
            ...position(),
          });
          break;
        case 2:
          result = await call('update_node', {
            sessionId,
            nodeId: anyId(),
            props: { [pick(['text', 'level', 'label', 'container', '__proto__'])]: pick(values) },
            ...(random() < 0.3 ? { locale: pick(['pl', 'en', 'xx', '']) } : {}),
            ...(random() < 0.3
              ? {
                  styles: [
                    {
                      group: pick(['spacing', 'typography', 'nope']),
                      property: pick(['padding', 'fontSize', 'x']),
                      value: pick(['$space.4', 'javascript:alert(1)', 12, '</style>']),
                      bp: pick(['mobile', 'tablet', 'zz']),
                    },
                  ],
                }
              : {}),
            ...(random() < 0.3
              ? {
                  attributes: {
                    name: pick(['n', null, 'y'.repeat(200)]),
                    anchor: pick(['top', 'has space', null, 'top']),
                  },
                }
              : {}),
          });
          break;
        case 3:
          result = await call('move_nodes', {
            sessionId,
            nodeIds: [anyId(), anyId()],
            ...position(),
          });
          break;
        case 4:
          result = await call('remove_nodes', { sessionId, nodeIds: [anyId()] });
          break;
        case 5:
          result = await call('duplicate_nodes', { sessionId, nodeIds: [anyId()] });
          break;
        case 6:
          result = await call('wrap_nodes', {
            sessionId,
            nodeIds: [anyId()],
            wrapper: { type: pick(types) },
          });
          break;
        case 7:
          result = await call('unwrap_node', { sessionId, nodeId: anyId() });
          break;
        case 8:
          result = await call(pick(['undo', 'redo']), { sessionId });
          break;
        default:
          result = await call('apply_commands', {
            sessionId,
            commands: [
              {
                type: pick([
                  'node.remove',
                  'node.move',
                  'node.setAttr',
                  'node.unwrap',
                  'doc.replace',
                ]),
                payload: {
                  id: anyId(),
                  ids: [anyId()],
                  parentId: anyId(),
                  slot: 'default',
                  index: -1,
                  key: 'lock',
                  value: pick(values),
                },
              },
            ],
          });
      }
      if (process.env['FUZZ_DEBUG'])
        console.log(
          step,
          result.isError,
          result.text.slice(0, 110).replaceAll(String.fromCharCode(10), ' '),
        );
      expect(result.text).not.toContain('failed unexpectedly');
      if (result.isError)
        expect(session.doc, `rejected step ${step} must not change the document`).toBe(before);
      else accepted++;
      assertDocumentInvariants(session.doc);
    }
    expect(accepted).toBeGreaterThan(5);
  });
});
