import { runA11y, s } from '@buildr/core';
import { describe, expect, it } from 'vitest';
import { Page } from '../page/definition.ts';
import { Stack } from '../stack/definition.ts';
import { createRegistry, pageWith, problemsOf, render } from '../test-kit.tsx';
import { BUTTON_SIZES, BUTTON_VARIANTS, Button } from './definition.ts';
import { buttonFixtures } from './fixtures.ts';

const registry = createRegistry({ components: [Page, Stack, Button] });
const button = (props: Record<string, unknown> = {}) =>
  pageWith({ type: 'buildr/button', props: props as never });
const body = (html: string) => html.slice(html.indexOf('<div class="bc-page'));

describe('buildr/button', () => {
  it('is a real button of type button by default', async () => {
    const { html } = await render(registry, button());
    expect(body(html)).toMatch(
      /<button class="bc-button b-[^"]+" data-variant="primary" data-size="md" type="button"><span class="bc-button__label">Button<\/span><\/button>/,
    );
  });

  it('can submit', async () => {
    const { html } = await render(registry, button({ type: s('submit') }));
    expect(html).toContain('type="submit"');
  });

  it('is a link through the platform when it has a destination', async () => {
    const { html } = await render(registry, button({ label: s('Go'), href: s('/docs') }));
    expect(body(html)).toContain('<a ');
    expect(body(html)).toContain('href="/docs"');
    expect(body(html)).toContain('class="bc-button ');
    expect(body(html)).not.toContain('<button');
  });

  it.each([
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    'java\tscript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:x',
  ])('never links to %j: it falls back to a plain button', async (href) => {
    const { html } = await render(registry, button({ href: s(href) }));
    expect(body(html)).toContain('<button');
    expect(body(html)).not.toMatch(/href=/);
    expect(body(html)).not.toContain('javascript');
  });

  it('opens a new tab safely and says so to assistive technology', async () => {
    const { html } = await render(
      registry,
      button({ label: s('Docs'), href: s('https://example.com'), newTab: s(true) }),
    );
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('<span class="bc-visually-hidden"> (opens in a new tab)</span>');
  });

  it('puts the new-tab notice into an explicit accessible name instead of hidden text', async () => {
    const { html } = await render(
      registry,
      button({
        label: s(''),
        icon: s('search'),
        href: s('/s'),
        ariaLabel: s('Search'),
        newTab: s(true),
      }),
    );
    expect(html).toContain('aria-label="Search (opens in a new tab)"');
    expect(html).not.toContain('bc-visually-hidden');
  });

  it('draws the icon before or after the label, decoratively', async () => {
    const start = (await render(registry, button({ icon: s('send') }))).html;
    const end = (await render(registry, button({ icon: s('send'), iconPosition: s('end') }))).html;
    expect(body(start).indexOf('<svg')).toBeLessThan(body(start).indexOf('bc-button__label'));
    expect(body(end).indexOf('<svg')).toBeGreaterThan(body(end).indexOf('bc-button__label'));
    expect(body(start)).toContain('aria-hidden="true"');
  });

  it('ignores an icon that does not exist', async () => {
    const { html } = await render(registry, button({ icon: s('nope') }));
    expect(body(html)).not.toContain('<svg');
  });

  it('marks an icon-only button and names it from ariaLabel', async () => {
    const { html } = await render(
      registry,
      button({ label: s(''), icon: s('search'), ariaLabel: s('Search') }),
    );
    expect(body(html)).toContain('data-icon-only');
    expect(body(html)).toContain('aria-label="Search"');
    expect(body(html)).not.toContain('bc-button__label');
  });

  it('requires an accessible name for an icon-only button', () => {
    const unnamed = runA11y(button({ label: s(''), icon: s('search') }), registry.meta);
    expect(unnamed.map((i) => i.ruleId)).toContain('button-name');
    const named = runA11y(
      button({ label: s(''), icon: s('search'), ariaLabel: s('Search') }),
      registry.meta,
    );
    expect(named.map((i) => i.ruleId)).not.toContain('button-name');
  });

  it.each(BUTTON_VARIANTS)('supports the %s variant', async (variant) => {
    const { html } = await render(registry, button({ variant: s(variant) }));
    expect(html).toContain(`data-variant="${variant}"`);
  });

  it.each(BUTTON_SIZES)('supports the %s size', async (size) => {
    const { html } = await render(registry, button({ size: s(size) }));
    expect(html).toContain(`data-size="${size}"`);
  });

  it('falls back for a variant or size it does not know', async () => {
    const { html } = await render(
      registry,
      button({ variant: s('evil"><script>'), size: s('huge') }),
    );
    expect(html).toContain('data-variant="primary"');
    expect(html).toContain('data-size="md"');
    expect(html).not.toContain('<script');
  });

  it('binds its label and link', async () => {
    const { html } = await render(
      registry,
      button({
        label: { kind: 'binding', path: 'cta.text' },
        href: { kind: 'binding', path: 'cta.url' },
      }),
      undefined,
      { cta: { text: 'Buy now', url: '/buy' } },
    );
    expect(html).toContain('>Buy now<');
    expect(html).toContain('href="/buy"');
  });

  it('is interactive, so the content-model rules keep other interactive content out of it', () => {
    expect(Button.meta.contentCategories).toContain('interactive');
    expect(Button.meta.slots).toBeUndefined();
  });

  it('has valid, accessible fixtures', () => {
    for (const fixture of buttonFixtures) expect(problemsOf(registry, fixture)).toEqual([]);
  });

  it('has serializable metadata and inline editing on its label', () => {
    expect(JSON.parse(JSON.stringify(Button.meta))).toEqual(Button.meta);
    expect(Button.meta.editor?.inlineProp).toBe('label');
  });
});
