import { migrateComponents, parseDocument, s } from '@next-buildr/core';
import { doc } from '@next-buildr/test-utils';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Page } from '../page/definition.ts';
import { createRegistry, pageWith, problemsOf, render } from '../test-kit.tsx';
import { TEXT_ELEMENTS, TEXT_MODES, Text } from './definition.ts';
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

  it('is at version 2 with a plain default mode', () => {
    expect(Text.meta.version).toBe(2);
    expect(Text.meta.props['mode']).toMatchObject({ kind: 'select', default: 'plain' });
    expect(TEXT_MODES).toEqual(['plain', 'rich', 'html']);
    expect(Text.meta.props['html']).toMatchObject({ kind: 'textarea', format: 'html' });
  });

  it('migrates a version 1 text to version 2 without changing its props', () => {
    const before = doc(
      { children: [{ id: 'textaaaaaa', type: 'buildr/text', props: { text: s('Hi') } }] },
      { components: { 'buildr/text': 1, 'buildr/page': 1 } },
    );
    const parsed = parseDocument(structuredClone(before));
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.error));
    const migrated = migrateComponents(parsed.value, registry.migrations);
    expect(migrated.readOnlyReasons).toEqual([]);
    expect(migrated.doc.components['buildr/text']).toBe(2);
    expect(migrated.doc.nodes['textaaaaaa']?.props).toEqual({ text: s('Hi') });
  });

  it('renders rich mode as blocks in a div, from the rich value', async () => {
    const fixture = textFixtures.find((f) => f.id === 'text-rich');
    const { html, diagnostics } = await render(registry, pageWith(fixture?.tree as never));
    expect(diagnostics).toEqual([]);
    expect(html).toMatch(/<div class="bc-text b-[^"]+"><p[^>]*>Some <strong[^>]*>bold<\/strong>/);
  });

  describe('html mode (ADR-026)', () => {
    const view = (html: string, capabilities?: unknown) =>
      renderToStaticMarkup(
        createElement(Text.render as never, {
          props: { as: 'p', mode: 'html', text: 'plain fallback', rich: null, html },
          root: { className: 'bc-text b-x' },
          slots: {},
          node: { id: 'x', type: 'buildr/text' },
          env: {
            mode: 'production',
            locale: 'en',
            messages: {},
            ...(capabilities !== undefined ? { capabilities } : {}),
          },
        }),
      );

    it('shows the plain text when the host does not allow author code', () => {
      for (const capabilities of [
        undefined,
        {},
        { authorCode: false },
        { authorCode: 'yes' },
        null,
      ]) {
        expect(view('<b>x</b>', capabilities)).toBe('<p class="bc-text b-x">plain fallback</p>');
      }
    });

    it('renders only the sanitised tree when allowed', () => {
      const out = view(
        '<p onclick="x()">Hi <strong>there</strong><script>alert(1)</script> <a href="javascript:alert(1)">bad</a> <a href="https://example.com" target="_blank">ok</a></p>',
        { authorCode: true },
      );
      expect(out).toBe(
        '<div class="bc-text b-x"><p>Hi <strong>there</strong> <a>bad</a> <a href="https://example.com" target="_blank" rel="noopener noreferrer">ok</a></p></div>',
      );
      expect(out).not.toMatch(/script|onclick|javascript:/);
    });

    it('escapes text that only looks like markup', () => {
      expect(view('1 &lt; 2 &lt;script&gt;', { authorCode: true })).toContain(
        '1 &lt; 2 &lt;script&gt;',
      );
    });
  });
});
