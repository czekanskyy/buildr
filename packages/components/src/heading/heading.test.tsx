import { runA11y, s } from '@buildr/core';
import { describe, expect, it } from 'vitest';
import { Page } from '../page/definition.ts';
import { Stack } from '../stack/definition.ts';
import { createRegistry, pageWith, problemsOf, render } from '../test-kit.tsx';
import { HEADING_LEVELS, Heading } from './definition.ts';
import { headingFixtures } from './fixtures.ts';

const registry = createRegistry({ components: [Page, Stack, Heading] });
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
