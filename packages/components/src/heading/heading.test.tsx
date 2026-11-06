import { migrateComponents, parseDocument, runA11y, s } from '@next-buildr/core';
import { doc } from '@next-buildr/test-utils';
import { describe, expect, it } from 'vitest';
import { Container } from '../container/definition.ts';
import { Page } from '../page/definition.ts';
import { createRegistry, pageWith, problemsOf, render } from '../test-kit.tsx';
import { HEADING_LEVELS, HEADING_TAGS, Heading } from './definition.ts';
import { headingFixtures } from './fixtures.ts';

const registry = createRegistry({ components: [Page, Container, Heading] });
const heading = (props: Record<string, unknown>) =>
  pageWith({ type: 'buildr/heading', props: props as never });

describe('buildr/heading', () => {
  it.each(HEADING_LEVELS)('renders h%i with the root attributes and its level', async (level) => {
    const { html } = await render(registry, heading({ text: s('Hi'), level: s(level) }));
    expect(html).toMatch(
      new RegExp(`<h${level} class="bc-heading b-[^"]+" data-level="${level}">Hi</h${level}>`),
    );
  });

  it('is an h2 by default', async () => {
    const { html } = await render(registry, heading({ text: s('Hi') }));
    expect(html).toContain('<h2 ');
  });

  it.each([0, 7, 2.5, 'x'])('still renders a heading for the level %j', async (level) => {
    const { html } = await render(registry, heading({ text: s('Hi'), level: s(level) }));
    expect(html).toMatch(/<h[1-6] /);
    expect(html).not.toContain('<h0');
    expect(html).not.toContain('<h7');
  });

  it('renders h{level} for the default and the explicit heading tag', async () => {
    const dflt = await render(registry, heading({ text: s('Hi'), level: s(3) }));
    const explicit = await render(
      registry,
      heading({ text: s('Hi'), level: s(3), tag: s('heading') }),
    );
    expect(dflt.html).toContain('<h3 ');
    expect(explicit.html).toContain('<h3 ');
  });

  it.each(HEADING_TAGS.filter((t) => t !== 'heading'))(
    'renders a %s without heading semantics',
    async (tag) => {
      const { html } = await render(registry, heading({ text: s('Hi'), level: s(1), tag: s(tag) }));
      expect(html).toMatch(new RegExp(`<${tag} class="bc-heading b-[^"]+">Hi</${tag}>`));
      expect(html).not.toMatch(/<h[1-6]/);
      expect(html).not.toContain('role=');
      expect(html).not.toContain('aria-level');
      expect(html).not.toContain('data-level');
    },
  );

  it('falls back to a heading for an unknown stored tag', async () => {
    const { html } = await render(registry, heading({ text: s('Hi'), tag: s('script') }));
    expect(html).toContain('<h2 ');
    expect(html).not.toContain('<script');
  });

  it('binds the text of a non-heading tag too', async () => {
    const { html } = await render(
      registry,
      heading({ text: { kind: 'binding', path: 'post.title' }, tag: s('p') }),
      undefined,
      { post: { title: 'From data' } },
    );
    expect(html).toContain('>From data</p>');
  });

  it('keeps non-heading tags out of the heading rules', () => {
    const fixture = headingFixtures.find((f) => f.id === 'heading-tags');
    const issues = runA11y(pageWith(fixture?.tree as never), registry.meta, {
      config: { expectH1: 'layout' },
    }).filter((i) => i.ruleId === 'heading-order' || i.ruleId === 'empty-heading');
    expect(issues).toEqual([]);
  });

  it('declares tag as an optional select that defaults to heading (version 2)', () => {
    const tag = Heading.meta.props['tag'];
    expect(tag?.kind).toBe('select');
    expect(tag).toMatchObject({ default: 'heading' });
    expect(Heading.meta.version).toBe(2);
  });

  it('migrates a version 1 heading to version 2 without changing its props', async () => {
    const before = doc(
      {
        children: [
          { id: 'headingaaa', type: 'buildr/heading', props: { text: s('Hi'), level: s(3) } },
        ],
      },
      { components: { 'buildr/heading': 1, 'buildr/page': 1 } },
    );
    const parsed = parseDocument(structuredClone(before));
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.error));
    const migrated = migrateComponents(parsed.value, registry.migrations);
    expect(migrated.readOnlyReasons).toEqual([]);
    expect(migrated.doc.components['buildr/heading']).toBe(2);
    expect(migrated.doc.nodes['headingaaa']?.props).toEqual({ text: s('Hi'), level: s(3) });
  });

  it('binds its text', async () => {
    const { html } = await render(
      registry,
      heading({ text: { kind: 'binding', path: 'post.title' } }),
      undefined,
      { post: { title: 'From data' } },
    );
    expect(html).toContain('>From data</h2>');
  });

  it('escapes its text', async () => {
    const { html } = await render(registry, heading({ text: s('<img src=x onerror=alert(1)>') }));
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
  });

  it('keeps the outline level apart from the look: a level is not a size', async () => {
    const fixture = headingFixtures.find((f) => f.id === 'heading-look-vs-level');
    const { html, diagnostics } = await render(registry, pageWith(fixture?.tree as never));
    expect(diagnostics).toEqual([]);
    expect(html).toContain('<h2 ');
    expect(html).toContain('font-size: 1rem');
    expect(html).toContain('font-size: 0.875rem');
  });

  it('is inline-editable through its text prop', () => {
    expect(Heading.meta.editor?.inlineProp).toBe('text');
    expect(Heading.meta.props['text']?.kind).toBe('text');
    expect(Heading.meta.props['text']?.bindable).toBe(true);
  });

  it('has valid fixtures whose levels do not skip', () => {
    for (const fixture of headingFixtures) {
      expect(problemsOf(registry, fixture)).toEqual([]);
    }
    const levels = headingFixtures.find((f) => f.id === 'heading-levels');
    const issues = runA11y(pageWith(levels?.tree as never), registry.meta, {
      config: { expectH1: 'document' },
    }).filter((i) => i.ruleId === 'heading-order');
    expect(issues).toEqual([]);
  });

  it('has serializable metadata', () => {
    expect(JSON.parse(JSON.stringify(Heading.meta))).toEqual(Heading.meta);
  });
});
