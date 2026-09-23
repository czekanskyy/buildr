import { describe, expect, it } from 'vitest';
import { createIndex } from '../document/document-index.ts';
import type {
  BuilderDocument,
  ComponentType,
  NodeId,
  PageNode,
  SlotName,
} from '../document/types.ts';
import type { ContentCategory } from '../registry/matchers.ts';
import type { ComponentMeta } from '../registry/meta.ts';
import { createRegistryMeta, type RegistryMeta } from '../registry/registry.ts';
import { canRemove } from './can-remove.ts';

function component(
  type: ComponentType,
  contentCategories: ContentCategory[],
  overrides: Partial<ComponentMeta> = {},
): ComponentMeta {
  return {
    type,
    version: 1,
    label: type,
    category: 'content',
    props: {},
    contentCategories,
    styles: { groups: [] },
    runtime: 'shared',
    ...overrides,
  };
}

function baseRegistry(
  overrides: Partial<Record<ComponentType, Partial<ComponentMeta>>> = {},
): RegistryMeta {
  const merge = (meta: ComponentMeta): ComponentMeta => ({ ...meta, ...overrides[meta.type] });
  return createRegistryMeta({
    components: [
      merge(
        component('buildr/page', ['flow'], {
          capabilities: { root: true },
          slots: { default: {} },
        }),
      ),
      merge(component('buildr/section', ['flow'], { slots: { default: { min: 1 } } })),
      merge(component('buildr/text', ['flow', 'phrasing'])),
    ],
  });
}

function node(
  id: NodeId,
  type: ComponentType,
  slots?: Readonly<Record<SlotName, readonly NodeId[]>>,
  extra: Partial<PageNode> = {},
): PageNode {
  return { id, type, ...(slots !== undefined ? { slots } : {}), ...extra };
}

function buildDoc(
  nodes: Record<NodeId, PageNode>,
  rootChildren: readonly NodeId[],
): BuilderDocument {
  return {
    schemaVersion: 1,
    root: 'root',
    nodes: { root: node('root', 'buildr/page', { default: rootChildren }), ...nodes },
    components: {},
  };
}

describe('canRemove', () => {
  it('allows removing an ordinary node', () => {
    const doc = buildDoc(
      {
        section: node('section', 'buildr/section', { default: ['a', 'b'] }),
        a: node('a', 'buildr/text'),
        b: node('b', 'buildr/text'),
      },
      ['section'],
    );
    const result = canRemove(doc, createIndex(doc), baseRegistry(), 'a');
    expect(result).toEqual({ ok: true, value: true });
  });

  it('rejects removing the document root', () => {
    const doc = buildDoc({}, []);
    const result = canRemove(doc, createIndex(doc), baseRegistry(), 'root');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('cannot-remove-root');
  });

  it('rejects removing a node that does not exist', () => {
    const doc = buildDoc({}, []);
    const result = canRemove(doc, createIndex(doc), baseRegistry(), 'missing');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('node-not-found');
  });

  it('rejects removing a component whose capabilities.removable is false', () => {
    const registry = baseRegistry({ 'buildr/text': { capabilities: { removable: false } } });
    const doc = buildDoc(
      {
        section: node('section', 'buildr/section', { default: ['a', 'b'] }),
        a: node('a', 'buildr/text'),
        b: node('b', 'buildr/text'),
      },
      ['section'],
    );
    const result = canRemove(doc, createIndex(doc), registry, 'a');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('not-removable');
  });

  it("rejects removing the last child when the slot's min would be violated", () => {
    const doc = buildDoc(
      {
        section: node('section', 'buildr/section', { default: ['a'] }),
        a: node('a', 'buildr/text'),
      },
      ['section'],
    );
    const result = canRemove(doc, createIndex(doc), baseRegistry(), 'a');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('slot-min-violation');
  });

  it('allows removing down to exactly the slot min', () => {
    const doc = buildDoc(
      {
        section: node('section', 'buildr/section', { default: ['a', 'b'] }),
        a: node('a', 'buildr/text'),
        b: node('b', 'buildr/text'),
      },
      ['section'],
    );
    const result = canRemove(doc, createIndex(doc), baseRegistry(), 'b');
    expect(result).toEqual({ ok: true, value: true });
  });

  it('rejects removing a node from a structurally locked parent', () => {
    const doc = buildDoc(
      {
        section: node(
          'section',
          'buildr/section',
          { default: ['a', 'b'] },
          { lock: { structure: true } },
        ),
        a: node('a', 'buildr/text'),
        b: node('b', 'buildr/text'),
      },
      ['section'],
    );
    const result = canRemove(doc, createIndex(doc), baseRegistry(), 'a');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('locked-structure');
  });

  it('allows removing from a locked parent through a region', () => {
    const doc = buildDoc(
      {
        outer: node(
          'outer',
          'buildr/section',
          { default: ['inner'] },
          { lock: { structure: true } },
        ),
        inner: node('inner', 'buildr/section', { default: ['a', 'b'] }, { region: 'freeform' }),
        a: node('a', 'buildr/text'),
        b: node('b', 'buildr/text'),
      },
      ['outer'],
    );
    const result = canRemove(doc, createIndex(doc), baseRegistry(), 'a');
    expect(result).toEqual({ ok: true, value: true });
  });
});
