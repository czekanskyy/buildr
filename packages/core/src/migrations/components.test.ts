import { describe, expect, it } from 'vitest';
import type { BuilderFragment } from '../document/fragment.ts';
import type { BuilderDocument, PageNode } from '../document/types.ts';
import { s } from '../values/helpers.ts';
import type { ComponentMigrationStep, ComponentMigrations } from './components.ts';
import { migrateComponents, migrateFragment } from './components.ts';

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

describe('component replacements', () => {
  // Made-up types: `acme/box` (v1 -> v2 adds display) replaces `acme/column` (retired at v1).
  const boxStep: ComponentMigrationStep = {
    from: 1,
    to: 2,
    migrate: (props) => ({ ...props, display: s('block') }),
  };
  const migrations: ComponentMigrations = {
    'acme/box': {
      currentVersion: 2,
      steps: [boxStep],
      replaces: {
        'acme/column': {
          fromVersion: 1,
          toVersion: 2,
          migrate: ({ props, styles }) => ({
            props: { ...props, display: s('flex') },
            styles: { ...styles, base: { ...styles?.base } },
          }),
        },
      },
    },
    'acme/other': { currentVersion: 2, steps: [step(1, 2, 'o')] },
  };

  const box = pageNode({ id: 'b1', type: 'acme/box', props: { as: s('div') } });
  const column = pageNode({
    id: 'c1',
    type: 'acme/column',
    props: { label: s('x') },
    slots: { default: ['b1'] },
    anchor: 'keep',
    lock: { content: true },
  });

  it('migrates box (v1 -> block) and column (-> flex, skipping box v1->v2) together', () => {
    const doc = docWith([column, box], { 'acme/box': 1, 'acme/column': 1 });

    const result = migrateComponents(doc, migrations);

    expect(result.readOnlyReasons).toEqual([]);
    expect(result.diagnostics).toEqual([]);
    expect(result.doc.components).toEqual({ 'acme/box': 2 });
    expect(result.doc.nodes.b1?.props?.display).toEqual(s('block'));
    expect(result.doc.nodes.c1).toMatchObject({
      id: 'c1',
      type: 'acme/box',
      props: { label: s('x'), display: s('flex') },
      slots: { default: ['b1'] },
      anchor: 'keep',
      lock: { content: true },
    });
    expect(result.applied['acme/box']).toEqual([boxStep]);
    expect(result.applied['acme/column']).toEqual([]);
  });

  it('blocks the whole group when box is newer than the registry', () => {
    const doc = docWith([column, box], { 'acme/box': 3, 'acme/column': 1 });

    const result = migrateComponents(doc, migrations);

    expect(result.doc).toBe(doc);
    expect(result.readOnlyReasons.map((r) => r.code)).toEqual(['component.newer-than-registry']);
  });

  it('finds a retired type missing from components and treats it as fromVersion', () => {
    const doc = docWith([column, box], { 'acme/box': 1 });

    const result = migrateComponents(doc, migrations);

    expect(result.readOnlyReasons).toEqual([]);
    expect(result.diagnostics).toEqual([]);
    expect(result.doc.nodes.c1?.type).toBe('acme/box');
    expect(result.doc.components).toEqual({ 'acme/box': 2 });
  });

  it('blocks the group with a reason when the retired type is stored at another version', () => {
    const doc = docWith([column, box], { 'acme/box': 1, 'acme/column': 2 });

    const result = migrateComponents(doc, migrations);

    expect(result.doc).toBe(doc);
    expect(result.diagnostics).toEqual([]);
    expect(result.readOnlyReasons).toHaveLength(1);
    expect(result.readOnlyReasons[0]).toMatchObject({
      code: 'component.replacement-version-mismatch',
      details: { type: 'acme/column', storedVersion: 2, expectedVersion: 1 },
    });
    expect(result.doc.nodes.b1).toBe(box);
  });

  it('still migrates an unrelated type while a group is blocked', () => {
    const other = pageNode({ id: 'o1', type: 'acme/other', props: {} });
    const doc = docWith([column, box, other], {
      'acme/box': 3,
      'acme/column': 1,
      'acme/other': 1,
    });

    const result = migrateComponents(doc, migrations);

    expect(result.readOnlyReasons).toHaveLength(1);
    expect(result.doc.nodes.o1?.props?.trail).toEqual(s(['o']));
    expect(result.doc.nodes.b1).toBe(box);
    expect(result.doc.nodes.c1).toBe(column);
    expect(result.doc.components).toEqual({ 'acme/box': 3, 'acme/column': 1, 'acme/other': 2 });
  });

  it('is idempotent: migrating twice equals migrating once', () => {
    const doc = docWith([column, box], { 'acme/box': 1, 'acme/column': 1 });

    const once = migrateComponents(doc, migrations);
    const twice = migrateComponents(once.doc, migrations);

    expect(twice.doc).toBe(once.doc);
    expect(twice.readOnlyReasons).toEqual([]);
  });

  it('never mutates its input, and returns the same reference when nothing changes', () => {
    const doc = Object.freeze(docWith([column, box], { 'acme/box': 1, 'acme/column': 1 }));
    const snapshot = structuredClone(doc);

    expect(() => migrateComponents(doc, migrations)).not.toThrow();
    expect(doc).toEqual(snapshot);

    const current = docWith([box], { 'acme/box': 2 });
    expect(migrateComponents(current, migrations).doc).toBe(current);
  });

  it('migrateFragment matches migrateComponents on the same nodes', () => {
    const fragment: BuilderFragment = {
      format: 'buildr/fragment',
      schemaVersion: 1,
      components: { 'acme/box': 1, 'acme/column': 1 },
      roots: ['c1'],
      nodes: { c1: column, b1: box },
    };
    const doc = docWith([column, box], { 'acme/box': 1, 'acme/column': 1 });

    const result = migrateFragment(fragment, migrations);
    const docResult = migrateComponents(doc, migrations);

    expect(result.fragment.nodes).toEqual(docResult.doc.nodes);
    expect(result.fragment.components).toEqual(docResult.doc.components);
    expect(result.fragment.roots).toEqual(['c1']);
    expect(result.readOnlyReasons).toEqual([]);
  });

  it('migrateFragment returns the same fragment when current, and reasons when blocked', () => {
    const current: BuilderFragment = {
      format: 'buildr/fragment',
      schemaVersion: 1,
      components: { 'acme/box': 2 },
      roots: ['b1'],
      nodes: { b1: box },
    };
    expect(migrateFragment(current, migrations).fragment).toBe(current);

    const blocked = { ...current, components: { 'acme/box': 3 } };
    const result = migrateFragment(blocked, migrations);
    expect(result.fragment).toBe(blocked);
    expect(result.readOnlyReasons).toHaveLength(1);
  });

  it('blocks the group when the replacing type has nodes but no stored version', () => {
    const doc = docWith([column, box], { 'acme/column': 1 });

    const result = migrateComponents(doc, migrations);

    expect(result.doc).toBe(doc);
    expect(result.readOnlyReasons.map((r) => r.code)).toEqual(['component.missing-version']);
  });

  it('still reports the retired version mismatch when the replacing type has no version', () => {
    const doc = docWith([column, box], { 'acme/column': 2 });

    const result = migrateComponents(doc, migrations);

    expect(result.doc).toBe(doc);
    expect(result.readOnlyReasons.map((r) => r.code).sort()).toEqual([
      'component.missing-version',
      'component.replacement-version-mismatch',
    ]);
  });

  describe('with a replacement that lands below the current version', () => {
    const tag = (n: number): ComponentMigrationStep => step(n, n + 1, `t${n}`);
    const multi: ComponentMigrations = {
      'acme/box': {
        currentVersion: 4,
        steps: [tag(1), tag(2), tag(3)],
        replaces: {
          'acme/column': {
            fromVersion: 1,
            toVersion: 3,
            migrate: ({ props, styles }) => ({ props: { ...props, from: s('column') }, styles }),
          },
        },
      },
    };

    it('runs only the target steps from toVersion on converted nodes', () => {
      const doc = docWith([column, box], { 'acme/box': 1, 'acme/column': 1 });

      const result = migrateComponents(doc, multi);

      expect(result.readOnlyReasons).toEqual([]);
      expect(result.doc.nodes.c1?.props?.trail).toEqual(s(['t3']));
      expect(result.doc.nodes.c1?.props?.from).toEqual(s('column'));
      expect(result.doc.nodes.b1?.props?.trail).toEqual(s(['t1', 't2', 't3']));
      expect(result.applied['acme/column']).toEqual(
        [tag(3)].map((x) => expect.objectContaining({ from: x.from })),
      );
    });

    it('leaves the whole group untouched when the chain after toVersion is broken', () => {
      const broken: ComponentMigrations = {
        'acme/box': {
          currentVersion: 4,
          steps: [tag(1), tag(2)],
          replaces: multi['acme/box']?.replaces,
        },
      };
      const doc = docWith([column, box], { 'acme/box': 4, 'acme/column': 1 });

      const result = migrateComponents(doc, broken);

      expect(result.doc).toBe(doc);
      expect(result.readOnlyReasons.map((r) => r.code)).toEqual([
        'component.migration-chain-invalid',
      ]);
    });
  });

  describe('styles', () => {
    const base = { base: { layout: { gap: 4 } } } as unknown as PageNode['styles'];
    const withStyles = (replace: ComponentMigrations['acme/box']['replaces']) =>
      ({
        'acme/box': { currentVersion: 2, steps: [boxStep], replaces: replace },
      }) as ComponentMigrations;
    const doc = () =>
      docWith([pageNode({ id: 'c1', type: 'acme/column', styles: base })], {
        'acme/column': 1,
        'acme/box': 2,
      });

    it('keeps the styles a replacement returns', () => {
      const result = migrateComponents(
        doc(),
        withStyles({
          'acme/column': { fromVersion: 1, toVersion: 2, migrate: (node) => node },
        }),
      );
      expect(result.doc.nodes.c1?.styles).toEqual(base);
    });

    it('drops the styles key when the replacement returns undefined styles', () => {
      const result = migrateComponents(
        doc(),
        withStyles({
          'acme/column': {
            fromVersion: 1,
            toVersion: 2,
            migrate: ({ props }) => ({ props, styles: undefined }),
          },
        }),
      );
      expect(result.doc.nodes.c1).not.toHaveProperty('styles');
    });
  });

  describe('node order', () => {
    const inner = (type: string, id: string) => pageNode({ id, type, props: {} });
    const cases: [string, PageNode[]][] = [
      [
        'retired nested inside target',
        [
          pageNode({ id: 'p', type: 'acme/box', slots: { default: ['k'] } }),
          pageNode({ id: 'k', type: 'acme/column' }),
        ],
      ],
      [
        'target nested inside retired',
        [
          pageNode({ id: 'k', type: 'acme/column', slots: { default: ['p'] } }),
          pageNode({ id: 'p', type: 'acme/box' }),
        ],
      ],
    ];

    for (const [name, list] of cases) {
      it(`gives the same result in either listing order: ${name}`, () => {
        const components = { 'acme/box': 1, 'acme/column': 1 };
        const forward = migrateComponents(docWith(list, components), migrations);
        const reversed = migrateComponents(docWith([...list].reverse(), components), migrations);

        expect(forward.readOnlyReasons).toEqual([]);
        expect(reversed.doc.nodes).toEqual(forward.doc.nodes);
        expect(forward.doc.nodes.k?.props?.display).toEqual(
          list.find((n) => n.id === 'k')?.type === 'acme/column' ? s('flex') : s('block'),
        );
        expect(forward.doc.nodes.p?.props?.display).toEqual(s('block'));
      });
    }

    it('handles retired nodes listed before and after target nodes', () => {
      const nodes = [inner('acme/column', 'a'), inner('acme/box', 'b'), inner('acme/column', 'c')];
      const doc = docWith(nodes, { 'acme/box': 1, 'acme/column': 1 });
      const result = migrateComponents(doc, migrations);
      expect(result.doc.nodes.a?.props?.display).toEqual(s('flex'));
      expect(result.doc.nodes.b?.props?.display).toEqual(s('block'));
      expect(result.doc.nodes.c?.props?.display).toEqual(s('flex'));
    });
  });
});
