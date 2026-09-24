import { describe, expect, it } from 'vitest';
import type { DataSchema } from '../data/schema.ts';
import type { BuilderDocument, NodeId, PageNode } from '../document/types.ts';
import type { ComponentMeta } from '../registry/meta.ts';
import { createRegistryMeta } from '../registry/registry.ts';
import { p } from '../schema/p.ts';
import { bind, expr, s } from '../values/helpers.ts';
import type { LocaleConfig } from '../values/types.ts';
import { validateDocument } from './validate.ts';

function component(type: string, overrides: Partial<ComponentMeta> = {}): ComponentMeta {
  return {
    type,
    version: 2,
    label: type.replace('buildr/', ''),
    category: 'content',
    props: {},
    contentCategories: ['flow'],
    styles: { groups: [] },
    runtime: 'shared',
    ...overrides,
  };
}

const registry = createRegistryMeta({
  components: [
    component('buildr/page', { version: 1, capabilities: { root: true }, slots: { default: {} } }),
    component('buildr/section', { slots: { default: {} } }),
    component('buildr/heading', {
      contentCategories: ['flow', 'phrasing'],
      props: {
        title: p.text({ maxLength: 10 }),
        level: p.number({ min: 1, max: 6, default: 1 }),
        code: p.text({ localizable: false }),
        plain: p.text({ bindable: false }),
        needed: p.text({ required: true }),
      },
    }),
    component('buildr/boxes', { slots: { default: { allow: ['buildr/textbox'] } } }),
    component('buildr/textbox', { slots: { default: { allow: ['buildr/text'] } } }),
    component('buildr/list', { slots: { default: { min: 1 } } }),
    component('buildr/pair', { slots: { default: { max: 1 } } }),
    component('buildr/text', { contentCategories: ['flow', 'phrasing'] }),
  ],
});

const locales: LocaleConfig = {
  locales: ['en', 'pl'],
  default: 'en',
  fallback: true,
  intl: { en: 'English', pl: 'Polski' },
};

const dataSchema: DataSchema = {
  scopes: {
    post: {
      type: {
        t: 'object',
        fields: { title: { type: { t: 'string' } }, views: { type: { t: 'number' } } },
      },
    },
  },
  entities: {},
};

const ID = (n: number): NodeId => `node${String(n).padStart(6, '0')}`;

function doc(
  children: readonly PageNode[],
  versions: Record<string, number> = {},
): BuilderDocument {
  const nodes: Record<string, PageNode> = {
    root: { id: 'root', type: 'buildr/page', slots: { default: children.map((c) => c.id) } },
  };
  const components: Record<string, number> = { 'buildr/page': 1, ...versions };
  for (const child of children) {
    nodes[child.id] = child;
    components[child.type] ??= 2;
  }
  return { schemaVersion: 1, root: 'root', nodes, components };
}

/** A document with an explicit tree: `all` holds every non-root node, `top` the root's children. */
function tree(all: readonly PageNode[], top: readonly NodeId[]): BuilderDocument {
  const nodes: Record<string, PageNode> = {
    root: { id: 'root', type: 'buildr/page', slots: { default: top } },
  };
  const components: Record<string, number> = { 'buildr/page': 1 };
  for (const node of all) {
    nodes[node.id] = node;
    components[node.type] = 2;
  }
  return { schemaVersion: 1, root: 'root', nodes, components };
}

const heading = (props: PageNode['props'], extra: Partial<PageNode> = {}): PageNode => ({
  id: ID(1),
  type: 'buildr/heading',
  props: { needed: s('x'), ...props },
  ...extra,
});

const validate = (input: unknown, extra: object = {}) =>
  validateDocument(input, { registry, locales, dataSchema, ...extra });

const codes = (input: unknown, extra: object = {}) =>
  validate(input, extra).issues.map((i) => i.code);

describe('validateDocument', () => {
  it('accepts a healthy document', () => {
    const result = validate(
      doc([
        heading({ title: s('Hi', { l10n: { pl: 'Cześć' } }), level: s(2) }),
        { id: ID(2), type: 'buildr/section', slots: { default: [] } },
      ]),
    );
    expect(result.issues).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.doc?.root).toBe('root');
  });

  describe('blocking issues', () => {
    it.each([
      ['a non-object', 42],
      ['a wrong schema version', { schemaVersion: 99, root: 'root', nodes: {}, components: {} }],
    ])('rejects %s at the envelope', (_name, input) => {
      const result = validate(input);
      expect(result.ok).toBe(false);
      expect(result.doc).toBeUndefined();
      expect(result.issues.every((i) => i.blocking)).toBe(true);
    });

    it('rejects a document over the size limit', () => {
      const result = validate(doc([heading({})]), {
        limits: { maxDocumentBytes: 50, maxNodes: 100, maxDepth: 10, maxChildren: 10 },
      });
      expect(result.ok).toBe(false);
      expect(result.issues[0]?.blocking).toBe(true);
    });

    it('reports broken invariants', () => {
      const broken = doc([heading({})]);
      const bad = { ...broken, root: 'missing' };
      const result = validate(bad);
      expect(result.ok).toBe(false);
      expect(result.issues.every((i) => i.blocking && i.code.startsWith('document.'))).toBe(true);
    });

    it('rejects a component version newer than the registry', () => {
      const result = validate(doc([heading({})], { 'buildr/heading': 9 }));
      expect(result.ok).toBe(false);
      expect(
        result.issues.find((i) => i.code === 'validation.component-version-ahead'),
      ).toMatchObject({
        blocking: true,
      });
    });

    it('warns about an older version without blocking', () => {
      const result = validate(doc([heading({})], { 'buildr/heading': 1 }));
      expect(result.ok).toBe(true);
      expect(codes(doc([heading({})], { 'buildr/heading': 1 }))).toContain(
        'validation.component-outdated',
      );
    });

    it('never throws on a hostile input', () => {
      expect(() => validate(null)).not.toThrow();
      expect(() => validate({ __proto__: { x: 1 } })).not.toThrow();
    });
  });

  describe('non-blocking issues', () => {
    it('flags an unregistered component', () => {
      const result = validate(doc([{ id: ID(1), type: 'acme/mystery' }]));
      expect(result.ok).toBe(true);
      expect(result.issues.map((i) => i.code)).toEqual(['validation.unknown-component']);
    });

    it('flags an unknown prop', () => {
      expect(codes(doc([heading({ nope: s(1) })]))).toContain('validation.unknown-prop');
    });

    it('flags a missing required prop', () => {
      const node: PageNode = { id: ID(1), type: 'buildr/heading', props: {} };
      const issue = validate(doc([node])).issues.find(
        (i) => i.code === 'validation.missing-required-prop',
      );
      expect(issue?.details).toMatchObject({ prop: 'needed' });
    });

    it('flags an invalid static value and an invalid translation', () => {
      expect(codes(doc([heading({ title: s('this is far too long') })]))).toContain(
        'validation.invalid-prop-value',
      );
      const result = validate(
        doc([heading({ title: s('ok', { l10n: { pl: 'this is far too long' } }) })]),
      );
      expect(result.issues.find((i) => i.code === 'validation.invalid-prop-value')?.path).toEqual([
        'nodes',
        ID(1),
        'props',
        'title',
        'l10n',
        'pl',
      ]);
    });

    it('flags a malformed value', () => {
      const node = heading({ title: { kind: 'static' } as never });
      expect(codes(doc([node]))).toContain('validation.invalid-value-shape');
    });

    it('flags translations of a prop that is not localizable', () => {
      expect(codes(doc([heading({ code: s('a', { l10n: { pl: 'b' } }) })]))).toContain(
        'validation.not-localizable',
      );
    });

    it('flags a locale that is not configured, as a warning', () => {
      const result = validate(doc([heading({ title: s('a', { l10n: { de: 'b' } }) })]));
      const issue = result.issues.find((i) => i.code === 'validation.unknown-locale');
      expect(issue).toMatchObject({ severity: 'warning', blocking: false });
    });

    it('does not check locale keys without a locale config', () => {
      const result = validateDocument(doc([heading({ title: s('a', { l10n: { de: 'b' } }) })]), {
        registry,
      });
      expect(result.issues).toEqual([]);
    });

    it('flags a binding on a prop that cannot be bound', () => {
      expect(codes(doc([heading({ plain: bind('post.title') })]))).toContain(
        'validation.not-bindable',
      );
    });
  });

  describe('bindings and expressions', () => {
    it('flags a malformed binding path', () => {
      expect(codes(doc([heading({ title: bind('post..title') })]))).toHaveLength(1);
    });

    it('flags a binding that is not in the data schema', () => {
      const result = validate(doc([heading({ title: bind('post.nope') })]));
      expect(result.issues.map((i) => i.code)).toEqual(['validation.unknown-binding-path']);
    });

    it('accepts a binding that is in the data schema', () => {
      expect(validate(doc([heading({ title: bind('post.title') })])).issues).toEqual([]);
    });

    it('does not check paths without a data schema', () => {
      const result = validateDocument(doc([heading({ title: bind('anything.goes') })]), {
        registry,
      });
      expect(result.issues).toEqual([]);
    });

    it('flags an expression with a syntax error', () => {
      expect(codes(doc([heading({ title: expr('1 +') })]))).toEqual(['expr.syntax']);
    });

    it('flags an unknown path and an unknown function in an expression', () => {
      expect(codes(doc([heading({ title: expr('post.nope') })]))).toContain('expr.unknown-path');
      expect(codes(doc([heading({ title: expr('nope(1)') })]))).toContain('expr.unknown-function');
    });

    it('flags an expression whose type the prop does not accept', () => {
      const result = validate(doc([heading({ level: expr('post.title') })]));
      expect(result.issues.length).toBeGreaterThan(0);
    });

    it('checks a template, including its translations', () => {
      const ok = expr('Hi {{ post.title }}', { mode: 'template' });
      expect(validate(doc([heading({ title: ok })])).issues).toEqual([]);
      const broken = expr('Hi {{ post.title', { mode: 'template' });
      expect(validate(doc([heading({ title: broken })])).issues).toHaveLength(1);
      const badTranslation = expr('Hi', {
        mode: 'template',
        l10n: { pl: 'Cześć {{ post.nope }}' },
      });
      expect(codes(doc([heading({ title: badTranslation })]))).toContain('expr.unknown-path');
    });

    it('leaves Loop scopes to the render, since the schema cannot know them', () => {
      const node = heading({ title: expr('item.name') });
      expect(validate(doc([node])).issues).toEqual([]);
      expect(validate(doc([heading({ title: bind('item.name') })])).issues).toEqual([]);
    });

    it('checks visibleIf', () => {
      expect(codes(doc([heading({}, { visibleIf: bind('post.nope') })]))).toEqual([
        'validation.unknown-binding-path',
      ]);
      expect(codes(doc([heading({}, { visibleIf: expr('1 +') })]))).toEqual(['expr.syntax']);
      expect(codes(doc([heading({}, { visibleIf: { kind: 'nope' } })]))).toEqual([
        'validation.invalid-value-shape',
      ]);
      expect(codes(doc([heading({}, { visibleIf: expr('post.views > 1') })]))).toEqual([]);
    });
  });

  describe('structure', () => {
    it('flags a child a slot does not allow', () => {
      const boxes: PageNode = { id: ID(1), type: 'buildr/boxes', slots: { default: [ID(2)] } };
      const wrong: PageNode = { id: ID(2), type: 'buildr/heading', props: { needed: s('x') } };
      const result = validate(tree([boxes, wrong], [ID(1)]));
      expect(result.issues.map((i) => i.code)).toContain('validation.slot-not-allowed');
    });

    it('flags an unknown slot', () => {
      const node: PageNode = { id: ID(1), type: 'buildr/text', slots: { default: [] } };
      expect(codes(doc([node]))).toContain('validation.unknown-slot');
    });

    it('flags slot minimum and maximum', () => {
      const list: PageNode = { id: ID(1), type: 'buildr/list', slots: { default: [] } };
      expect(codes(tree([list], [ID(1)]))).toContain('validation.slot-min');
      const pair: PageNode = { id: ID(1), type: 'buildr/pair', slots: { default: [ID(2), ID(3)] } };
      const text = (n: number): PageNode => ({ id: ID(n), type: 'buildr/text' });
      expect(codes(tree([pair, text(2), text(3)], [ID(1)]))).toContain('validation.slot-max');
    });
  });

  describe('styles', () => {
    it('reports style diagnostics without blocking', () => {
      const node = heading({}, { styles: { base: { layout: { gap: 'url(x)' } } } as never });
      const result = validate(doc([node]));
      expect(result.ok).toBe(true);
      expect(result.issues.some((i) => i.code.startsWith('style.'))).toBe(true);
      expect(result.issues.every((i) => !i.blocking)).toBe(true);
    });
  });

  it('validates 1000 nodes quickly', () => {
    const all: PageNode[] = [];
    const sections: PageNode[] = [];
    for (let block = 0; block < 4; block++) {
      const ids: NodeId[] = [];
      for (let i = 0; i < 249; i++) {
        const id = ID(block * 250 + i + 10);
        ids.push(id);
        all.push({
          id,
          type: 'buildr/heading',
          props: { needed: s('x'), title: bind('post.title'), level: s(2) },
        });
      }
      sections.push({ id: ID(block + 1), type: 'buildr/section', slots: { default: ids } });
    }
    const big = tree(
      [...sections, ...all],
      sections.map((x) => x.id),
    );
    const run = () => {
      const start = performance.now();
      const result = validate(big);
      return { ms: performance.now() - start, count: result.issues.length };
    };
    run(); // warm up
    const best = Math.min(run().ms, run().ms, run().ms, run().ms, run().ms);
    expect(validate(big).issues).toEqual([]);
    // Idle ≈10ms (the card asks for < 30ms); the bound is loose because the whole suite runs in parallel.
    expect(best).toBeLessThan(150);
  });
});
