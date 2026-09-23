import { describe, expect, it } from 'vitest';
import { createIndex } from '../document/document-index.ts';
import type { BuilderFragment } from '../document/fragment.ts';
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
import { canInsert, type InsertTarget } from './can-insert.ts';
import type { ReasonCode } from './reasons.ts';

/** A minimal, otherwise-valid leaf `ComponentMeta` — each case overrides what it needs. */
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

/** The registry shared by most cases below; a few cases `.extend()` it with a one-off type. */
function baseRegistry(): RegistryMeta {
  return createRegistryMeta({
    components: [
      component('buildr/page', ['flow'], {
        capabilities: { root: true },
        slots: { default: {} },
      }),
      component('buildr/section', ['flow'], { slots: { default: {} } }),
      component('buildr/stack', ['flow'], {
        slots: { default: {}, actions: { max: 2 } },
      }),
      // Real headings are leaves (their text comes from a prop) — given a slot here purely so
      // the heading/phrasing global rule can be exercised end to end through `canInsert`.
      component('buildr/heading', ['flow', 'heading'], { slots: { default: {} } }),
      component('buildr/text', ['flow', 'phrasing']),
      component('buildr/button', ['flow', 'phrasing', 'interactive']),
      // Interactive *and* a container — real interactive components are leaves; this exists only
      // to exercise "interactive cannot nest interactive" through a real slot.
      component('buildr/interactive-box', ['flow', 'interactive'], { slots: { default: {} } }),
      component('buildr/list', ['flow'], {
        slots: { default: { allow: ['buildr/list-item'] } },
      }),
      component('buildr/list-item', ['flow', 'list-item'], { slots: { default: {} } }),
      component('buildr/form', ['flow'], { slots: { default: {} } }),
      component('buildr/input', ['flow', 'phrasing', 'form-control']),
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

/** `root` gets `buildr/page` with `rootChildren` in its `default` slot; `nodes` fills in the rest. */
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

function target(parentId: NodeId, slot: SlotName, at?: number): InsertTarget {
  return at !== undefined ? { parentId, slot, at } : { parentId, slot };
}

describe('canInsert', () => {
  it('allows inserting a valid child into an open slot', () => {
    const doc = buildDoc({ section: node('section', 'buildr/section', { default: [] }) }, [
      'section',
    ]);
    const result = canInsert(
      doc,
      createIndex(doc),
      baseRegistry(),
      target('section', 'default'),
      'buildr/text',
    );
    expect(result).toEqual({ ok: true, value: true });
  });

  it('allows inserting a multi-root fragment that fits under the slot max', () => {
    const doc = buildDoc({ stack: node('stack', 'buildr/stack', { default: [], actions: [] }) }, [
      'stack',
    ]);
    const fragment: BuilderFragment = {
      format: 'buildr/fragment',
      schemaVersion: 1,
      components: {},
      roots: ['b1', 'b2'],
      nodes: {
        b1: { id: 'b1', type: 'buildr/button' },
        b2: { id: 'b2', type: 'buildr/button' },
      },
    };
    const result = canInsert(
      doc,
      createIndex(doc),
      baseRegistry(),
      target('stack', 'actions'),
      fragment,
    );
    expect(result).toEqual({ ok: true, value: true });
  });

  const cases: { name: string; code: ReasonCode; run: () => ReturnType<typeof canInsert> }[] = [
    {
      name: 'the target parent does not exist',
      code: 'target-not-found',
      run: () => {
        const doc = buildDoc({}, []);
        return canInsert(
          doc,
          createIndex(doc),
          baseRegistry(),
          target('missing', 'default'),
          'buildr/text',
        );
      },
    },
    {
      name: 'the target parent has an unregistered type',
      code: 'unknown-component-type',
      run: () => {
        const doc = buildDoc({ mystery: node('mystery', 'acme/mystery', { default: [] }) }, [
          'mystery',
        ]);
        return canInsert(
          doc,
          createIndex(doc),
          baseRegistry(),
          target('mystery', 'default'),
          'buildr/text',
        );
      },
    },
    {
      name: 'the inserted type is unregistered',
      code: 'unknown-component-type',
      run: () => {
        const doc = buildDoc({ section: node('section', 'buildr/section', { default: [] }) }, [
          'section',
        ]);
        return canInsert(
          doc,
          createIndex(doc),
          baseRegistry(),
          target('section', 'default'),
          'acme/mystery',
        );
      },
    },
    {
      name: 'the target slot does not exist on the parent',
      code: 'slot-not-found',
      run: () => {
        const doc = buildDoc({ section: node('section', 'buildr/section', { default: [] }) }, [
          'section',
        ]);
        return canInsert(
          doc,
          createIndex(doc),
          baseRegistry(),
          target('section', 'sidebar'),
          'buildr/text',
        );
      },
    },
    {
      name: 'the target parent is a leaf with no slots at all',
      code: 'slot-not-found',
      run: () => {
        const doc = buildDoc({ text: node('text', 'buildr/text') }, ['text']);
        return canInsert(
          doc,
          createIndex(doc),
          baseRegistry(),
          target('text', 'default'),
          'buildr/text',
        );
      },
    },
    {
      name: "the slot's deny list matches the inserted type",
      code: 'slot-denied',
      run: () => {
        const registry = baseRegistry().extend({
          components: [
            component('acme/picky', ['flow'], {
              slots: { default: { deny: ['buildr/button'] } },
            }),
          ],
        });
        const doc = buildDoc({ picky: node('picky', 'acme/picky', { default: [] }) }, ['picky']);
        return canInsert(
          doc,
          createIndex(doc),
          registry,
          target('picky', 'default'),
          'buildr/button',
        );
      },
    },
    {
      name: "the slot's allow list excludes the inserted type",
      code: 'slot-not-allowed',
      run: () => {
        const registry = baseRegistry().extend({
          components: [
            component('acme/picky', ['flow'], {
              slots: { default: { allow: ['buildr/text'] } },
            }),
          ],
        });
        const doc = buildDoc({ picky: node('picky', 'acme/picky', { default: [] }) }, ['picky']);
        return canInsert(
          doc,
          createIndex(doc),
          registry,
          target('picky', 'default'),
          'buildr/button',
        );
      },
    },
    {
      name: "the inserted type's parents.deny matches the target parent",
      code: 'parent-denied',
      run: () => {
        const registry = baseRegistry().extend({
          components: [
            component('acme/picky-child', ['flow'], {
              parents: { deny: ['buildr/section'] },
            }),
          ],
        });
        const doc = buildDoc({ section: node('section', 'buildr/section', { default: [] }) }, [
          'section',
        ]);
        return canInsert(
          doc,
          createIndex(doc),
          registry,
          target('section', 'default'),
          'acme/picky-child',
        );
      },
    },
    {
      name: "the inserted type's parents.allow excludes the target parent",
      code: 'parent-not-allowed',
      run: () => {
        const registry = baseRegistry().extend({
          components: [
            component('acme/picky-child', ['flow'], {
              parents: { allow: ['buildr/stack'] },
            }),
          ],
        });
        const doc = buildDoc({ section: node('section', 'buildr/section', { default: [] }) }, [
          'section',
        ]);
        return canInsert(
          doc,
          createIndex(doc),
          registry,
          target('section', 'default'),
          'acme/picky-child',
        );
      },
    },
    {
      name: 'a required ancestor is missing',
      code: 'missing-required-ancestor',
      run: () => {
        const registry = baseRegistry().extend({
          components: [
            component('acme/needs-form', ['flow', 'form-control'], {
              parents: { requireAncestor: ['buildr/form'] },
            }),
          ],
        });
        const doc = buildDoc({ section: node('section', 'buildr/section', { default: [] }) }, [
          'section',
        ]);
        return canInsert(
          doc,
          createIndex(doc),
          registry,
          target('section', 'default'),
          'acme/needs-form',
        );
      },
    },
    {
      name: 'a heading is given a non-phrasing child',
      code: 'heading-requires-phrasing',
      run: () => {
        const doc = buildDoc({ heading: node('heading', 'buildr/heading', { default: [] }) }, [
          'heading',
        ]);
        return canInsert(
          doc,
          createIndex(doc),
          baseRegistry(),
          target('heading', 'default'),
          'buildr/stack',
        );
      },
    },
    {
      name: 'interactive content is nested inside interactive content',
      code: 'nested-interactive',
      run: () => {
        const doc = buildDoc({ box: node('box', 'buildr/interactive-box', { default: [] }) }, [
          'box',
        ]);
        return canInsert(
          doc,
          createIndex(doc),
          baseRegistry(),
          target('box', 'default'),
          'buildr/button',
        );
      },
    },
    {
      name: 'a fragment nests interactive content inside an interactive ancestor several levels down',
      code: 'nested-interactive',
      run: () => {
        const doc = buildDoc({ box: node('box', 'buildr/interactive-box', { default: [] }) }, [
          'box',
        ]);
        const fragment: BuilderFragment = {
          format: 'buildr/fragment',
          schemaVersion: 1,
          components: {},
          roots: ['frag-stack'],
          nodes: {
            'frag-stack': {
              id: 'frag-stack',
              type: 'buildr/stack',
              slots: { default: ['frag-button'] },
            },
            'frag-button': { id: 'frag-button', type: 'buildr/button' },
          },
        };
        return canInsert(doc, createIndex(doc), baseRegistry(), target('box', 'default'), fragment);
      },
    },
    {
      name: 'a form is nested inside another form',
      code: 'nested-form',
      run: () => {
        const doc = buildDoc({ form: node('form', 'buildr/form', { default: [] }) }, ['form']);
        return canInsert(
          doc,
          createIndex(doc),
          baseRegistry(),
          target('form', 'default'),
          'buildr/form',
        );
      },
    },
    {
      name: 'a form control has no form ancestor',
      code: 'form-control-outside-form',
      run: () => {
        const doc = buildDoc({ section: node('section', 'buildr/section', { default: [] }) }, [
          'section',
        ]);
        return canInsert(
          doc,
          createIndex(doc),
          baseRegistry(),
          target('section', 'default'),
          'buildr/input',
        );
      },
    },
    {
      name: "a slot's max is exceeded",
      code: 'slot-max-exceeded',
      run: () => {
        const doc = buildDoc(
          {
            stack: node('stack', 'buildr/stack', { default: [], actions: ['b1', 'b2'] }),
            b1: node('b1', 'buildr/button'),
            b2: node('b2', 'buildr/button'),
          },
          ['stack'],
        );
        return canInsert(
          doc,
          createIndex(doc),
          baseRegistry(),
          target('stack', 'actions'),
          'buildr/button',
        );
      },
    },
    {
      name: 'the target index is out of range',
      code: 'invalid-index',
      run: () => {
        const doc = buildDoc({ section: node('section', 'buildr/section', { default: [] }) }, [
          'section',
        ]);
        return canInsert(
          doc,
          createIndex(doc),
          baseRegistry(),
          target('section', 'default', 5),
          'buildr/text',
        );
      },
    },
    {
      name: 'a live fragment root is pasted into its own subtree',
      code: 'cycle',
      run: () => {
        const stackNode = node('stack', 'buildr/stack', { default: ['inner'], actions: [] });
        const innerNode = node('inner', 'buildr/section', { default: [] });
        const doc = buildDoc({ stack: stackNode, inner: innerNode }, ['stack']);
        const fragment: BuilderFragment = {
          format: 'buildr/fragment',
          schemaVersion: 1,
          components: {},
          roots: ['stack'],
          nodes: { stack: stackNode, inner: innerNode },
        };
        // "inner" is inside "stack" — pasting "stack" back under "inner" would create a cycle.
        return canInsert(
          doc,
          createIndex(doc),
          baseRegistry(),
          target('inner', 'default'),
          fragment,
        );
      },
    },
    {
      name: 'the target is structurally locked',
      code: 'locked-structure',
      run: () => {
        const doc = buildDoc(
          {
            section: node(
              'section',
              'buildr/section',
              { default: [] },
              { lock: { structure: true } },
            ),
          },
          ['section'],
        );
        return canInsert(
          doc,
          createIndex(doc),
          baseRegistry(),
          target('section', 'default'),
          'buildr/text',
        );
      },
    },
    {
      name: 'the inserted type is not insertable',
      code: 'not-insertable',
      run: () => {
        const registry = baseRegistry().extend({
          components: [
            component('acme/internal', ['flow'], { capabilities: { insertable: false } }),
          ],
        });
        const doc = buildDoc({ section: node('section', 'buildr/section', { default: [] }) }, [
          'section',
        ]);
        return canInsert(
          doc,
          createIndex(doc),
          registry,
          target('section', 'default'),
          'acme/internal',
        );
      },
    },
    {
      name: 'the inserted type may only be the document root',
      code: 'root-only',
      run: () => {
        const doc = buildDoc({ section: node('section', 'buildr/section', { default: [] }) }, [
          'section',
        ]);
        return canInsert(
          doc,
          createIndex(doc),
          baseRegistry(),
          target('section', 'default'),
          'buildr/page',
        );
      },
    },
  ];

  for (const { name, code, run } of cases) {
    it(`rejects ${name} with "${code}"`, () => {
      const result = run();
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(code);
        expect(result.error.message.length).toBeGreaterThan(0);
      }
    });
  }

  it('reopens a structurally locked target through a region', () => {
    const doc = buildDoc(
      {
        section: node(
          'section',
          'buildr/section',
          { default: ['stack'] },
          { lock: { structure: true } },
        ),
        stack: node(
          'stack',
          'buildr/stack',
          { default: [], actions: [] },
          { region: 'actions-area' },
        ),
      },
      ['section'],
    );
    const result = canInsert(
      doc,
      createIndex(doc),
      baseRegistry(),
      target('stack', 'default'),
      'buildr/text',
    );
    expect(result).toEqual({ ok: true, value: true });
  });
});
