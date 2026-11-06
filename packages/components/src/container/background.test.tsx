import { readFileSync } from 'node:fs';
import { createMemoryDataSource, s, type TreeNode } from '@next-buildr/core';
import { doc } from '@next-buildr/test-utils';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { imageFixtureMedia } from '../image/fixtures.ts';
import { Page } from '../page/definition.ts';
import { createRegistry, Probe, render } from '../test-kit.tsx';
import { videoFixtureMedia } from '../video/fixtures.ts';
import {
  BACKGROUND_ATTACHMENTS,
  BACKGROUND_FITS,
  BACKGROUND_POSITIONS,
  Container,
  OVERLAY_TONES,
} from './definition.ts';

const registry = createRegistry({ components: [Page, Container, Probe] });
const data = createMemoryDataSource({ media: { ...imageFixtureMedia, ...videoFixtureMedia } });
const lib = (id: string) => s({ source: 'fixtures', collection: 'media', id }) as never;

const inPage = (props: Record<string, unknown>) =>
  doc(
    {
      type: 'buildr/page',
      children: [
        { type: 'buildr/container', props: props as never, children: [{ type: 'test/probe' }] },
      ] as TreeNode[] as never,
    },
    { components: { 'buildr/container': Container.meta.version } },
  );

/** The view on its own, to set what a document cannot: the render mode and the host's capabilities. */
function view(
  props: Record<string, unknown>,
  env: Record<string, unknown> = {},
  mediaOf: Record<string, unknown> = {},
) {
  const defaults = Object.fromEntries(
    Object.entries(Container.meta.props).map(([name, def]) => [name, def.default]),
  );
  return renderToStaticMarkup(
    createElement(Container.render as never, {
      props: { ...defaults, ...mediaOf, ...props },
      root: { className: 'bc-container b-x' },
      slots: {},
      node: { id: 'x', type: 'buildr/container' },
      env: { mode: 'production', locale: 'en', messages: {}, ...env },
    }),
  );
}

describe('container background media that is not a resolved library asset (ADR-028)', () => {
  const raw = (url: string) => s({ url } as never) as never;
  const unresolved = (url: string) =>
    s({
      source: 'fixtures',
      collection: 'media',
      id: 'not-prepared',
      snapshot: { url, mimeType: 'image/png' },
    }) as never;

  it.each([
    ['backgroundImage', raw('http://tracker.evil/p.gif')],
    ['backgroundImage', raw('//tracker.evil/p.gif')],
    ['backgroundImage', unresolved('http://tracker.evil/p.gif')],
    ['backgroundVideo', raw('//tracker.evil/v.mp4')],
    ['backgroundVideo', unresolved('http://tracker.evil/v.mp4')],
    ['backgroundPoster', raw('http://tracker.evil/p.gif')],
  ])('does not render %s from %j', async (name, value) => {
    const { html } = await render(registry, inPage({ [name]: value }), data);
    expect(html).not.toContain('tracker.evil');
  });
});

describe('container background media', () => {
  describe('video', () => {
    it('is muted, looping, inline and without controls, hidden from assistive technology', async () => {
      const { html, diagnostics } = await render(
        registry,
        inPage({ backgroundVideo: lib('v1'), backgroundPoster: lib('m1') }),
        data,
      );
      expect(diagnostics).toEqual([]);
      const video = /<video [^>]*>/.exec(html)?.[0] ?? '';
      expect(video).toContain('src="/media/cat.mp4"');
      expect(video).toContain('autoPlay=""');
      expect(video).toContain('muted=""');
      expect(video).toContain('loop=""');
      expect(video).toContain('playsInline=""');
      expect(video).toContain('aria-hidden="true"');
      expect(video).toContain('tabindex="-1"');
      expect(video).toContain('poster="/media/cat.jpg"');
      expect(video).not.toContain('controls');
      expect(html).toContain('data-has-video=""');
      expect(html).toContain('data-has-background=""');
    });

    it('keeps the poster as an image under the video, for reduced motion', async () => {
      const { html } = await render(
        registry,
        inPage({ backgroundVideo: lib('v1'), backgroundPoster: lib('m1') }),
        data,
      );
      expect(html.indexOf('bc-container__still')).toBeGreaterThan(-1);
      expect(html.indexOf('bc-container__still')).toBeLessThan(html.indexOf('<video'));
    });

    it('uses the background image as the poster when there is none', async () => {
      const { html } = await render(
        registry,
        inPage({ backgroundVideo: lib('v1'), backgroundImage: lib('m1') }),
        data,
      );
      expect(html).toContain('poster="/media/cat.jpg"');
    });

    it('wraps all media in one aria-hidden layer before the content', async () => {
      const { html } = await render(registry, inPage({ backgroundVideo: lib('v1') }), data);
      expect(html).toMatch(/<span class="bc-container__media" aria-hidden="true"/);
      expect(html.indexOf('<video')).toBeLessThan(html.indexOf('>probe<'));
    });
  });

  describe('overlay and placement', () => {
    it.each(OVERLAY_TONES)('marks the %s overlay tone', async (tone) => {
      const { html } = await render(
        registry,
        inPage({ backgroundImage: lib('m1'), overlayTone: s(tone) }),
        data,
      );
      expect(html).toContain(`data-overlay="${tone}"`);
    });

    it('shows a scrim without any image, and carries its strength as a custom property', () => {
      const html = view({ overlayTone: 'dark', overlayOpacity: 0.4 });
      expect(html).toContain('data-has-background=""');
      expect(html).toContain('style="--bc-overlay-opacity:0.4"');
    });

    it.each([
      [7, '1'],
      [-3, '0'],
      ['strong', '0.5'],
      [Number.NaN, '0.5'],
    ])('clamps the overlay strength %j to %s', (value, expected) => {
      expect(view({ overlayTone: 'dark', overlayOpacity: value })).toContain(
        `--bc-overlay-opacity:${expected}`,
      );
    });

    it('draws an overlay image above the media', async () => {
      const { html } = await render(
        registry,
        inPage({ backgroundImage: lib('m1'), backgroundOverlay: lib('m1') }),
        data,
      );
      expect(html.indexOf('bc-container__overlay-image')).toBeGreaterThan(
        html.indexOf('bc-container__still'),
      );
    });

    it.each(BACKGROUND_FITS)('marks the %s fit', (fit) => {
      expect(view({ backgroundImage: { url: '/a.jpg' }, backgroundFit: fit })).toContain(
        `data-fit="${fit}"`,
      );
    });
    it.each(BACKGROUND_POSITIONS)('marks the %s position', (position) => {
      expect(view({ backgroundImage: { url: '/a.jpg' }, backgroundPosition: position })).toContain(
        `data-position="${position}"`,
      );
    });
    it.each(BACKGROUND_ATTACHMENTS)('marks the %s attachment', (attachment) => {
      expect(
        view({ backgroundImage: { url: '/a.jpg' }, backgroundAttachment: attachment }),
      ).toContain(`data-attachment="${attachment}"`);
    });

    it('falls back to the defaults for a value that is not an option', () => {
      const html = view({
        backgroundImage: { url: '/a.jpg' },
        backgroundFit: 'stretch',
        backgroundPosition: 'middle',
        backgroundAttachment: 'sticky',
        overlayTone: 'red',
      });
      expect(html).toContain('data-fit="cover"');
      expect(html).toContain('data-position="center"');
      expect(html).toContain('data-attachment="scroll"');
      expect(html).toContain('data-overlay="none"');
    });
  });

  describe('external sources (ADR-028)', () => {
    it('draws an external image as a plain img that sends no referrer, and marks it', () => {
      const html = view({ backgroundImage: { external: true, url: 'https://cdn.test/hero.jpg' } });
      expect(html).toMatch(/<img [^>]*src="https:\/\/cdn\.test\/hero\.jpg"[^>]*alt=""/);
      expect(html).toContain('referrerPolicy="no-referrer"');
      expect(html).toContain('data-external-media=""');
    });

    it('marks a library image as not external', async () => {
      const { html } = await render(registry, inPage({ backgroundImage: lib('m1') }), data);
      expect(html).not.toContain('data-external-media');
    });

    it('plays an external video the same silent way', () => {
      const html = view({
        backgroundVideo: {
          external: true,
          url: 'https://cdn.test/loop.mp4',
          mimeType: 'video/mp4',
        },
      });
      const video = /<video [^>]*>/.exec(html)?.[0] ?? '';
      expect(video).toContain('src="https://cdn.test/loop.mp4"');
      expect(video).toContain('muted=""');
      expect(video).not.toContain('controls');
      expect(html).toContain('data-external-media=""');
    });

    it.each([
      'http://cdn.test/hero.jpg',
      'javascript:alert(1)',
      'data:image/svg+xml,<svg/>',
      'https://user:pw@cdn.test/hero.jpg',
      '//cdn.test/hero.jpg',
      '/local/hero.jpg',
      '',
    ])('does not render the external URL %j', (url) => {
      const html = view({
        backgroundImage: { external: true, url },
        backgroundVideo: { external: true, url },
      });
      expect(html).not.toContain('<img');
      expect(html).not.toContain('<video');
      expect(html).not.toContain('data-has-background');
    });

    it('renders only what the host allowlist permits, and says why in the canvas', () => {
      const props = { backgroundImage: { external: true, url: 'https://evil.test/hero.jpg' } };
      const capabilities = { externalMediaHosts: ['cdn.test'] };
      expect(view(props, { capabilities })).not.toContain('<img');
      expect(view(props, { capabilities, mode: 'canvas' })).toContain(
        'data-media-invalid="host-not-allowed"',
      );
      expect(view(props, { capabilities })).not.toContain('data-media-invalid');
      const allowed = { backgroundImage: { external: true, url: 'https://eu.cdn.test/hero.jpg' } };
      expect(view(allowed, { capabilities })).toContain('src="https://eu.cdn.test/hero.jpg"');
    });

    it('does not let a library asset URL be a script URL', () => {
      const html = view({ backgroundImage: { id: 'x', url: 'javascript:alert(1)', mimeType: '' } });
      expect(html).not.toContain('javascript:');
      expect(html).not.toContain('<img');
    });
  });

  describe('styles', () => {
    const css = readFileSync(new URL('./styles.css', import.meta.url), 'utf8');

    it('hides the video and unfixes the background under reduced motion', () => {
      const motion = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
      expect(motion).toMatch(/\.bc-container__video\s*\{\s*display:\s*none/);
      expect(motion).toContain('[data-attachment="fixed"]');
      expect(motion).toMatch(/position:\s*absolute/);
    });

    it('draws a fixed background by pinning it inside a clipped layer', () => {
      expect(css).toMatch(/\[data-attachment="fixed"\][^{]*\{[^}]*position:\s*fixed/);
      expect(css).toMatch(/\.bc-container__media\s*\{[^}]*clip-path:\s*inset\(0\)/);
    });

    it('builds the scrim from theme tokens, never a colour literal', () => {
      expect(css).toContain('var(--b-color-text)');
      expect(css).toContain('var(--b-color-surface)');
      expect(css).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(/i);
    });
  });
});
