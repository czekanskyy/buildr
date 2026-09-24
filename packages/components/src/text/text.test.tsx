import { s } from '@buildr/core';
import { describe, expect, it } from 'vitest';
import { Page } from '../page/definition.ts';
import { createRegistry, pageWith, problemsOf, render } from '../test-kit.tsx';
import { TEXT_ELEMENTS, Text } from './definition.ts';
import { textFixtures } from './fixtures.ts';

const registry = createRegistry({ components: [Page, Text] });
const text = (props: Record<string, unknown>) =>
  pageWith({ type: 'buildr/text', props: props as never });

describe('buildr/text', () => {
  it('is a paragraph by default', async () => {
    const { html } = await render(registry, text({ text: s('Hello') }));
    expect(html).toMatch(/<p class="bc-text b-[^"]+">Hello<\/p>/);
  });

  it.each(TEXT_ELEMENTS)('renders as %s', async (as) => {
    const { html } = await render(registry, text({ text: s('Hello'), as: s(as) }));
    expect(html).toMatch(new RegExp(`<${as} class="bc-text b-[^"]+">Hello</${as}>`));
  });

  it.each(['script', 'h1', 'a', 'img', ''])('never renders the element %j', async (as) => {
    const { html } = await render(registry, text({ text: s('Hello'), as: s(as) }));
    expect(html).toMatch(/<p class="bc-text /);
    expect(html).not.toMatch(/<(script|h1|a|img)[ >]/);
  });

  it('binds its text', async () => {
    const { html } = await render(
      registry,
      text({ text: { kind: 'binding', path: 'post.excerpt' } }),
      undefined,
      { post: { excerpt: 'From data' } },
    );
    expect(html).toContain('>From data</p>');
  });

  it('keeps line breaks and escapes markup', async () => {
    const { html } = await render(registry, text({ text: s('one\n<b>two</b>') }));
    expect(html).toContain('one\n&lt;b&gt;two&lt;/b&gt;');
    expect(html).not.toContain('<b>');
  });

  it('is inline-editable through its text prop', () => {
    expect(Text.meta.editor?.inlineProp).toBe('text');
    expect(Text.meta.props['text']?.bindable).toBe(true);
  });

  it('has valid, accessible fixtures with a mobile override', async () => {
    for (const fixture of textFixtures) expect(problemsOf(registry, fixture)).toEqual([]);
    const small = textFixtures.find((f) => f.id === 'text-small');
    const { html, diagnostics } = await render(registry, pageWith(small?.tree as never));
    expect(diagnostics).toEqual([]);
    expect(html).toContain('<small ');
    expect(html).toContain('@media');
  });

  it('has serializable metadata', () => {
    expect(JSON.parse(JSON.stringify(Text.meta))).toEqual(Text.meta);
  });
});
