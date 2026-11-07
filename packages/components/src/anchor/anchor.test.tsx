// @vitest-environment jsdom
import { s, validatePropValue } from '@next-buildr/core';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';
import { Page } from '../page/definition.ts';
import { createRegistry, pageWith, problemsOf, render } from '../test-kit.tsx';
import { Anchor } from './definition.ts';
import { anchorFixtures } from './fixtures.ts';
import { anchorProps, isAnchorName } from './props.ts';

const registry = createRegistry({ components: [Page, Anchor] });

describe('buildr/anchor', () => {
  it('renders its SSR snapshot and root attributes', async () => {
    const fixture = anchorFixtures[0];
    if (!fixture) throw new Error('Missing default fixture');
    const { html, diagnostics } = await render(registry, pageWith(fixture.tree));
    expect(diagnostics).toEqual([]);
    expect(html).toContain('class="bc-anchor b-');
    expect(html).toMatchInlineSnapshot(`
      "<style data-precedence="buildr" data-href="buildr-theme-tk3w4rawdgzv">@layer buildr.reset, buildr.tokens, buildr.components, buildr.nodes;
      @layer buildr.tokens {
        :root {
          --b-color-border: #d1d5db;
          --b-color-danger: #b91c1c;
          --b-color-focus: #1d4ed8;
          --b-color-on-primary: #ffffff;
          --b-color-primary: #2563eb;
          --b-color-success: #15803d;
          --b-color-surface: #ffffff;
          --b-color-surface-alt: #f3f4f6;
          --b-color-text: #111827;
          --b-color-text-muted: #4b5563;
          --b-space-0: 0;
          --b-space-1: 0.25rem;
          --b-space-12: 3rem;
          --b-space-16: 4rem;
          --b-space-2: 0.5rem;
          --b-space-24: 6rem;
          --b-space-3: 0.75rem;
          --b-space-4: 1rem;
          --b-space-6: 1.5rem;
          --b-space-8: 2rem;
          --b-radius-full: 9999px;
          --b-radius-lg: 1rem;
          --b-radius-md: 0.5rem;
          --b-radius-none: 0;
          --b-radius-sm: 0.25rem;
          --b-shadow-lg: 0 12px 24px rgb(0 0 0 / 0.16);
          --b-shadow-md: 0 4px 8px rgb(0 0 0 / 0.12);
          --b-shadow-sm: 0 1px 2px rgb(0 0 0 / 0.08);
          --b-font-family-body: system-ui, sans-serif;
          --b-font-family-heading: system-ui, sans-serif;
          --b-font-family-mono: ui-monospace, monospace;
          --b-font-size-2xl: 1.5rem;
          --b-font-size-3xl: 1.875rem;
          --b-font-size-4xl: 2.25rem;
          --b-font-size-5xl: 3rem;
          --b-font-size-lg: 1.125rem;
          --b-font-size-md: 1rem;
          --b-font-size-sm: 0.875rem;
          --b-font-size-xl: 1.25rem;
          --b-font-size-xs: 0.75rem;
          --b-font-weight-bold: 700;
          --b-font-weight-medium: 500;
          --b-font-weight-regular: 400;
          --b-font-weight-semibold: 600;
          --b-line-height-normal: 1.5;
          --b-line-height-relaxed: 1.75;
          --b-line-height-tight: 1.2;
          --b-container-lg: 64rem;
          --b-container-md: 48rem;
          --b-container-sm: 40rem;
          --b-container-xl: 80rem;
          --b-transition-fast: 150ms ease;
          --b-transition-normal: 250ms ease;
        }
      }</style><div class="bc-page b-root"><span class="bc-anchor b-eFFgZRksmP" id="details"></span></div>"
    `);
  });

  it('spreads root attributes and shows canvas hints only in the canvas', () => {
    const view = (mode: string) =>
      renderToStaticMarkup(
        createElement(Anchor.render as never, {
          props: { name: 'details' },
          root: { className: 'custom', 'data-probe': 'yes', style: { opacity: 0.5 } },
          slots: {},
          node: { id: 'x', type: 'buildr/anchor' },
          env: { mode, locale: 'en', messages: {} },
        }),
      );
    expect(view('production')).toContain('class="custom"');
    expect(view('production')).toContain('data-probe="yes"');
    expect(view('production')).toContain('style="opacity:0.5"');
    expect(view('production')).not.toContain('data-canvas');
    expect(view('canvas')).toContain('data-canvas=""');
    expect(view('canvas')).toContain('>#details</span>');
  });

  it('has valid fixtures and serializable metadata', () => {
    for (const fixture of anchorFixtures) expect(problemsOf(registry, fixture)).toEqual([]);
    expect(JSON.parse(JSON.stringify(Anchor.meta))).toEqual(Anchor.meta);
  });

  it('has no accessibility violations', async () => {
    for (const fixture of anchorFixtures) {
      const { html } = await render(registry, pageWith(fixture.tree));
      const host = document.createElement('div');
      host.innerHTML = html;
      document.body.replaceChildren(host);
      const result = await axe(host, {
        rules: { 'color-contrast': { enabled: false }, region: { enabled: false } },
      });
      expect(result.violations).toEqual([]);
    }
  });

  it.each(['', 'bc-reserved', 'Upper', 'a b', '1first', 'a'.repeat(65)])(
    'rejects %j on the site',
    async (name) => {
      expect(isAnchorName(name)).toBe(false);
      const { html } = await render(
        registry,
        pageWith({ type: 'buildr/anchor', props: { name: s(name) } }),
      );
      expect(html).not.toContain('<span');
    },
  );

  it('validates the name type and length and disables dynamic values', () => {
    expect(validatePropValue(anchorProps.name, 12).ok).toBe(false);
    expect(isAnchorName('a'.repeat(65))).toBe(false);
    expect(isAnchorName('a'.repeat(64))).toBe(true);
    expect(anchorProps.name.bindable).toBe(false);
    expect(anchorProps.name.localizable).toBe(false);
  });
});
