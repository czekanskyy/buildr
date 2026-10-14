import {
  type BuilderDocument,
  bind,
  createMemoryDataSource,
  expr,
  migrateComponents,
  type NodeStyles,
  parseDocument,
  runA11y,
  s,
  validateDocument,
} from '@next-buildr/core';
import { doc, type NodeTree } from '@next-buildr/test-utils';
import { describe, expect, it } from 'vitest';
import { imageFixtureMedia } from '../image/fixtures.ts';
import { Page } from '../page/definition.ts';
import { createRegistry, Probe, render } from '../test-kit.tsx';
import { defaultTheme } from '../theme.ts';
import { Container } from './definition.ts';
import { containerMigrationFixtures, nid } from './migration-fixtures.ts';
import { containerReplaces } from './replacements.ts';

const registry = createRegistry({ components: [Page, Container, Probe] });

/** What `loadDocument` does to a stored document: parse it, then migrate the components. */
function load(input: BuilderDocument) {
  const parsed = parseDocument(structuredClone(input));
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.error));
  const migrated = migrateComponents(parsed.value, registry.migrations);
  return {
    doc: migrated.doc,
    readOnlyReasons: migrated.readOnlyReasons,
    diagnostics: migrated.diagnostics,
  };
}

/** Zero validation issues and zero accessibility errors against the registry. */
function problemsOf(document: BuilderDocument): string[] {
  const validated = validateDocument(document, { registry: registry.meta, theme: defaultTheme });
  const a11y = runA11y(document, registry.meta, { theme: defaultTheme });
  return [
    ...validated.issues.map((i) => `${i.code} ${i.message}`),
    ...a11y.filter((i) => i.severity === 'error').map((i) => `${i.ruleId} ${i.message}`),
  ];
}

describe('container migrations', () => {
  it('registers the replacements of stack and section', () => {
    expect(Object.keys(registry.migrations['buildr/container']?.replaces ?? {}).sort()).toEqual([
      'buildr/section',
      'buildr/stack',
    ]);
    expect(Container.meta.version).toBe(2);
  });

  describe.each(containerMigrationFixtures.map((f) => [f.id, f] as const))(
    'fixture %s',
    (_id, fixture) => {
      it('loads as the expected document, with no reasons or diagnostics', () => {
        const loaded = load(fixture.before);
        expect(loaded.readOnlyReasons).toEqual([]);
        expect(loaded.diagnostics).toEqual([]);
        expect(loaded.doc).toEqual(fixture.after);
      });

      it('does not mutate the stored document', () => {
        const frozen = structuredClone(fixture.before);
        migrateComponents(frozen, registry.migrations);
        expect(frozen).toEqual(fixture.before);
      });

      it('is idempotent', () => {
        const once = load(fixture.before).doc as BuilderDocument;
        const twice = load(once);
        expect(twice.doc).toEqual(once);
      });

      it('produces a valid, accessible document', () => {
        expect(problemsOf(load(fixture.before).doc as BuilderDocument)).toEqual([]);
        expect(problemsOf(fixture.after)).toEqual([]);
      });

      it('renders without diagnostics', async () => {
        const { diagnostics, html } = await render(
          registry,
          fixture.before,
          createMemoryDataSource({ media: imageFixtureMedia }),
          { post: { cover: imageFixtureMedia.m1 } },
        );
        expect(diagnostics).toEqual([]);
        expect(html).toContain('bc-container');
      });
    },
  );

  it('migrates stored containers, stacks and sections of one document together', () => {
    const before = doc(
      {
        children: [
          { id: nid('c'), type: 'buildr/container', props: { width: s('sm') } },
          { id: nid('s'), type: 'buildr/stack' },
          { id: nid('x'), type: 'buildr/section', props: { container: s('full') } },
        ],
      },
      { components: { 'buildr/container': 1, 'buildr/stack': 1, 'buildr/section': 1 } },
    );
    const { doc: after } = load(before);
    expect(after?.components).toEqual({ 'buildr/page': 1, 'buildr/container': 2 });
    expect(after?.nodes[nid('c')]?.props?.['display']).toEqual(s('block'));
    expect(after?.nodes[nid('s')]?.props?.['display']).toEqual(s('flex'));
    expect(after?.nodes[nid('x')]?.props?.['display']).toEqual(s('flex'));
    expect(Object.values(after?.nodes ?? {}).map((n) => n.type)).not.toContain('buildr/stack');
    expect(problemsOf(after as BuilderDocument)).toEqual([]);
  });

  it('migrates a section whose version is missing from the document', () => {
    const before = doc(
      { children: [{ id: nid('x'), type: 'buildr/section' }] },
      { components: { 'buildr/page': 1 } },
    );
    expect(load(before).doc?.nodes[nid('x')]?.type).toBe('buildr/container');
  });

  it('leaves a stack stored at another version untouched, and says why', () => {
    const before = doc(
      { children: [{ id: nid('s'), type: 'buildr/stack' }] },
      { components: { 'buildr/stack': 2 } },
    );
    const loaded = load(before);
    expect(loaded.readOnlyReasons.map((d) => d.code)).toEqual([
      'component.replacement-version-mismatch',
    ]);
    expect(loaded.doc?.nodes[nid('s')]?.type).toBe('buildr/stack');
  });

  it('keeps every node field the replacement does not rewrite (nested locked template)', async () => {
    const preserved = {
      name: 'Hero band',
      anchor: 'hero',
      visibleIf: bind('route.params.show'),
      lock: { structure: true },
      source: { template: 'buildr/hero', version: 1 },
      ext: { 'acme:note': { pinned: true } },
    } as const;
    const before = doc(
      {
        children: [
          {
            id: nid('outer'),
            type: 'buildr/section',
            props: { ariaLabel: s('Hero') },
            ...preserved,
            children: [
              {
                id: nid('inner'),
                type: 'buildr/stack',
                name: 'Actions',
                region: 'actions',
                anchor: 'actions',
                lock: { content: true },
                ext: { 'acme:note': [1, 2] },
                source: { template: 'buildr/hero', version: 1 },
                visibleIf: expr('1 + 1 > 1'),
                children: [{ id: nid('leaf'), type: 'test/probe' }],
              },
            ],
          },
        ],
      },
      { components: { 'buildr/section': 1, 'buildr/stack': 1 } },
    );
    const { doc: after } = load(before);
    for (const id of [nid('outer'), nid('inner')]) {
      const was = before.nodes[id];
      const now = after?.nodes[id];
      const { type: _t, props: _p, styles: _s, ...otherWas } = was ?? {};
      const { type: _t2, props: _p2, styles: _s2, ...otherNow } = now ?? {};
      expect(otherNow).toEqual(otherWas);
      expect(now?.type).toBe('buildr/container');
    }
    expect(after?.nodes[nid('outer')]?.slots).toEqual({ default: [nid('inner')] });
    expect(after?.nodes[nid('inner')]?.slots).toEqual({ default: [nid('leaf')] });
    expect(after?.nodes[nid('leaf')]).toEqual(before.nodes[nid('leaf')]);
    expect(after?.nodes[nid('outer')]?.props?.['ariaLabel']).toEqual(s('Hero'));
  });

  describe('section gap (the section had none)', () => {
    const run = (styles?: NodeStyles) =>
      containerReplaces['buildr/section'].migrate(
        { props: {}, styles },
        { nodeId: 'x', subtree: new Map() },
      ).styles;

    it('writes gap 0 when no gap is set', () => {
      expect(run()).toEqual({ base: { layout: { gap: '0' } } });
      expect(run({ base: { layout: { direction: 'row' } } })).toEqual({
        base: { layout: { direction: 'row', gap: '0' } },
      });
    });

    it('keeps a base gap, row gap and column gap', () => {
      const withGap = { base: { layout: { gap: '2rem' } } };
      expect(run(withGap)).toBe(withGap);
      const both = { base: { layout: { rowGap: '1rem', columnGap: '2rem' } } };
      expect(run(both)).toBe(both);
    });

    it('fills only the missing one of row gap and column gap', () => {
      expect(run({ base: { layout: { rowGap: '1rem' } } })).toEqual({
        base: { layout: { rowGap: '1rem', columnGap: '0' } },
      });
      expect(run({ base: { layout: { columnGap: '1rem' } } })).toEqual({
        base: { layout: { columnGap: '1rem', rowGap: '0' } },
      });
    });

    it('never touches breakpoints or states, and keeps every other style', () => {
      const styles: NodeStyles = {
        base: { spacing: { padding: { top: '2rem' } }, background: { color: '$color.primary' } },
        bp: {
          tablet: { layout: { gap: '1rem' } },
          mobile: { layout: { display: 'block', direction: 'row' } },
        },
        state: { hover: { background: { color: '$color.primary' } } },
      };
      expect(run(styles)).toEqual({
        ...styles,
        base: { ...styles.base, layout: { gap: '0' } },
      });
    });

    it('does not mutate its input', () => {
      const styles: NodeStyles = { base: { layout: { rowGap: '1rem' } } };
      const copy = structuredClone(styles);
      run(styles);
      expect(styles).toEqual(copy);
    });
  });

  describe('section width', () => {
    const widthOf = (container?: unknown) =>
      containerReplaces['buildr/section'].migrate(
        {
          props: container === undefined ? {} : { container: container as never },
          styles: undefined,
        },
        { nodeId: 'x', subtree: new Map() },
      ).props?.['width'];

    it.each([
      ['full', 'none'],
      ['sm', 'sm'],
      ['md', 'md'],
      ['lg', 'lg'],
      ['xl', 'xl'],
    ])('maps %s to %s', (from, to) => {
      expect(widthOf(s(from))).toEqual(s(to));
    });

    it('falls back to lg for a missing or unreadable value', () => {
      expect(widthOf()).toEqual(s('lg'));
      expect(widthOf(s('huge'))).toEqual(s('lg'));
      expect(widthOf(bind('post.width'))).toEqual(s('lg'));
    });

    it('drops the old `container` prop', () => {
      const { props } = containerReplaces['buildr/section'].migrate(
        { props: { container: s('md') }, styles: undefined },
        { nodeId: 'x', subtree: new Map() },
      );
      expect(props).not.toHaveProperty('container');
    });
  });

  describe('background image', () => {
    const data = createMemoryDataSource({ media: imageFixtureMedia });
    const stored = (backgroundImage: unknown): BuilderDocument =>
      doc(
        {
          children: [{ id: nid('x'), type: 'buildr/section', props: { backgroundImage } as never }],
        },
        { components: { 'buildr/section': 1 } },
      );

    it('draws a static image of a stored section', async () => {
      const ref = s({ source: 'fixtures', collection: 'media', id: 'm1' });
      const { html, diagnostics } = await render(registry, stored(ref), data);
      expect(diagnostics).toEqual([]);
      expect(html).toContain('data-has-background=""');
      expect(html).toMatch(/<img [^>]*class="bc-container__background"[^>]*>/);
      expect(html).toMatch(/<img [^>]*src="\/media\/cat\.jpg"[^>]*alt=""/);
    });

    it('draws a bound image of a stored section, and keeps the binding in the document', async () => {
      const value = bind('post.cover');
      expect(load(stored(value)).doc?.nodes[nid('x')]?.props?.['backgroundImage']).toEqual(value);
      const { html, diagnostics } = await render(registry, stored(value), data, {
        post: { cover: imageFixtureMedia.m1 },
      });
      expect(diagnostics).toEqual([]);
      expect(html).toContain('data-has-background=""');
      expect(html).toMatch(/<img [^>]*src="\/media\/cat\.jpg"/);
    });

    it('draws nothing when the binding resolves to nothing', async () => {
      const { html } = await render(registry, stored(bind('post.cover')), data, { post: {} });
      expect(html).not.toContain('bc-container__background');
    });
  });

  describe('SSR of migrated components', () => {
    /** The markup of the migrated node alone, with generated class hashes and ids normalised. */
    const markup = async (before: NodeTree, components: Record<string, number>) => {
      const { html } = await render(registry, doc({ children: [before] }, { components }));
      const start = html.search(/<(main|div) class="bc-container/);
      return html
        .slice(start)
        .replace(/ b-[\w-]+/g, ' b-x')
        .replace(/<\/div>$/, '');
    };

    it('renders a stored section as a container', async () => {
      const body = await markup(
        {
          id: nid('x'),
          type: 'buildr/section',
          props: { as: s('main'), container: s('md'), ariaLabel: s('Home') },
          children: [{ id: nid('p'), type: 'test/probe' }],
        },
        { 'buildr/section': 1 },
      );
      expect(body).toContain(
        '<main class="bc-container b-x" data-display="flex" data-width="md" data-bleed="" aria-label="Home"><p class="bc-test-probe b-x">probe</p></main>',
      );
      expect(body).toMatchInlineSnapshot(
        `"<main class="bc-container b-x" data-display="flex" data-width="md" data-bleed="" aria-label="Home"><p class="bc-test-probe b-x">probe</p></main>"`,
      );
    });

    it('renders a stored stack as a container', async () => {
      const body = await markup(
        {
          id: nid('s'),
          type: 'buildr/stack',
          props: { role: s('group'), ariaLabel: s('Actions') },
          children: [{ id: nid('p'), type: 'test/probe' }],
        },
        { 'buildr/stack': 1 },
      );
      expect(body).toMatchInlineSnapshot(
        `"<div class="bc-container b-x" data-display="flex" data-width="none" role="group" aria-label="Actions"><p class="bc-test-probe b-x">probe</p></div>"`,
      );
    });

    it('gives a stored section the gap it had: none', async () => {
      const { html } = await render(
        registry,
        doc(
          { children: [{ id: nid('x'), type: 'buildr/section' }] },
          { components: { 'buildr/section': 1 } },
        ),
      );
      expect(html).toMatch(/gap:\s*0\b/);
    });
  });
});
