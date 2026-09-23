import { describe, expect, it } from 'vitest';
import { createIndex } from '../document/document-index.ts';
import { checkInvariants } from '../document/invariants.ts';
import type { ComponentType, PageNode } from '../document/types.ts';
import { createSeededIdGenerator } from '../ids/index.ts';
import type { ContentCategory } from '../registry/matchers.ts';
import type { ComponentMeta } from '../registry/meta.ts';
import {
  createRegistryMeta,
  type RegistryMeta,
  type TemplateDefinition,
} from '../registry/registry.ts';
import { canInsert } from '../rules/can-insert.ts';
import { instantiateTemplate } from './instantiate.ts';

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

function registry(): RegistryMeta {
  return createRegistryMeta({
    components: [
      component('buildr/page', ['flow'], { capabilities: { root: true }, slots: { default: {} } }),
      component('buildr/section', ['flow'], { slots: { default: {}, actions: {} } }),
      component('buildr/heading', ['flow', 'heading']),
      component('buildr/button', ['flow', 'phrasing', 'interactive']),
    ],
  });
}

function hero(overrides: Partial<TemplateDefinition> = {}): TemplateDefinition {
  return {
    id: 'buildr/hero',
    version: 1,
    label: 'Hero',
    category: 'sections',
    lock: 'none',
    tree: {
      type: 'buildr/section',
      children: [{ type: 'buildr/heading' }],
    },
    ...overrides,
  };
}

describe('instantiateTemplate', () => {
  it('mints fresh ids on every call', () => {
    const def = hero();
    const first = instantiateTemplate(def);
    const second = instantiateTemplate(def);

    expect(Object.keys(first.nodes)).toHaveLength(2);
    expect(new Set([...Object.keys(first.nodes), ...Object.keys(second.nodes)]).size).toBe(4);
  });

  it('sets source and no lock on the root when lock is "none"', () => {
    const fragment = instantiateTemplate(hero(), undefined, createSeededIdGenerator('pb-018/none'));
    const rootId = fragment.roots[0];
    if (!rootId) throw new Error('fixture produced no root');
    const root = fragment.nodes[rootId];

    expect(root?.source).toEqual({ template: 'buildr/hero', version: 1 });
    expect(root?.lock).toBeUndefined();
  });

  it('sets lock.structure on the root when lock is "structure"', () => {
    const fragment = instantiateTemplate(
      hero({ lock: 'structure' }),
      undefined,
      createSeededIdGenerator('pb-018/structure'),
    );
    const rootId = fragment.roots[0];
    if (!rootId) throw new Error('fixture produced no root');

    expect(fragment.nodes[rootId]?.lock).toEqual({ structure: true });
  });

  it('merges lock.structure with a lock already declared on the tree root', () => {
    const def = hero({
      lock: 'structure',
      tree: {
        type: 'buildr/section',
        lock: { content: true },
        children: [{ type: 'buildr/heading' }],
      },
    });
    const fragment = instantiateTemplate(def, undefined, createSeededIdGenerator('pb-018/merge'));
    const rootId = fragment.roots[0];
    if (!rootId) throw new Error('fixture produced no root');

    expect(fragment.nodes[rootId]?.lock).toEqual({ content: true, structure: true });
  });

  it('instantiates a named variant instead of the default tree', () => {
    const def = hero({
      variants: { compact: { type: 'buildr/section', name: 'Compact' } },
    });
    const fragment = instantiateTemplate(def, 'compact', createSeededIdGenerator('pb-018/variant'));
    const rootId = fragment.roots[0];
    if (!rootId) throw new Error('fixture produced no root');

    expect(Object.keys(fragment.nodes)).toHaveLength(1);
    expect(fragment.nodes[rootId]?.name).toBe('Compact');
  });

  it('throws for an unknown variant', () => {
    expect(() => instantiateTemplate(hero(), 'missing')).toThrow(/has no variant "missing"/);
  });

  it('produces a fragment that satisfies checkInvariants and canInsert once inserted', () => {
    const fragment = instantiateTemplate(
      hero(),
      undefined,
      createSeededIdGenerator('pb-018/insert'),
    );
    const rootId = fragment.roots[0];
    if (!rootId) throw new Error('fixture produced no root');

    const nodes: Record<string, PageNode> = {
      root: { id: 'root', type: 'buildr/page', slots: { default: [rootId] } },
      ...fragment.nodes,
    };
    const doc = {
      schemaVersion: 1 as const,
      root: 'root' as const,
      nodes,
      components: fragment.components,
    };

    expect(checkInvariants(doc)).toEqual([]);

    // Re-derive what canInsert would have said before the fragment was spliced in.
    const before = { ...doc, nodes: { root: { id: 'root', type: 'buildr/page' } } };
    const verdict = canInsert(
      before,
      createIndex(before),
      registry(),
      { parentId: 'root', slot: 'default' },
      fragment,
    );
    expect(verdict.ok).toBe(true);
  });
});
