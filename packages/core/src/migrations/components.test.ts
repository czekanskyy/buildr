import { describe, expect, it } from 'vitest';
import type { BuilderDocument, PageNode } from '../document/types.ts';
import { s } from '../values/helpers.ts';
import type { ComponentMigrationStep, ComponentMigrations } from './components.ts';
import { migrateComponents } from './components.ts';

function pageNode(overrides: Partial<PageNode> = {}): PageNode {
  return { id: 'root', type: 'buildr/page', slots: { default: [] }, ...overrides };
}

function docWith(nodes: readonly PageNode[], components: Record<string, number>): BuilderDocument {
  return {
    schemaVersion: 1,
    root: 'root',
    nodes: Object.fromEntries(nodes.map((node) => [node.id, node])),
    components,
  };
}

function trailOf(props: PageNode['props']): readonly string[] {
  const trail = props?.trail;
  return trail?.kind === 'static' && Array.isArray(trail.value) ? (trail.value as string[]) : [];
}

function step(from: number, to: number, tag: string): ComponentMigrationStep {
  return {
    from,
    to,
    migrate: (props) => ({ ...props, trail: s([...trailOf(props), tag]) }),
  };
}

describe('migrateComponents', () => {
  it('walks a v1 -> v3 chain, applying steps in order to every node of the type', () => {
    const heading1 = pageNode({ id: 'h1', type: 'buildr/heading', props: { text: s('a') } });
    const heading2 = pageNode({ id: 'h2', type: 'buildr/heading', props: { text: s('b') } });
    const doc = docWith([heading1, heading2], { 'buildr/heading': 1 });
    const migrations: ComponentMigrations = {
      'buildr/heading': { currentVersion: 3, steps: [step(1, 2, 'v1->v2'), step(2, 3, 'v2->v3')] },
    };

    const result = migrateComponents(doc, migrations);

    expect(result.readOnlyReasons).toEqual([]);
    expect(result.diagnostics).toEqual([]);
    expect(result.applied['buildr/heading']).toEqual(migrations['buildr/heading']?.steps);
    expect(result.doc.components['buildr/heading']).toBe(3);
    expect(result.doc.nodes.h1?.props?.trail).toEqual(s(['v1->v2', 'v2->v3']));
    expect(result.doc.nodes.h2?.props?.trail).toEqual(s(['v1->v2', 'v2->v3']));
    // original untouched
    expect(doc.nodes.h1?.props?.trail).toBeUndefined();
    expect(doc.components['buildr/heading']).toBe(1);
  });

  it('is a no-op (same reference) when every type is already current', () => {
    const heading = pageNode({ id: 'h1', type: 'buildr/heading', props: { text: s('a') } });
    const doc = docWith([heading], { 'buildr/heading': 2 });
    const migrations: ComponentMigrations = {
      'buildr/heading': { currentVersion: 2, steps: [step(1, 2, 'v1->v2')] },
    };

    const result = migrateComponents(doc, migrations);

    expect(result.doc).toBe(doc);
    expect(result.applied).toEqual({});
    expect(result.readOnlyReasons).toEqual([]);
    expect(result.diagnostics).toEqual([]);
  });

  it('leaves an unknown component type untouched and reports a diagnostic', () => {
    const widget = pageNode({ id: 'w1', type: 'acme/widget', props: { foo: s('bar') } });
    const doc = docWith([widget], { 'acme/widget': 1 });

    const result = migrateComponents(doc, {});

    expect(result.doc).toBe(doc);
    expect(result.applied).toEqual({});
    expect(result.readOnlyReasons).toEqual([]);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]).toMatchObject({
      code: 'component.unknown-type',
      details: { type: 'acme/widget', storedVersion: 1 },
    });
    expect(result.doc.nodes.w1).toBe(widget);
  });

  it('marks a type read-only when its stored version is newer than the registry knows', () => {
    const heading = pageNode({ id: 'h1', type: 'buildr/heading', props: { text: s('a') } });
    const doc = docWith([heading], { 'buildr/heading': 5 });
    const migrations: ComponentMigrations = {
      'buildr/heading': { currentVersion: 3, steps: [] },
    };

    const result = migrateComponents(doc, migrations);

    expect(result.doc).toBe(doc);
    expect(result.applied).toEqual({});
    expect(result.diagnostics).toEqual([]);
    expect(result.readOnlyReasons).toHaveLength(1);
    expect(result.readOnlyReasons[0]).toMatchObject({
      code: 'component.newer-than-registry',
      details: { type: 'buildr/heading', storedVersion: 5, registryVersion: 3 },
    });
    expect(result.doc.nodes.h1).toBe(heading);
    expect(result.doc.components['buildr/heading']).toBe(5);
  });

  it('marks a type read-only when its step chain has a gap', () => {
    const heading = pageNode({ id: 'h1', type: 'buildr/heading', props: { text: s('a') } });
    const doc = docWith([heading], { 'buildr/heading': 1 });
    const migrations: ComponentMigrations = {
      'buildr/heading': { currentVersion: 3, steps: [step(1, 2, 'v1->v2')] },
    };

    const result = migrateComponents(doc, migrations);

    expect(result.readOnlyReasons).toHaveLength(1);
    expect(result.readOnlyReasons[0]).toMatchObject({ code: 'component.migration-chain-invalid' });
    expect(result.doc.nodes.h1).toBe(heading);
  });

  it("scopes a step's context to the node's own subtree", () => {
    const child = pageNode({ id: 'c1', type: 'buildr/text', props: { text: s('child') } });
    const parent = pageNode({
      id: 'p1',
      type: 'buildr/heading',
      slots: { default: ['c1'] },
      props: { text: s('parent') },
    });
    const doc = docWith([parent, child], { 'buildr/heading': 1, 'buildr/text': 1 });

    let seenIds: string[] = [];
    const migrations: ComponentMigrations = {
      'buildr/heading': {
        currentVersion: 2,
        steps: [
          {
            from: 1,
            to: 2,
            migrate: (props, ctx) => {
              seenIds = [...ctx.subtree.keys()];
              return props;
            },
          },
        ],
      },
      'buildr/text': { currentVersion: 1, steps: [] },
    };

    migrateComponents(doc, migrations);

    expect(seenIds).toEqual(['p1', 'c1']);
  });

  it('never mutates its input document', () => {
    const heading = pageNode({ id: 'h1', type: 'buildr/heading', props: { text: s('a') } });
    const doc = Object.freeze(docWith([heading], { 'buildr/heading': 1 }));
    const migrations: ComponentMigrations = {
      'buildr/heading': { currentVersion: 2, steps: [step(1, 2, 'v1->v2')] },
    };

    expect(() => migrateComponents(doc, migrations)).not.toThrow();
    expect(doc.components['buildr/heading']).toBe(1);
    expect(doc.nodes.h1?.props?.trail).toBeUndefined();
  });

  it('produces the same result on a repeated run over the same input (determinism)', () => {
    const heading = pageNode({ id: 'h1', type: 'buildr/heading', props: { text: s('a') } });
    const doc = docWith([heading], { 'buildr/heading': 1 });
    const migrations: ComponentMigrations = {
      'buildr/heading': { currentVersion: 2, steps: [step(1, 2, 'v1->v2')] },
    };

    const first = migrateComponents(doc, migrations);
    const second = migrateComponents(doc, migrations);

    expect(first).toEqual(second);
  });
});
