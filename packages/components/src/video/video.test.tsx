// @vitest-environment jsdom
import { createMemoryDataSource, runA11y, s } from '@next-buildr/core';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';
import * as axeMatchers from 'vitest-axe/matchers';
import { imageFixtureMedia } from '../image/fixtures.ts';
import { Page } from '../page/definition.ts';
import { createRegistry, pageWith, problemsOf, render } from '../test-kit.tsx';
import { VIDEO_ASPECT_RATIOS, Video } from './definition.ts';
import { videoFixtureMedia, videoFixtures } from './fixtures.ts';

expect.extend(axeMatchers);

const registry = createRegistry({ components: [Page, Video] });
const data = createMemoryDataSource({ media: { ...imageFixtureMedia, ...videoFixtureMedia } });
const lib = (id: string) => s({ source: 'fixtures', collection: 'media', id }) as never;
const video = (props: Record<string, unknown> = {}) =>
  pageWith({
    type: 'buildr/video',
    props: { video: lib('v1'), title: s('A cat yawning'), ...props } as never,
  });
const tag = (html: string) => /<video [^>]*>/.exec(html)?.[0] ?? '';

/** The view on its own, to set what a document cannot: the render mode and the host's capabilities. */
function view(props: Record<string, unknown>, env: Record<string, unknown> = {}) {
  const defaults = Object.fromEntries(
    Object.entries(Video.meta.props).map(([name, def]) => [name, def.default]),
  );
  return renderToStaticMarkup(
    createElement(Video.render as never, {
      props: { ...defaults, title: 'Clip', ...props },
      root: { className: 'bc-video b-x' },
      slots: {},
      node: { id: 'x', type: 'buildr/video' },
      env: { mode: 'production', locale: 'en', messages: {}, ...env },
    }),
  );
}

describe('buildr/video', () => {
  it('renders one video with the library file, a poster, controls and its name', async () => {
    const { html, diagnostics } = await render(registry, video({ poster: lib('m1') }), data);
    expect(diagnostics).toEqual([]);
    const t = tag(html);
    expect(t).toContain('class="bc-video b-');
    expect(t).toContain('src="/media/cat.mp4"');
    expect(t).toContain('poster="/media/cat.jpg"');
    expect(t).toContain('aria-label="A cat yawning"');
    expect(t).toContain('controls=""');
    expect(t).toContain('playsInline=""');
    expect(t).toContain('preload="metadata"');
    expect(t).toContain('data-ratio="16:9"');
    expect(t).not.toContain('autoPlay');
    expect(t).not.toContain('loop');
    expect(t).not.toContain('data-external-media');
  });

  it('supports controls off, loop and muted', async () => {
    const { html } = await render(
      registry,
      video({ controls: s(false), loop: s(true), muted: s(true) }),
      data,
    );
    const t = tag(html);
    expect(t).not.toContain('controls');
    expect(t).toContain('loop=""');
    expect(t).toContain('muted=""');
  });

  describe('autoplay', () => {
    it('is always muted and keeps its controls, so it never plays sound and can be paused', async () => {
      const { html } = await render(
        registry,
        video({ autoplay: s(true), muted: s(false), controls: s(false) }),
        data,
      );
      const t = tag(html);
      expect(t).toContain('autoPlay=""');
      expect(t).toContain('muted=""');
      expect(t).toContain('controls=""');
      expect(t).toContain('playsInline=""');
    });

    it('does not mute or autoplay a video that did not ask for it', () => {
      const t = tag(view({ video: { id: 'v', url: '/v.mp4', mimeType: 'video/mp4' } }));
      expect(t).not.toContain('autoPlay');
      expect(t).not.toContain('muted');
    });
  });

  it.each(VIDEO_ASPECT_RATIOS)('marks the %s aspect ratio', async (ratio) => {
    const { html } = await render(registry, video({ aspectRatio: s(ratio) }), data);
    expect(tag(html)).toContain(`data-ratio="${ratio}"`);
  });

  describe('captions', () => {
    it('adds a captions track, in the given language, named by the built-in label', async () => {
      const { html } = await render(
        registry,
        video({ captions: lib('c1'), captionsLanguage: s('pl') }),
        data,
      );
      expect(html).toMatch(
        /<track kind="captions" src="\/media\/cat\.vtt" srcLang="pl" label="Captions"\/>/,
      );
    });

    it('falls back to the page language when the tag is unusable, and takes the author label', () => {
      const html = view(
        {
          video: { id: 'v', url: '/v.mp4' },
          captions: { id: 'c', url: '/c.vtt' },
          captionsLanguage: 'not a tag!',
          captionsLabel: 'Napisy PL',
        },
        { locale: 'pl' },
      );
      expect(html).toContain('srcLang="pl"');
      expect(html).toContain('label="Napisy PL"');
    });

    it('has no track without captions', async () => {
      expect((await render(registry, video(), data)).html).not.toContain('<track');
    });
  });

  describe('external sources (ADR-028)', () => {
    const ext = { external: true, url: 'https://cdn.test/clip.mp4' };

    it('plays an external HTTPS file and marks it, without a referrer attribute a video does not have', () => {
      const t = tag(view({ video: ext }));
      expect(t).toContain('src="https://cdn.test/clip.mp4"');
      expect(t).toContain('data-external-media=""');
      expect(t.toLowerCase()).not.toContain('referrerpolicy');
      expect(view({ video: ext, captions: ext }).toLowerCase()).not.toContain('referrerpolicy');
    });

    it.each([
      'http://cdn.test/clip.mp4',
      'javascript:alert(1)',
      'https://user:pw@cdn.test/clip.mp4',
      '/clip.mp4',
    ])('renders nothing for %j in production, an empty frame in the canvas', (url) => {
      expect(view({ video: { external: true, url } })).toBe('');
      const canvas = view({ video: { external: true, url } }, { mode: 'canvas' });
      expect(canvas).toContain('data-empty=""');
      expect(canvas).not.toContain('<video');
    });

    it('applies the host allowlist to the file, the poster and the captions', () => {
      const capabilities = { externalMediaHosts: ['cdn.test'] };
      const ok = view(
        { video: ext, poster: { external: true, url: 'https://cdn.test/p.jpg' } },
        { capabilities },
      );
      expect(ok).toContain('poster="https://cdn.test/p.jpg"');
      const blocked = view(
        {
          video: ext,
          poster: { external: true, url: 'https://evil.test/p.jpg' },
          captions: { external: true, url: 'https://evil.test/c.vtt' },
        },
        { capabilities },
      );
      expect(blocked).not.toContain('evil.test');
      expect(
        view(
          { video: { external: true, url: 'https://evil.test/v.mp4' } },
          { capabilities, mode: 'canvas' },
        ),
      ).toContain('data-media-invalid="host-not-allowed"');
    });
  });

  describe('values that the renderer did not resolve from the library (ADR-028)', () => {
    const raw = (url: string) => s({ url } as never) as never;
    const unresolved = (url: string) =>
      s({
        source: 'fixtures',
        collection: 'media',
        id: 'not-prepared',
        snapshot: { url, mimeType: 'video/mp4' },
      }) as never;

    it.each([
      ['an http object', raw('http://tracker.evil/v.mp4')],
      ['a protocol-relative object', raw('//tracker.evil/v.mp4')],
      ['an unresolved reference with an http snapshot', unresolved('http://tracker.evil/v.mp4')],
      [
        'an unresolved reference with a protocol-relative snapshot',
        unresolved('//tracker.evil/v.mp4'),
      ],
    ])('does not play %s', async (_name, value) => {
      const { html } = await render(registry, video({ video: value }), data);
      expect(html).not.toContain('tracker.evil');
      expect(html).not.toContain('<video');
    });

    it('does not use such a poster or captions track beside a real library video', async () => {
      const { html } = await render(
        registry,
        video({
          poster: raw('http://tracker.evil/p.gif'),
          captions: unresolved('//tracker.evil/c.vtt'),
        }),
        data,
      );
      expect(tag(html)).toContain('src="/media/cat.mp4"');
      expect(html).not.toContain('tracker.evil');
    });

    it('still plays an unresolved reference whose snapshot is a same-origin path or an allowed HTTPS URL', async () => {
      const path = await render(registry, video({ video: unresolved('/media/cat.mp4') }), data);
      expect(tag(path.html)).toContain('src="/media/cat.mp4"');
      const https = await render(
        registry,
        video({ video: unresolved('https://cdn.test/clip.mp4') }),
        data,
      );
      expect(tag(https.html)).toContain('src="https://cdn.test/clip.mp4"');
    });
  });

  it('renders nothing without a video in production, an empty frame in the canvas', () => {
    expect(view({})).toBe('');
    expect(view({}, { mode: 'canvas' })).toContain('data-empty=""');
  });

  it('has no aria-label when the name is blank, and the a11y metadata asks for one', () => {
    expect(tag(view({ video: { id: 'v', url: '/v.mp4' }, title: '  ' }))).not.toContain(
      'aria-label',
    );
    expect(Video.meta.a11y).toEqual({ element: 'video', requiresName: true });
  });

  it('is escaped', async () => {
    const { html } = await render(
      registry,
      video({ title: s('"><script>alert(1)</script>') }),
      data,
    );
    expect(html).not.toContain('<script>');
  });

  describe('fixtures', () => {
    it.each(videoFixtures.map((f) => [f.id, f] as const))('%s is valid', (_id, f) => {
      expect(problemsOf(registry, f)).toEqual([]);
    });

    it.each(videoFixtures.map((f) => [f.id, f] as const))(
      '%s renders without diagnostics',
      async (_id, f) => {
        const { diagnostics } = await render(registry, pageWith(f.tree), data);
        expect(diagnostics).toEqual([]);
      },
    );

    it('has no accessibility violations on the rendered markup', async () => {
      for (const f of videoFixtures.filter((x) => x.id !== 'video-empty')) {
        const { html } = await render(registry, pageWith(f.tree), data);
        const host = window.document.createElement('div');
        host.innerHTML = html;
        window.document.body.replaceChildren(host);
        const result = await axe(host, {
          rules: {
            'color-contrast': { enabled: false },
            region: { enabled: false },
            // jsdom has no media: only the markup is judged.
            'video-caption': { enabled: false },
          },
        });
        expect(result.violations.map((v) => `${f.id}: ${v.id}`)).toEqual([]);
      }
    });
  });

  describe('metadata', () => {
    const { meta } = Video;

    it('is a media component with a distinct icon and a placeholder', () => {
      expect(meta.version).toBe(1);
      expect(meta.category).toBe('media');
      expect(meta.icon).toBe('video');
      expect(meta.editor?.placeholder).toBe('Choose a video');
    });

    it('takes library or external video, so it accepts video media', () => {
      const prop = meta.props['video'];
      expect(prop?.kind === 'media' && prop.accept).toEqual(['video']);
      expect(prop?.bindable).toBe(true);
    });

    it('is serializable', () => {
      expect(JSON.parse(JSON.stringify(meta))).toEqual(meta);
    });

    it('does not trip the core a11y rules on a named video', () => {
      expect(runA11y(video(), registry.meta).filter((i) => i.severity === 'error')).toEqual([]);
    });
  });
});
