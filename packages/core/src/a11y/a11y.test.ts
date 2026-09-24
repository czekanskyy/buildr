import { describe, expect, it } from 'vitest';
import type { BuilderDocument, NodeId, PageNode } from '../document/types.ts';
import type { ComponentMeta } from '../registry/meta.ts';
import { createRegistryMeta } from '../registry/registry.ts';
import { p } from '../schema/p.ts';
import { bind, expr, s } from '../values/helpers.ts';
import type { LocaleConfig } from '../values/types.ts';
import { runA11y } from './run.ts';
import type { A11yRule } from './types.ts';

function component(type: string, overrides: Partial<ComponentMeta> = {}): ComponentMeta {
  return {
    type,
    version: 1,
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
    component('buildr/page', { capabilities: { root: true }, slots: { default: {} } }),
    component('buildr/section', {
      slots: { default: {} },
      props: {
        as: p.text({ default: 'div', localizable: false }),
        ariaLabel: p.text({ default: '' }),
      },
      a11y: { element: 'div', landmark: true },
    }),
    component('buildr/heading', {
      props: {
        text: p.text({ default: 'Heading' }),
        level: p.number({ min: 1, max: 6, default: 2 }),
      },
    }),
    component('buildr/image', {
      props: { alt: p.text({ default: '' }), decorative: p.boolean({ default: false }) },
    }),
    component('buildr/button', {
      contentCategories: ['flow', 'interactive'],
      slots: { default: {} },
      props: {
        label: p.text({ default: 'Button' }),
        ariaLabel: p.text({ default: '' }),
        type: p.text({ default: 'button', localizable: false }),
      },
    }),
    component('buildr/link', {
      contentCategories: ['flow', 'interactive'],
      slots: { default: {} },
      props: {
        label: p.text({ default: 'Link' }),
        ariaLabel: p.text({ default: '' }),
        href: p.link({ default: '/' }),
        newTab: p.boolean({ default: false }),
      },
    }),
    component('buildr/form', { slots: { default: {} } }),
    component('buildr/input', {
      contentCategories: ['flow', 'interactive'],
      props: { label: p.text({ default: '' }), ariaLabel: p.text({ default: '' }) },
    }),
    component('buildr/list', { slots: { default: {} } }),
    component('buildr/list-item', { slots: { default: {} } }),
    component('buildr/loop', { slots: { default: {} } }),
    component('buildr/text', { props: { text: p.text({ default: '' }) } }),
    component('buildr/accordion-item', {
      slots: { default: {} },
      props: { summary: p.text({ default: 'Item' }) },
    }),
  ],
});

const ID = (n: number): NodeId => `node${String(n).padStart(6, '0')}`;

/** `spec` lists nodes; nesting is given by `kids`, listed under the parent's id. */
function build(
  nodes: readonly PageNode[],
  kids: Record<NodeId, readonly NodeId[]> = {},
): BuilderDocument {
  const byId: Record<string, PageNode> = {};
  const components: Record<string, number> = { 'buildr/page': 1 };
  for (const node of nodes) {
    const children = kids[node.id];
    byId[node.id] = children ? { ...node, slots: { default: children } } : node;
    components[node.type] = 1;
  }
  const child = new Set(Object.values(kids).flat());
  const top = nodes.filter((n) => !child.has(n.id)).map((n) => n.id);
  byId.root = { id: 'root', type: 'buildr/page', slots: { default: top } };
  return { schemaVersion: 1, root: 'root', nodes: byId, components };
}

const n = (
  i: number,
  type: string,
  props: PageNode['props'] = {},
  extra: Partial<PageNode> = {},
): PageNode => ({
  id: ID(i),
  type,
  ...(Object.keys(props).length > 0 ? { props } : {}),
  ...extra,
});

const run = (doc: BuilderDocument, options: Parameters<typeof runA11y>[2] = {}) =>
  runA11y(doc, registry, options);
const ids = (doc: BuilderDocument, options?: Parameters<typeof runA11y>[2]) =>
  run(doc, options).map((i) => i.ruleId);
const only = (rule: string, doc: BuilderDocument, options?: Parameters<typeof runA11y>[2]) =>
  run(doc, options).filter((i) => i.ruleId === rule);

const locales: LocaleConfig = {
  locales: ['en', 'pl'],
  default: 'en',
  fallback: true,
  intl: { en: 'English', pl: 'Polski' },
};

describe('runA11y', () => {
  it('finds nothing in a well-formed document', () => {
    const doc = build(
      [
        n(1, 'buildr/section', { as: s('main') }),
        n(2, 'buildr/heading', { text: s('Welcome'), level: s(2) }),
        n(3, 'buildr/image', { alt: s('A cat'), decorative: s(false) }),
        n(4, 'buildr/image', { alt: s(''), decorative: s(true) }),
        n(5, 'buildr/link', { label: s('Read more'), href: s('/more') }),
        n(6, 'buildr/form'),
        n(7, 'buildr/input', { label: s('Email') }),
        n(8, 'buildr/button', { label: s('Send'), type: s('submit') }),
        n(9, 'buildr/list'),
        n(10, 'buildr/list-item'),
        n(11, 'buildr/heading', { text: s('More'), level: s(3) }),
      ],
      {
        [ID(1)]: [ID(2), ID(3), ID(4), ID(5), ID(6), ID(9), ID(11)],
        [ID(6)]: [ID(7), ID(8)],
        [ID(9)]: [ID(10)],
      },
    );
    expect(run(doc)).toEqual([]);
    // Untranslated text is the only thing left to say about it when there are two languages.
    expect(new Set(run(doc, { locales }).map((i) => i.ruleId))).toEqual(
      new Set(['missing-translation']),
    );
  });

  describe('image-alt', () => {
    it('flags an explicitly empty alt on an image that is not decorative', () => {
      const doc = build([n(1, 'buildr/image', { alt: s('  ') })]);
      expect(only('image-alt', doc)).toMatchObject([{ severity: 'error', nodeId: ID(1) }]);
    });
    it('accepts text, a decorative image, a bound alt and an unset alt', () => {
      for (const props of [
        { alt: s('x') },
        { alt: s(''), decorative: s(true) },
        { alt: bind('post.title') },
        { alt: s(''), decorative: bind('post.decorative') },
        {},
      ]) {
        expect(only('image-alt', build([n(1, 'buildr/image', props)]))).toEqual([]);
      }
    });
    it('checks every language, and reports which', () => {
      const doc = build([n(1, 'buildr/image', { alt: s('A cat', { l10n: { pl: '' } }) })]);
      const issues = only('image-alt', doc, { locales });
      expect(issues).toHaveLength(1);
      expect(issues[0]?.locale).toBe('pl');
    });
    it('does not treat a missing translation as empty when falling back', () => {
      const doc = build([n(1, 'buildr/image', { alt: s('A cat') })]);
      expect(only('image-alt', doc, { locales })).toEqual([]);
      const strict = { ...locales, fallback: false };
      expect(only('image-alt', doc, { locales: strict }).map((i) => i.locale)).toEqual(['pl']);
    });
  });

  describe('heading-order', () => {
    const headings = (levels: number[]) =>
      build(levels.map((level, i) => n(i + 1, 'buildr/heading', { level: s(level) })));

    it('accepts a sequence without gaps', () => {
      expect(only('heading-order', headings([2, 3, 3, 2, 3, 4]))).toEqual([]);
    });
    it('flags a skipped level and offers the fix', () => {
      const issues = only('heading-order', headings([2, 4]));
      expect(issues).toHaveLength(1);
      expect(issues[0]?.nodeId).toBe(ID(2));
      expect(issues[0]?.fix).toEqual({
        type: 'node.setProp',
        payload: { id: ID(2), prop: 'level', value: { kind: 'static', value: 3 } },
      });
    });
    it('goes back up freely', () => {
      expect(only('heading-order', headings([2, 3, 4, 2]))).toEqual([]);
    });
    it('treats the layout H1 as the level before the first heading', () => {
      expect(only('heading-order', headings([3]))).toHaveLength(1);
    });
    it('does not judge across a heading whose level is bound', () => {
      const doc = build([
        n(1, 'buildr/heading', { level: s(2) }),
        n(2, 'buildr/heading', { level: bind('post.level') }),
        n(3, 'buildr/heading', { level: s(5) }),
      ]);
      expect(only('heading-order', doc)).toEqual([]);
    });
    it('flags an H1 when the layout renders it', () => {
      expect(only('heading-order', headings([1, 2]))).toHaveLength(1);
    });
    it('with expectH1 "document" wants exactly one H1', () => {
      const config = { expectH1: 'document' as const };
      expect(only('heading-order', headings([1, 2, 2]), { config })).toEqual([]);
      expect(only('heading-order', headings([2, 3]), { config }).map((i) => i.nodeId)).toEqual([
        'root',
        ID(1),
      ]);
      expect(only('heading-order', headings([1, 2, 1]), { config }).map((i) => i.nodeId)).toEqual([
        ID(3),
      ]);
    });
  });

  describe('empty-heading', () => {
    it('flags an empty heading only', () => {
      const doc = build([
        n(1, 'buildr/heading', { text: s(' ') }),
        n(2, 'buildr/heading', { text: s('x') }),
        n(3, 'buildr/heading', { text: bind('post.title') }),
        n(4, 'buildr/heading', { text: expr('post.title') }),
      ]);
      expect(only('empty-heading', doc).map((i) => i.nodeId)).toEqual([ID(1)]);
    });
  });

  describe('button-name and link-name', () => {
    it('flag a control with neither label nor accessible name', () => {
      const doc = build([
        n(1, 'buildr/button', { label: s(''), ariaLabel: s('') }),
        n(2, 'buildr/link', { label: s(''), ariaLabel: s('') }),
      ]);
      expect(only('button-name', doc).map((i) => i.nodeId)).toEqual([ID(1)]);
      expect(only('link-name', doc).map((i) => i.nodeId)).toEqual([ID(2)]);
    });
    it('accept a label, an accessible name, a bound label or children', () => {
      const doc = build(
        [
          n(1, 'buildr/button', { label: s(''), ariaLabel: s('Close') }),
          n(2, 'buildr/button', { label: s('Go') }),
          n(3, 'buildr/button', { label: bind('x.y'), ariaLabel: s('') }),
          n(4, 'buildr/link', { label: s(''), ariaLabel: s('') }),
          n(5, 'buildr/text'),
        ],
        { [ID(4)]: [ID(5)] },
      );
      expect(only('button-name', doc)).toEqual([]);
      expect(only('link-name', doc)).toEqual([]);
    });
    it('are checked per language', () => {
      const doc = build([n(1, 'buildr/button', { label: s('Go', { l10n: { pl: '' } }) })]);
      expect(only('button-name', doc, { locales }).map((i) => i.locale)).toEqual(['pl']);
    });
  });

  describe('link-href', () => {
    it('flags an empty or "#" destination', () => {
      const doc = build([
        n(1, 'buildr/link', { href: s('') }),
        n(2, 'buildr/link', { href: s('#') }),
        n(3, 'buildr/link', { href: s('/ok') }),
        n(4, 'buildr/link', { href: bind('post.url') }),
      ]);
      expect(only('link-href', doc).map((i) => i.nodeId)).toEqual([ID(1), ID(2)]);
    });
  });

  describe('new-tab-link', () => {
    it('notes links that open a new tab', () => {
      const doc = build([n(1, 'buildr/link', { newTab: s(true) }), n(2, 'buildr/link')]);
      expect(only('new-tab-link', doc)).toMatchObject([{ severity: 'info', nodeId: ID(1) }]);
    });
  });

  describe('form-label', () => {
    it('flags a field without a label and accepts one with a label or an accessible name', () => {
      const doc = build([
        n(1, 'buildr/input', { label: s('') }),
        n(2, 'buildr/input', { label: s('Name') }),
        n(3, 'buildr/input', { label: s(''), ariaLabel: s('Search') }),
        n(4, 'buildr/input', { label: bind('x.y') }),
      ]);
      expect(only('form-label', doc).map((i) => i.nodeId)).toEqual([ID(1)]);
    });
    it('applies to any component that declares a form field', () => {
      const custom = createRegistryMeta({
        components: [
          component('buildr/page', { capabilities: { root: true }, slots: { default: {} } }),
          component('acme/rating', {
            props: { label: p.text({ default: '' }) },
            formField: { valueType: 'number' } as never,
          }),
        ],
      });
      const doc = build([n(1, 'acme/rating')]);
      expect(runA11y(doc, custom).map((i) => i.ruleId)).toEqual(['form-label']);
    });
  });

  describe('form-submit', () => {
    it('flags a form with no submit button', () => {
      const bare = build([n(1, 'buildr/form'), n(2, 'buildr/input', { label: s('x') })], {
        [ID(1)]: [ID(2)],
      });
      expect(only('form-submit', bare).map((i) => i.nodeId)).toEqual([ID(1)]);
      const plainButton = build(
        [n(1, 'buildr/form'), n(2, 'buildr/button', { type: s('button') })],
        {
          [ID(1)]: [ID(2)],
        },
      );
      expect(only('form-submit', plainButton)).toHaveLength(1);
    });
    it('accepts a nested submit button, or one whose type is bound', () => {
      const nested = build(
        [n(1, 'buildr/form'), n(2, 'buildr/section'), n(3, 'buildr/button', { type: s('submit') })],
        { [ID(1)]: [ID(2)], [ID(2)]: [ID(3)] },
      );
      expect(only('form-submit', nested)).toEqual([]);
      const bound = build([n(1, 'buildr/form'), n(2, 'buildr/button', { type: bind('x.t') })], {
        [ID(1)]: [ID(2)],
      });
      expect(only('form-submit', bound)).toEqual([]);
    });
  });

  describe('nested-interactive', () => {
    it('flags interactive content inside interactive content', () => {
      const doc = build([n(1, 'buildr/link'), n(2, 'buildr/button')], { [ID(1)]: [ID(2)] });
      expect(only('nested-interactive', doc)).toMatchObject([{ nodeId: ID(2) }]);
    });
    it('accepts siblings', () => {
      const doc = build([n(1, 'buildr/link'), n(2, 'buildr/button')]);
      expect(only('nested-interactive', doc)).toEqual([]);
    });
  });

  describe('duplicate-anchor', () => {
    it('flags every use after the first', () => {
      const doc = build([
        n(1, 'buildr/text', {}, { anchor: 'top' }),
        n(2, 'buildr/text', {}, { anchor: 'top' }),
        n(3, 'buildr/text', {}, { anchor: 'other' }),
        n(4, 'buildr/text', {}, { anchor: 'top' }),
      ]);
      expect(only('duplicate-anchor', doc).map((i) => i.nodeId)).toEqual([ID(2), ID(4)]);
    });
  });

  describe('list-structure', () => {
    it('flags a child that is not a list item, but lets a Loop through', () => {
      const doc = build(
        [n(1, 'buildr/list'), n(2, 'buildr/list-item'), n(3, 'buildr/text'), n(4, 'buildr/loop')],
        { [ID(1)]: [ID(2), ID(3), ID(4)] },
      );
      expect(only('list-structure', doc).map((i) => i.nodeId)).toEqual([ID(3)]);
    });
  });

  describe('landmark-unique', () => {
    it('flags a second main', () => {
      const doc = build([
        n(1, 'buildr/section', { as: s('main') }),
        n(2, 'buildr/section', { as: s('main') }),
      ]);
      expect(only('landmark-unique', doc)).toMatchObject([{ nodeId: ID(2), severity: 'error' }]);
    });
    it('flags several unnamed navs, not a single one or named ones', () => {
      const unnamed = build([
        n(1, 'buildr/section', { as: s('nav') }),
        n(2, 'buildr/section', { as: s('nav') }),
      ]);
      expect(only('landmark-unique', unnamed).map((i) => i.nodeId)).toEqual([ID(1), ID(2)]);
      const one = build([n(1, 'buildr/section', { as: s('nav') })]);
      expect(only('landmark-unique', one)).toEqual([]);
      const named = build([
        n(1, 'buildr/section', { as: s('nav'), ariaLabel: s('Main') }),
        n(2, 'buildr/section', { as: s('nav'), ariaLabel: s('Footer') }),
      ]);
      expect(only('landmark-unique', named)).toEqual([]);
    });
    it('ignores sections that are not landmarks', () => {
      const doc = build([
        n(1, 'buildr/section', { as: s('div') }),
        n(2, 'buildr/section', { as: s('div') }),
      ]);
      expect(only('landmark-unique', doc)).toEqual([]);
    });
  });

  describe('accordion-structure', () => {
    it('flags an item with no summary', () => {
      const doc = build([
        n(1, 'buildr/accordion-item', { summary: s('') }),
        n(2, 'buildr/accordion-item', { summary: s('Why?') }),
        n(3, 'buildr/accordion-item', { summary: bind('faq.q') }),
      ]);
      expect(only('accordion-structure', doc).map((i) => i.nodeId)).toEqual([ID(1)]);
    });
  });

  describe('missing-translation', () => {
    it('reports translatable text with no translation, per language, as info', () => {
      const doc = build([
        n(1, 'buildr/heading', { text: s('Hello') }),
        n(2, 'buildr/heading', { text: s('Cześć', { l10n: { pl: 'Cześć' } }) }),
        n(3, 'buildr/heading', { text: s('') }),
        n(4, 'buildr/heading', { text: bind('post.title') }),
        n(5, 'buildr/heading', { text: expr('Hi {{ post.title }}', { mode: 'template' }) }),
        n(6, 'buildr/link', { href: s('/x') }),
      ]);
      const issues = only('missing-translation', doc, { locales });
      expect(issues.map((i) => [i.nodeId, i.locale, i.severity])).toEqual([
        [ID(1), 'pl', 'info'],
        [ID(5), 'pl', 'info'],
      ]);
    });
    it('is silent without a language configuration and for the default language', () => {
      const doc = build([n(1, 'buildr/heading', { text: s('Hello') })]);
      expect(only('missing-translation', doc)).toEqual([]);
    });
    it('does not report props that are not localizable', () => {
      const doc = build([n(1, 'buildr/button', { type: s('submit') })]);
      expect(
        only('missing-translation', doc, { locales }).every(
          (i) => i.nodeId !== ID(1) || !i.message.includes('type'),
        ),
      ).toBe(true);
    });
  });

  describe('runner', () => {
    it('honours disabledRules', () => {
      const doc = build([n(1, 'buildr/image', { alt: s('') })]);
      expect(ids(doc)).toEqual(['image-alt']);
      expect(ids(doc, { config: { disabledRules: ['image-alt'] } })).toEqual([]);
    });

    it('reports in render order, then rule order', () => {
      const doc = build([
        n(1, 'buildr/link', { label: s(''), href: s('#') }),
        n(2, 'buildr/image', { alt: s('') }),
      ]);
      expect(run(doc).map((i) => [i.nodeId, i.ruleId])).toEqual([
        [ID(1), 'link-name'],
        [ID(1), 'link-href'],
        [ID(2), 'image-alt'],
      ]);
    });

    it('applies a rule to components that list it in a11y.rules', () => {
      const rule: A11yRule = {
        id: 'custom',
        severity: 'warning',
        appliesTo: [],
        check(ctx) {
          return ctx.nodesFor(this).map((node) => ({
            ruleId: 'custom',
            severity: 'warning',
            nodeId: node.id,
            message: 'hit',
          }));
        },
      };
      const custom = createRegistryMeta({
        components: [
          component('buildr/page', { capabilities: { root: true }, slots: { default: {} } }),
          component('acme/a', { a11y: { element: 'div', rules: ['custom'] } }),
          component('acme/b'),
        ],
      });
      const doc = build([n(1, 'acme/a'), n(2, 'acme/b')]);
      expect(runA11y(doc, custom, { rules: [rule] }).map((i) => i.nodeId)).toEqual([ID(1)]);
    });

    it('survives a rule that throws, reporting it instead of losing the rest', () => {
      const broken: A11yRule = {
        id: 'broken',
        severity: 'error',
        check() {
          throw new Error('boom');
        },
      };
      const doc = build([n(1, 'buildr/image', { alt: s('') })]);
      const issues = run(doc, { rules: [broken] });
      expect(issues).toMatchObject([{ ruleId: 'a11y-internal', nodeId: 'root' }]);
      expect(issues[0]?.message).toContain('boom');
    });

    it('never throws on documents the registry does not know', () => {
      const doc = build([n(1, 'acme/mystery', { x: s(1) })]);
      expect(() => run(doc, { locales })).not.toThrow();
      expect(run(doc, { locales })).toEqual([]);
    });
  });
});
