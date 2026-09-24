import { createMemoryDataSource, defaultTheme, runA11y, s, validateDocument } from '@buildr/core';
import { describe, expect, it } from 'vitest';
import { Button } from '../button/definition.ts';
import { Heading } from '../heading/definition.ts';
import { Image } from '../image/definition.ts';
import { imageFixtureMedia } from '../image/fixtures.ts';
import { Page } from '../page/definition.ts';
import { createRegistry, pageWith, problemsOf, render } from '../test-kit.tsx';
import { Text } from '../text/definition.ts';
import { CARD_VARIANTS, Card } from './definition.ts';
import { cardFixtures } from './fixtures.ts';

const registry = createRegistry({ components: [Page, Card, Heading, Text, Button, Image] });
const card = (props: Record<string, unknown> = {}, slots: Record<string, unknown[]> = {}) =>
  pageWith({ type: 'buildr/card', props: props as never, slots: slots as never });
const fixture = (id: string) => pageWith(cardFixtures.find((f) => f.id === id)?.tree as never);
const cardHtml = (html: string) => html.slice(html.indexOf('<article'), html.indexOf('</article>'));

describe('buildr/card', () => {
  it('renders an article with media, body and actions regions', async () => {
    const { html, diagnostics } = await render(registry, fixture('card-basic'));
    expect(diagnostics).toEqual([]);
    expect(html).toMatch(/<article class="bc-card b-[^"]+" data-variant="outlined">/);
    for (const region of ['media', 'body', 'actions']) {
      expect(html).toContain(`<div class="bc-card__${region}">`);
    }
    expect(html).toContain('>A card</h3>');
    expect(html).toContain('bc-button__label">Learn more<');
    expect(html).not.toContain('bc-card__link');
    expect(html).not.toContain('data-linked');
  });

  it('puts an image in the media region', async () => {
    const doc = card(
      {},
      {
        media: [
          {
            type: 'buildr/image',
            props: { image: s({ source: 'fixtures', collection: 'media', id: 'm1' }) },
          },
        ],
      },
    );
    const { html } = await render(
      registry,
      doc,
      createMemoryDataSource({ media: imageFixtureMedia }),
    );
    expect(html).toMatch(/<div class="bc-card__media"><img /);
  });

  it.each(CARD_VARIANTS)('supports the %s variant', async (variant) => {
    const { html } = await render(registry, card({ variant: s(variant) }));
    expect(html).toContain(`data-variant="${variant}"`);
  });

  it('is an article or a div, and nothing else', async () => {
    expect((await render(registry, card({ as: s('div') }))).html).toMatch(/<div class="bc-card /);
    const evil = await render(registry, card({ as: s('script') }));
    expect(evil.html).toMatch(/<article class="bc-card /);
    expect(evil.html).not.toContain('<script');
  });

  describe('as a link', () => {
    it('is one stretched anchor with its own name, empty of content', async () => {
      const { html } = await render(registry, fixture('card-linked'));
      expect(html).toContain('data-linked=""');
      const anchors = [...html.matchAll(/<a [^>]*>.*?<\/a>/g)].map((m) => m[0]);
      expect(anchors).toHaveLength(1);
      expect(anchors[0]).toContain('href="/posts/a-post"');
      expect(anchors[0]).toContain('class="bc-card__link"');
      expect(anchors[0]).toContain('Read: A post');
      // The card's own content is not inside the link.
      expect(anchors[0]).not.toContain('<h3');
      expect(anchors[0]).not.toContain('excerpt');
    });

    it('keeps a button in the actions outside the link: nothing interactive is nested', async () => {
      const { html } = await render(registry, fixture('card-linked-with-action'));
      const anchor = /<a [^>]*class="bc-card__link"[^>]*>.*?<\/a>/.exec(html)?.[0] ?? '';
      expect(anchor).not.toContain('<button');
      expect(html).toMatch(/<div class="bc-card__actions"><button /);
      const issues = runA11y(fixture('card-linked-with-action'), registry.meta);
      expect(issues.map((i) => i.ruleId)).not.toContain('nested-interactive');
    });

    it('raises the actions above the link layer in CSS', async () => {
      const { readFileSync } = await import('node:fs');
      const css = readFileSync(new URL('./styles.css', import.meta.url), 'utf8');
      expect(css).toMatch(/\.bc-card__actions\s*{[^}]*z-index:\s*1/);
      expect(css).toMatch(/\.bc-card__link::after\s*{[^}]*inset:\s*0/);
    });

    it('opens a new tab safely and says so', async () => {
      const { html } = await render(
        registry,
        card({ href: s('https://example.com'), linkLabel: s('Example'), newTab: s(true) }),
      );
      expect(html).toContain('target="_blank"');
      expect(html).toContain('rel="noopener noreferrer"');
      expect(html).toContain('aria-label="Example (opens in a new tab)"');
    });

    it.each(['javascript:alert(1)', 'data:text/html,x', 'java\tscript:x'])(
      'never links to %j',
      async (href) => {
        const { html } = await render(registry, card({ href: s(href), linkLabel: s('x') }));
        expect(html).not.toContain('bc-card__link');
        expect(html).not.toContain('javascript');
      },
    );

    it('binds its link', async () => {
      const { html } = await render(
        registry,
        card({
          href: { kind: 'binding', path: 'post.url' },
          linkLabel: { kind: 'binding', path: 'post.title' },
        }),
        undefined,
        { post: { url: '/blog/x', title: 'X' } },
      );
      expect(html).toContain('href="/blog/x"');
      expect(html).toContain('>X</a>');
    });
  });

  it('only takes media in the media slot, flow content in the body and interactive content in the actions', () => {
    const wrongPlace = card({}, { actions: [{ type: 'buildr/text' }] });
    const { issues } = validateDocument(wrongPlace, {
      registry: registry.meta,
      theme: defaultTheme,
    });
    expect(issues.length).toBeGreaterThan(0);
    const fine = fixture('card-basic');
    expect(validateDocument(fine, { registry: registry.meta, theme: defaultTheme }).issues).toEqual(
      [],
    );
  });

  it('has valid, accessible fixtures with a mobile override', async () => {
    for (const f of cardFixtures) expect(problemsOf(registry, f)).toEqual([]);
    const { html, diagnostics } = await render(registry, fixture('card-flat-div'));
    expect(diagnostics).toEqual([]);
    expect(html).toContain('@media');
    expect(cardHtml(html)).toBeDefined();
  });

  it('has serializable metadata', () => {
    expect(JSON.parse(JSON.stringify(Card.meta))).toEqual(Card.meta);
  });
});
