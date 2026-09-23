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
import type { InsertTarget } from './can-insert.ts';
import { canMove } from './can-move.ts';

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
      merge(component('buildr/section', ['flow'], { slots: { default: { max: 2 } } })),
      merge(component('buildr/stack', ['flow'], { slots: { default: {} } })),
      merge(component('buildr/text', ['flow', 'phrasing'])),
      merge(component('buildr/button', ['flow', 'phrasing', 'interactive'])),
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

function target(parentId: NodeId, slot: SlotName): InsertTarget {
  return { parentId, slot };
}

describe('canMove', () => {
  it('allows moving a node into another slot', () => {
    const doc = buildDoc(
      {
        sectionA: node('sectionA', 'buildr/section', { default: ['text'] }),
        sectionB: node('sectionB', 'buildr/section', { default: [] }),
        text: node('text', 'buildr/text'),
      },
      ['sectionA', 'sectionB'],
    );
    const result = canMove(
      doc,
      createIndex(doc),
      baseRegistry(),
      'text',
      target('sectionB', 'default'),
    );
    expect(result).toEqual({ ok: true, value: true });
  });

  it('excludes the moved node from its own destination slot when reordering in place', () => {
    const doc = buildDoc(
      {
        section: node('section', 'buildr/section', { default: ['a', 'b'] }),
        a: node('a', 'buildr/text'),
        b: node('b', 'buildr/text'),
      },
      ['section'],
    );
    // section.default's max is 2 and already holds exactly "a" and "b" — moving "a" back into
    // the same slot must not count it twice against that max.
    const result = canMove(
      doc,
      createIndex(doc),
      baseRegistry(),
      'a',
      target('section', 'default'),
    );
    expect(result).toEqual({ ok: true, value: true });
  });

  it('still enforces the destination slot max for a move to a different slot', () => {
    const doc = buildDoc(
      {
        sectionA: node('sectionA', 'buildr/section', { default: ['x'] }),
        sectionB: node('sectionB', 'buildr/section', { default: ['y', 'z'] }),
        x: node('x', 'buildr/text'),
        y: node('y', 'buildr/text'),
        z: node('z', 'buildr/text'),
      },
      ['sectionA', 'sectionB'],
    );
    const result = canMove(
      doc,
      createIndex(doc),
      baseRegistry(),
      'x',
      target('sectionB', 'default'),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('slot-max-exceeded');
  });

  it('rejects moving the document root', () => {
    const doc = buildDoc({ section: node('section', 'buildr/section', { default: [] }) }, [
      'section',
    ]);
    const result = canMove(
      doc,
      createIndex(doc),
      baseRegistry(),
      'root',
      target('section', 'default'),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('cannot-move-root');
  });

  it('rejects moving a node that does not exist', () => {
    const doc = buildDoc({ section: node('section', 'buildr/section', { default: [] }) }, [
      'section',
    ]);
    const result = canMove(
      doc,
      createIndex(doc),
      baseRegistry(),
      'missing',
      target('section', 'default'),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('node-not-found');
  });

  it('rejects moving a node into its own subtree', () => {
    const doc = buildDoc(
      {
        stack: node('stack', 'buildr/stack', { default: ['inner'] }),
        inner: node('inner', 'buildr/section', { default: [] }),
      },
      ['stack'],
    );
    const result = canMove(
      doc,
      createIndex(doc),
      baseRegistry(),
      'stack',
      target('inner', 'default'),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('cycle');
  });

  it('rejects moving a node onto itself', () => {
    const doc = buildDoc({ stack: node('stack', 'buildr/stack', { default: [] }) }, ['stack']);
    const result = canMove(
      doc,
      createIndex(doc),
      baseRegistry(),
      'stack',
      target('stack', 'default'),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('cycle');
  });

  it('rejects moving a component whose capabilities.draggable is false', () => {
    const registry = baseRegistry({ 'buildr/text': { capabilities: { draggable: false } } });
    const doc = buildDoc(
      {
        section: node('section', 'buildr/section', { default: ['text'] }),
        text: node('text', 'buildr/text'),
      },
      ['section'],
    );
    const result = canMove(doc, createIndex(doc), registry, 'text', target('section', 'default'));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('not-draggable');
  });

  it('rejects moving out of a structurally locked source', () => {
    const doc = buildDoc(
      {
        sectionA: node(
          'sectionA',
          'buildr/section',
          { default: ['text'] },
          { lock: { structure: true } },
        ),
        sectionB: node('sectionB', 'buildr/section', { default: [] }),
        text: node('text', 'buildr/text'),
      },
      ['sectionA', 'sectionB'],
    );
    const result = canMove(
      doc,
      createIndex(doc),
      baseRegistry(),
      'text',
      target('sectionB', 'default'),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('locked-structure');
  });

  it('allows moving out of a locked source through a region', () => {
    const doc = buildDoc(
      {
        sectionA: node(
          'sectionA',
          'buildr/section',
          { default: ['stack'] },
          { lock: { structure: true } },
        ),
        stack: node('stack', 'buildr/stack', { default: ['text'] }, { region: 'freeform' }),
        sectionB: node('sectionB', 'buildr/section', { default: [] }),
        text: node('text', 'buildr/text'),
      },
      ['sectionA', 'sectionB'],
    );
    const result = canMove(
      doc,
      createIndex(doc),
      baseRegistry(),
      'text',
      target('sectionB', 'default'),
    );
    expect(result).toEqual({ ok: true, value: true });
  });

  it('rejects moving into a structurally locked destination', () => {
    const doc = buildDoc(
      {
        sectionA: node('sectionA', 'buildr/section', { default: ['text'] }),
        sectionB: node(
          'sectionB',
          'buildr/section',
          { default: [] },
          { lock: { structure: true } },
        ),
        text: node('text', 'buildr/text'),
      },
      ['sectionA', 'sectionB'],
    );
    const result = canMove(
      doc,
      createIndex(doc),
      baseRegistry(),
      'text',
      target('sectionB', 'default'),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('locked-structure');
  });

  it('delegates destination slot checks to the same logic canInsert uses', () => {
    const doc = buildDoc(
      {
        sectionA: node('sectionA', 'buildr/section', { default: ['text', 'button'] }),
        text: node('text', 'buildr/text'),
        button: node('button', 'buildr/button'),
      },
      ['sectionA'],
    );
    // "button" is a leaf with no slots at all — moving "text" into it fails the same
    // `slot-not-found` check `canInsert` would apply to a fresh insertion.
    const result = canMove(
      doc,
      createIndex(doc),
      baseRegistry(),
      'text',
      target('button', 'default'),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('slot-not-found');
  });
});
