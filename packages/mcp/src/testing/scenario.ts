import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { expect } from 'vitest';
import type { DocumentRef } from '../backend.ts';

/** The part of an SDK `Client` the scenario needs, so any transport (stdio, Streamable HTTP, in-memory) works. */
export type ScenarioClient = Pick<Client, 'callTool' | 'listTools'>;

export interface ToolScenarioOptions {
  /** The builder collection to create the draft in (default `pages`). */
  readonly collection?: string;
  readonly title?: string;
  /** The tree to insert: `{ type, props?, children? }` in the agent format. Default: a section with a heading. */
  readonly tree?: Record<string, unknown>;
  /** The component type that must show up in the outline after the insert (default: the type of `tree`). */
  readonly expectType?: string;
  /** A text the outline must contain after the insert (default: the heading text of the default tree). */
  readonly expectText?: string;
}

export interface ToolScenarioResult {
  /** The document the scenario created and saved. */
  readonly ref: DocumentRef;
  /** The revision after the save. */
  readonly revision: number;
}

interface Called {
  readonly isError: boolean;
  readonly text: string;
  readonly data: Record<string, unknown>;
}

async function call(
  client: ScenarioClient,
  name: string,
  args: Record<string, unknown>,
): Promise<Called> {
  const result = await client.callTool({ name, arguments: args });
  const content = (result.content ?? []) as { type: string; text?: string }[];
  return {
    isError: result.isError === true,
    text: content.map((part) => part.text ?? '').join('\n'),
    data: (result.structuredContent ?? {}) as Record<string, unknown>,
  };
}

const DEFAULT_TREE = {
  type: 'buildr/section',
  children: [{ type: 'buildr/heading', props: { text: 'Built by an agent' } }],
};

/** Tools every server must list, whatever the transport. */
export const CORE_TOOL_NAMES: readonly string[] = [
  'list_documents',
  'create_document',
  'open_document',
  'insert_nodes',
  'update_node',
  'get_outline',
  'validate',
  'save',
  'close_document',
];

/**
 * The transport-independent scenario of the phase-14 acceptance criterion ("the same tool suite
 * passes over stdio and over HTTP", PB-142, PB-145): the tools are listed, a draft is created, a
 * tree is inserted, the outline shows it, the draft is validated and saved, reopened from the
 * backend and closed. Run it with a connected `Client`, over whichever transport; it calls vitest's
 * `expect`, so call it from inside a test. Returns the saved document so the caller can also check
 * the backend directly.
 */
export async function runToolScenario(
  client: ScenarioClient,
  options: ToolScenarioOptions = {},
): Promise<ToolScenarioResult> {
  const collection = options.collection ?? 'pages';
  const tree = options.tree ?? DEFAULT_TREE;
  const expectType = options.expectType ?? String(tree['type']);
  const expectText =
    options.expectText ?? (options.tree === undefined ? 'Built by an agent' : undefined);

  const names = (await client.listTools()).tools.map((tool) => tool.name);
  for (const name of CORE_TOOL_NAMES) expect(names, `tool ${name}`).toContain(name);

  const created = await call(client, 'create_document', {
    collection,
    title: options.title ?? 'Scenario page',
  });
  expect(created.isError, created.text).toBe(false);
  const sessionId = created.data['sessionId'] as string;
  expect(typeof sessionId).toBe('string');

  const inserted = await call(client, 'insert_nodes', { sessionId, tree });
  expect(inserted.isError, inserted.text).toBe(false);
  expect((inserted.data['newIds'] as string[]).length).toBeGreaterThan(0);

  const outline = await call(client, 'get_outline', { sessionId, depth: 6 });
  expect(outline.text).toContain(expectType);
  if (expectText !== undefined) expect(outline.text).toContain(expectText);

  const validated = await call(client, 'validate', { sessionId });
  expect(validated.isError, validated.text).toBe(false);

  const saved = await call(client, 'save', { sessionId });
  expect(saved.isError, saved.text).toBe(false);
  expect(saved.data['saved']).toBe(true);
  const revision = saved.data['revision'] as number;

  const closed = await call(client, 'close_document', { sessionId });
  expect(closed.isError, closed.text).toBe(false);

  // The save reached the backend: a fresh session on the same document sees the tree.
  const found = created.data['ref'] as DocumentRef;
  const reopened = await call(client, 'open_document', {
    collection: found.collection,
    id: found.id,
  });
  expect(reopened.isError, reopened.text).toBe(false);
  const again = await call(client, 'get_outline', {
    sessionId: reopened.data['sessionId'],
    depth: 6,
  });
  expect(again.text).toContain(expectType);
  await call(client, 'close_document', { sessionId: reopened.data['sessionId'] });
  return { ref: found, revision };
}
