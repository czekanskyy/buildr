import { s } from '@next-buildr/core';
import { describe, expect, it } from 'vitest';
import { Page } from '../page/definition.ts';
import { createRegistry, pageWith, problemsOf, render } from '../test-kit.tsx';
import { RichText } from './definition.ts';
import { ARTICLE, richTextFixtures } from './fixtures.ts';

const registry = createRegistry({ components: [Page, RichText] });
const richText = (content: unknown) =>
  pageWith({ type: 'buildr/rich-text', props: { content: content } as never });
const t = (text: string) => ({ type: 'text', version: 1, text, format: 0 });
const root = (...children: unknown[]) => ({ type: 'root', version: 1, children });

describe('buildr/rich-text', () => {
  it('renders every node type inside one div with the root attributes', async () => {
    const { html, diagnostics } = await render(registry, richText(s(ARTICLE)));
    expect(diagnostics).toEqual([]);
    expect(html).toMatch(/<div class="bc-rich-text b-[^"]+"><h2>A heading<\/h2><p>/);
    for (const fragment of [
      '<strong>bold</strong>',
      '<em>italic</em>',
      '<code>code</code>',
      '<a href="https://example.com" data-platform="link">link</a>',
      '<ul><li>One</li><li>Two</li></ul>',
      '<ol><li>First</li><li>Second</li></ol>',
      '<blockquote>A quotation.</blockquote>',
    ]) {
      expect(html.replace(' data-platform="link"', '')).toContain(
        fragment.replace(' data-platform="link"', ''),
      );
    }
  });

  it('renders nothing inside the div for an empty value', async () => {
    const { html } = await render(registry, pageWith({ type: 'buildr/rich-text' }));
    expect(html).toMatch(/<div class="bc-rich-text b-[^"]+"><\/div>/);
  });

  it('binds a rich text value', async () => {
    const { html } = await render(
      registry,
      richText({ kind: 'binding', path: 'post.body' }),
      undefined,
      {
        post: {
          body: root({ type: 'paragraph', version: 1, children: [t('From the CMS')] }) as never,
        },
      },
    );
    expect(html).toContain('<p>From the CMS</p>');
  });

  it('shows a bound plain string as one paragraph, escaped', async () => {
    const { html } = await render(
      registry,
      richText({ kind: 'binding', path: 'post.excerpt' }),
      undefined,
      { post: { excerpt: 'First paragraph.\n\nSecond <b>paragraph</b>.' } },
    );
    expect(html).toContain('<p>First paragraph.\n\nSecond &lt;b&gt;paragraph&lt;/b&gt;.</p>');
  });

  it.each([
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'java\tscript:alert(1)',
  ])('never links to %j', async (url) => {
    const link = { type: 'link', version: 1, url, children: [t('click')] };
    const { html } = await render(
      registry,
      richText(s(root({ type: 'paragraph', version: 1, children: [link] }))),
    );
    expect(html).toContain('<p>click</p>');
    expect(html).not.toContain('<a ');
  });

  it('drops node types it does not know and never passes markup through', async () => {
    const value = root(
      { type: 'script', children: [t('evil')] },
      { type: 'paragraph', version: 1, children: [t('<script>alert(1)</script>')] },
    );
    const { html } = await render(registry, richText(s(value)));
    expect(html).not.toContain('<script');
    expect(html).not.toContain('evil');
    expect(html).toContain('&lt;script&gt;');
  });

  it('has valid, accessible fixtures with a mobile override', async () => {
    for (const fixture of richTextFixtures) expect(problemsOf(registry, fixture)).toEqual([]);
    const narrow = richTextFixtures.find((f) => f.id === 'rich-text-narrow');
    const { html, diagnostics } = await render(registry, pageWith(narrow?.tree as never));
    expect(diagnostics).toEqual([]);
    expect(html).toContain('max-width: 40rem');
    expect(html).toContain('@media');
  });

  it('declares a bindable, localizable rich text prop and serializable metadata', () => {
    const content = RichText.meta.props['content'];
    expect(content?.kind).toBe('richText');
    expect(content?.bindable).toBe(true);
    expect(content?.localizable).toBe(true);
    expect(JSON.parse(JSON.stringify(RichText.meta))).toEqual(RichText.meta);
  });
});
