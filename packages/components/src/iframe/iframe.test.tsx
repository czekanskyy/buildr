// @vitest-environment jsdom
import { runA11y, s } from '@next-buildr/core';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';
import * as axeMatchers from 'vitest-axe/matchers';
import { Page } from '../page/definition.ts';
import { createRegistry, pageWith, problemsOf, render } from '../test-kit.tsx';
import {
  IFRAME_ASPECT_RATIOS,
  IFRAME_REFERRER_POLICY,
  IFRAME_SANDBOX,
  Iframe,
} from './definition.ts';
import { iframeFixtures } from './fixtures.ts';

expect.extend(axeMatchers);

const registry = createRegistry({ components: [Page, Iframe] });
const iframe = (props: Record<string, unknown> = {}) =>
  pageWith({
    type: 'buildr/iframe',
    props: { url: s('https://embed.test/map'), title: s('Map of our office'), ...props } as never,
  });
const tag = (html: string) => /<iframe [^>]*>/.exec(html)?.[0] ?? '';

function view(props: Record<string, unknown>, env: Record<string, unknown> = {}) {
  const defaults = Object.fromEntries(
    Object.entries(Iframe.meta.props).map(([name, def]) => [name, def.default]),
  );
  return renderToStaticMarkup(
    createElement(Iframe.render as never, {
      props: { ...defaults, title: 'Map', ...props },
      root: { className: 'bc-iframe b-x' },
      slots: {},
      node: { id: 'x', type: 'buildr/iframe' },
      env: { mode: 'production', locale: 'en', messages: {}, ...env },
    }),
  );
}

describe('buildr/iframe', () => {
  it('renders one sandboxed, lazy, referrer-less frame with its title and no permissions', async () => {
    const { html, diagnostics } = await render(registry, iframe());
    expect(diagnostics).toEqual([]);
    const t = tag(html);
    expect(t).toContain('class="bc-iframe b-');
    expect(t).toContain('src="https://embed.test/map"');
    expect(t).toContain('title="Map of our office"');
    expect(t).toContain(`sandbox="${IFRAME_SANDBOX}"`);
    expect(t).toContain(`referrerPolicy="${IFRAME_REFERRER_POLICY}"`);
    expect(t).toContain('loading="lazy"');
    expect(t).toContain('data-ratio="16:9"');
    expect(t).not.toContain(' allow=');
    expect(t).not.toContain('allowFullScreen');
    expect(html.match(/<iframe/g)).toHaveLength(1);
  });

  it('has a sandbox that grants scripts only, and nothing that lifts it', () => {
    expect(IFRAME_SANDBOX.split(' ')).toEqual(['allow-scripts']);
    expect(IFRAME_REFERRER_POLICY).toBe('no-referrer');
    for (const widened of [
      'allow-same-origin',
      'allow-top-navigation',
      'allow-popups',
      'allow-popups-to-escape-sandbox',
      'allow-forms',
      'allow-modals',
      'allow-downloads',
    ]) {
      expect(IFRAME_SANDBOX).not.toContain(widened);
    }
  });

  it('offers no prop that widens the sandbox or grants features', () => {
    expect(Object.keys(Iframe.meta.props).sort()).toEqual(['aspectRatio', 'title', 'url']);
  });

  it('ignores an author title attribute in favour of the accessible name', () => {
    const html = renderToStaticMarkup(
      createElement(Iframe.render as never, {
        props: { url: 'https://embed.test/', title: 'Real name', aspectRatio: '16:9' },
        root: { className: 'bc-iframe', title: 'Sneaky' },
        slots: {},
        node: { id: 'x', type: 'buildr/iframe' },
        env: { mode: 'production', locale: 'en', messages: {} },
      }),
    );
    expect(tag(html)).toContain('title="Real name"');
    expect(html).not.toContain('Sneaky');
  });

  it.each(IFRAME_ASPECT_RATIOS)('marks the %s aspect ratio', (ratio) => {
    expect(view({ url: 'https://embed.test/', aspectRatio: ratio })).toContain(
      `data-ratio="${ratio}"`,
    );
  });

  it('falls back to 16:9 for a ratio that is not an option', () => {
    expect(view({ url: 'https://embed.test/', aspectRatio: 'huge' })).toContain(
      'data-ratio="16:9"',
    );
  });

  describe('URL validation (ADR-028)', () => {
    it.each([
      'http://embed.test/map',
      'javascript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'vbscript:x',
      'https://user:pw@embed.test/map',
      '//embed.test/map',
      '/map',
      'about:blank',
      'not a url',
      `https://embed.test/${'a'.repeat(2100)}`,
    ])('renders nothing for %j in production', (url) => {
      expect(view({ url })).toBe('');
    });

    it('shows an empty frame in the canvas, and says what is wrong with the URL', () => {
      expect(view({ url: '' }, { mode: 'canvas' })).toBe(
        '<div class="bc-iframe b-x" data-empty=""></div>',
      );
      expect(view({ url: 'http://embed.test/' }, { mode: 'canvas' })).toContain(
        'data-embed-invalid="not-https"',
      );
    });

    it('applies the host allowlist on every render', () => {
      const capabilities = { iframeHosts: ['embed.test'] };
      expect(view({ url: 'https://embed.test/a' }, { capabilities })).toContain('<iframe');
      expect(view({ url: 'https://www.embed.test/a' }, { capabilities })).toContain('<iframe');
      expect(view({ url: 'https://evil.test/a' }, { capabilities })).toBe('');
      expect(view({ url: 'https://embed.test.evil.test/a' }, { capabilities })).toBe('');
      expect(view({ url: 'https://evil.test/a' }, { capabilities: { iframeHosts: [] } })).toBe('');
      expect(
        view({ url: 'https://evil.test/a' }, { capabilities: { externalMediaHosts: ['x.test'] } }),
      ).toContain('<iframe');
    });
  });

  it('is escaped', async () => {
    const { html } = await render(registry, iframe({ title: s('"><script>alert(1)</script>') }));
    expect(html).not.toContain('<script>');
  });

  describe('fixtures', () => {
    it.each(iframeFixtures.map((f) => [f.id, f] as const))('%s is valid', (_id, f) => {
      expect(problemsOf(registry, f)).toEqual([]);
    });

    it('has no accessibility violations on the rendered markup', async () => {
      for (const f of iframeFixtures.filter((x) => x.id !== 'iframe-empty')) {
        const { html } = await render(registry, pageWith(f.tree));
        const host = window.document.createElement('div');
        host.innerHTML = html;
        window.document.body.replaceChildren(host);
        const result = await axe(host, {
          iframes: false,
          rules: { 'color-contrast': { enabled: false }, region: { enabled: false } },
        });
        expect(result.violations.map((v) => `${f.id}: ${v.id}`)).toEqual([]);
      }
    });
  });

  describe('metadata', () => {
    const { meta } = Iframe;

    it('is a media component, version 1, named by its title', () => {
      expect(meta.version).toBe(1);
      expect(meta.category).toBe('media');
      expect(meta.label).toBe('Iframe');
      expect(meta.a11y).toEqual({ element: 'iframe', requiresName: true });
    });

    it('does not trip the core a11y rules on a named frame', () => {
      expect(runA11y(iframe(), registry.meta).filter((i) => i.severity === 'error')).toEqual([]);
    });

    it('is serializable', () => {
      expect(JSON.parse(JSON.stringify(meta))).toEqual(meta);
    });
  });
});
