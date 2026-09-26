import { runA11y, s } from '@next-buildr/core';
import { describe, expect, it } from 'vitest';
import { Page } from '../page/definition.ts';
import { createRegistry, pageWith, problemsOf, render } from '../test-kit.tsx';
import { Link } from './definition.ts';
import { linkFixtures } from './fixtures.ts';

const registry = createRegistry({ components: [Page, Link] });
const link = (props: Record<string, unknown> = {}) =>
  pageWith({ type: 'buildr/link', props: props as never });
const body = (html: string) => html.slice(html.indexOf('<div class="bc-page'));

describe('buildr/link', () => {
  it('renders one anchor through the platform, with the root attributes', async () => {
    const { html } = await render(registry, link({ label: s('About'), href: s('/about') }));
    expect(body(html)).toMatch(/<a [^>]*class="bc-link b-[^"]+"[^>]*>About<\/a>/);
    expect(body(html)).toContain('href="/about"');
  });

  it.each([
    'javascript:alert(1)',
    'JAVASCRIPT:alert(1)',
    'java\nscript:alert(1)',
    'data:text/html;base64,PHNjcmlwdD4=',
    'file:///etc/passwd',
  ])('never links to %j', async (href) => {
    const { html } = await render(registry, link({ href: s(href) }));
    expect(body(html)).not.toContain('javascript');
    expect(body(html)).not.toContain('data:');
    expect(body(html)).not.toContain('file:');
  });

  it.each([
    'https://example.com/a?b=c#d',
    'mailto:a@example.com',
    'tel:+48123456789',
    '#top',
    '/x',
  ])('keeps the safe URL %s', async (href) => {
    const { html } = await render(registry, link({ href: s(href) }));
    expect(html).toContain(`href="${href.replace(/&/g, '&amp;')}"`);
  });

  it('opens a new tab safely, with a hidden notice', async () => {
    const { html } = await render(
      registry,
      link({ label: s('Example'), href: s('https://example.com'), newTab: s(true) }),
    );
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('Example<span class="bc-visually-hidden"> (opens in a new tab)</span>');
  });

  it('does not add target or rel without newTab', async () => {
    const { html } = await render(registry, link({ href: s('https://example.com') }));
    expect(body(html)).not.toContain('target=');
    expect(body(html)).not.toContain('rel=');
  });

  it('uses an explicit accessible name, with the new-tab notice, instead of hidden text', async () => {
    const { html } = await render(
      registry,
      link({ label: s('→'), ariaLabel: s('Next page'), newTab: s(true) }),
    );
    expect(html).toContain('aria-label="Next page (opens in a new tab)"');
    expect(html).not.toContain('bc-visually-hidden');
  });

  it('binds its text and destination', async () => {
    const { html } = await render(
      registry,
      link({
        label: { kind: 'binding', path: 'post.title' },
        href: { kind: 'binding', path: 'post.url' },
      }),
      undefined,
      { post: { title: 'A post', url: '/blog/a-post' } },
    );
    expect(html).toContain('href="/blog/a-post"');
    expect(html).toContain('>A post</a>');
  });

  it('escapes its text', async () => {
    const { html } = await render(registry, link({ label: s('<script>alert(1)</script>') }));
    expect(body(html)).not.toContain('<script');
  });

  it('is named by its text or ariaLabel, and points somewhere', () => {
    const issues = (props: Record<string, unknown>) =>
      runA11y(link(props), registry.meta).map((i) => i.ruleId);
    expect(issues({ label: s('') })).toContain('link-name');
    expect(issues({ label: s(''), ariaLabel: s('Home') })).not.toContain('link-name');
    expect(issues({ href: s('#') })).toContain('link-href');
    expect(issues({ href: s('/x') })).not.toContain('link-href');
  });

  it('is interactive and inline-editable through its label', () => {
    expect(Link.meta.contentCategories).toContain('interactive');
    expect(Link.meta.editor?.inlineProp).toBe('label');
  });

  it('has valid, accessible fixtures', () => {
    for (const fixture of linkFixtures) expect(problemsOf(registry, fixture)).toEqual([]);
  });

  it('has serializable metadata', () => {
    expect(JSON.parse(JSON.stringify(Link.meta))).toEqual(Link.meta);
  });
});
