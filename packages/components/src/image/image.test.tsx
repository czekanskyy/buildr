import { createMemoryDataSource, runA11y, s } from '@next-buildr/core';
import type { Platform } from '@next-buildr/react';
import { describe, expect, it } from 'vitest';
import { Page } from '../page/definition.ts';
import { Stack } from '../stack/definition.ts';
import { createRegistry, pageWith, problemsOf, render } from '../test-kit.tsx';
import { Image } from './definition.ts';
import { imageFixtureMedia, imageFixtures } from './fixtures.ts';
import { buildSrcSet, objectPosition, safeUrl } from './source.ts';
import { ImageView } from './view.tsx';

const registry = createRegistry({ components: [Page, Stack, Image] });
const data = createMemoryDataSource({ media: imageFixtureMedia });
const ref = (id = 'm1') => s({ source: 'fixtures', collection: 'media', id }) as never;
const image = (props: Record<string, unknown> = {}) =>
  pageWith({ type: 'buildr/image', props: { image: ref(), ...props } as never });
const imgTag = (html: string) =>
  /<img [^>]*>/.exec(html.slice(html.indexOf('<div class="bc-page')))?.[0];

describe('buildr/image', () => {
  it('renders one img through the platform, with the asset’s data', async () => {
    const { html, diagnostics } = await render(registry, image(), data);
    expect(diagnostics).toEqual([]);
    const tag = imgTag(html) ?? '';
    expect(tag).toContain('src="/media/cat.jpg"');
    expect(tag).toContain('alt="A cat"');
    expect(tag).toContain('width="1600"');
    expect(tag).toContain('height="900"');
    expect(tag).toContain('class="bc-image b-');
    expect(tag).toContain('sizes="100vw"');
    // React writes the attribute as `srcSet`; HTML attribute names are case-insensitive.
    expect(tag).toContain(
      'srcSet="/media/cat-400.jpg 400w, /media/cat-800.jpg 800w, /media/cat.jpg 1600w"',
    );
  });

  it('turns the focal point into object-position', async () => {
    const { html } = await render(registry, image(), data);
    expect(imgTag(html)).toContain('style="object-position:25% 50%"');
  });

  describe('alternative text', () => {
    it('defaults to the one stored with the media asset', async () => {
      expect(imgTag((await render(registry, image(), data)).html)).toContain('alt="A cat"');
    });

    it('is the author’s when there is one', async () => {
      const { html } = await render(registry, image({ alt: s('A tabby asleep') }), data);
      expect(imgTag(html)).toContain('alt="A tabby asleep"');
    });

    it('is empty for a decorative image, whatever else is set', async () => {
      const { html } = await render(
        registry,
        image({ decorative: s(true), alt: s('Ignored') }),
        data,
      );
      expect(imgTag(html)).toContain('alt=""');
      expect(imgTag(html)).toContain('role="presentation"');
      expect(html).not.toContain('Ignored');
    });

    it('is escaped', async () => {
      const { html } = await render(
        registry,
        image({ alt: s('"><script>alert(1)</script>') }),
        data,
      );
      expect(html).not.toContain('<script>');
    });

    it('is judged by the image-alt rule: blank and not decorative is an error', () => {
      const ids = (props: Record<string, unknown>) =>
        runA11y(image(props), registry.meta).map((i) => i.ruleId);
      expect(ids({ alt: s('') })).toContain('image-alt');
      expect(ids({ alt: s(''), decorative: s(true) })).not.toContain('image-alt');
      expect(ids({ alt: s('A cat') })).not.toContain('image-alt');
      expect(ids({})).not.toContain('image-alt');
    });
  });

  describe('sizes', () => {
    it.each([
      ['full', '100vw'],
      ['half', '(min-width: 768px) 50vw, 100vw'],
      ['third', '(min-width: 768px) 33vw, 100vw'],
      ['quarter', '(min-width: 768px) 25vw, 100vw'],
    ])('the %s preset gives the sizes attribute', async (preset, sizes) => {
      const { html } = await render(registry, image({ sizes: s(preset) }), data);
      expect(imgTag(html)).toContain(`sizes="${sizes}"`);
    });

    it('falls back to full width for an unknown preset', async () => {
      const { html } = await render(registry, image({ sizes: s('huge') }), data);
      expect(imgTag(html)).toContain('sizes="100vw"');
    });
  });

  it.each(['cover', 'contain', 'fill', 'none', 'scale-down'])('supports fit %s', async (fit) => {
    const { html } = await render(registry, image({ fit: s(fit) }), data);
    expect(imgTag(html)).toContain(`data-fit="${fit}"`);
  });

  it('falls back to cover for an unknown fit', async () => {
    const { html } = await render(registry, image({ fit: s('evil"') }), data);
    expect(imgTag(html)).toContain('data-fit="cover"');
  });

  describe('a missing or unusable image', () => {
    it('renders nothing on a published page, and reports the missing media', async () => {
      const { html, diagnostics } = await render(registry, image({}), createMemoryDataSource());
      expect(html).not.toContain('<img');
      expect(diagnostics.map((d) => d.code)).toContain('render.media-missing');
    });

    it('renders nothing without an image', async () => {
      const { html } = await render(registry, pageWith({ type: 'buildr/image' }));
      expect(html).not.toContain('<img');
      expect(html).not.toContain('data-empty');
    });

    it.each([
      'javascript:alert(1)',
      'data:image/svg+xml,<svg onload=alert(1)>',
      'java\tscript:alert(1)',
    ])('never renders the unsafe URL %j', async (url) => {
      const bad = createMemoryDataSource({
        media: { m1: { id: 'm1', url, alt: 'x', mimeType: 'image/png' } },
      });
      const { html } = await render(registry, image({}), bad);
      expect(html).not.toContain('<img');
      expect(html).not.toContain('javascript');
      expect(html).not.toContain('data:image');
    });

    it('shows an empty-state placeholder in the editor canvas only', () => {
      const props = {
        image: null,
        alt: '',
        decorative: false,
        sizes: 'full',
        fit: 'cover',
        priority: false,
      };
      const view = (mode: 'canvas' | 'production') =>
        ImageView({
          props: props as never,
          root: { className: 'bc-image b-x' },
          slots: {},
          node: { id: 'x', type: 'buildr/image' },
          env: { mode, locale: 'en', messages: {} },
        });
      expect(view('production')).toBeNull();
      const placeholder = view('canvas') as { type: string; props: Record<string, unknown> } | null;
      expect(placeholder?.type).toBe('div');
      expect(placeholder?.props['data-empty']).toBe('');
    });
  });

  describe('through the platform', () => {
    const captured: Record<string, unknown>[] = [];
    const platform: Platform = {
      Link: () => null,
      Image: (received) => {
        captured.push(received);
        return null;
      },
      formAction: () => '',
    };
    const view = (props: Record<string, unknown>, withPlatform = true) =>
      ImageView({
        props: {
          image: { id: 'm1', url: '/a.jpg', mimeType: 'image/jpeg', width: 100, height: 50 },
          alt: '',
          decorative: false,
          sizes: 'full',
          fit: 'cover',
          priority: false,
          ...props,
        } as never,
        root: { className: 'bc-image b-x' },
        slots: {},
        node: { id: 'x', type: 'buildr/image' },
        env: { mode: 'production', locale: 'en', messages: {} },
        ...(withPlatform ? { platform } : {}),
      }) as { type: unknown; props: Record<string, unknown> };

    it('hands the platform image its priority', () => {
      expect(view({ priority: true }).type).toBe(platform.Image);
      expect(view({ priority: true }).props['priority']).toBe(true);
      expect(view({}).props['priority']).toBeUndefined();
    });

    it('falls back to a lazy img, or an eager one for priority, without a platform', () => {
      const lazy = view({}, false);
      expect(lazy.type).toBe('img');
      expect(lazy.props['loading']).toBe('lazy');
      expect(lazy.props['priority']).toBeUndefined();
      expect(view({ priority: true }, false).props['loading']).toBe('eager');
    });
  });

  it('has valid, accessible fixtures whose media is in the media library', async () => {
    for (const fixture of imageFixtures) {
      expect(problemsOf(registry, fixture)).toEqual([]);
      const { html, diagnostics } = await render(registry, pageWith(fixture.tree as never), data);
      expect(diagnostics, fixture.id).toEqual([]);
      expect(html, fixture.id).toContain('<img');
    }
  });

  it('has serializable metadata', () => {
    expect(JSON.parse(JSON.stringify(Image.meta))).toEqual(Image.meta);
    expect(Image.meta.props['image']?.bindable).toBe(true);
    expect(Image.meta.props['decorative']?.kind).toBe('boolean');
  });
});

describe('image sources', () => {
  const size = (url: string, width: number) => ({ url, width, height: width });

  it('builds a srcset, narrowest first, with the original', () => {
    expect(
      buildSrcSet({
        url: '/o.jpg',
        width: 1200,
        sizes: { big: size('/b.jpg', 800), small: size('/s.jpg', 400) },
      }),
    ).toBe('/s.jpg 400w, /b.jpg 800w, /o.jpg 1200w');
  });

  it('keeps one source per width', () => {
    expect(
      buildSrcSet({
        url: '/o.jpg',
        width: 800,
        sizes: { a: size('/a.jpg', 800), b: size('/s.jpg', 400) },
      }),
    ).toBe('/s.jpg 400w, /a.jpg 800w');
  });

  it('leaves out unsafe URLs and unusable widths, and gives nothing for fewer than two sources', () => {
    expect(
      buildSrcSet({ url: '/o.jpg', width: 800, sizes: { x: size('javascript:alert(1)', 400) } }),
    ).toBeUndefined();
    expect(
      buildSrcSet({ url: '/o.jpg', width: 800, sizes: { x: size('/x.jpg', 0) } }),
    ).toBeUndefined();
    expect(buildSrcSet({ url: '/o.jpg', width: 800 })).toBeUndefined();
  });

  it('accepts only safe URLs', () => {
    expect(safeUrl('/a.jpg')).toBe('/a.jpg');
    expect(safeUrl('https://cdn.example.com/a.jpg')).toBe('https://cdn.example.com/a.jpg');
    for (const bad of ['', '  ', 'javascript:x', 'data:image/png;base64,AAAA', undefined, 5]) {
      expect(safeUrl(bad)).toBeUndefined();
    }
  });

  it('turns a focal point into object-position, and ignores a bad one', () => {
    expect(objectPosition({ x: 0.5, y: 0.5 })).toBe('50% 50%');
    expect(objectPosition({ x: 0, y: 1 })).toBe('0% 100%');
    expect(objectPosition({ x: 1.5, y: 0.5 })).toBeUndefined();
    expect(objectPosition({ x: Number.NaN, y: 0.5 })).toBeUndefined();
    expect(objectPosition(undefined)).toBeUndefined();
  });
});
