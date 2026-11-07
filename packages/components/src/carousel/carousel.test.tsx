// @vitest-environment jsdom
// biome-ignore-all lint/style/noNonNullAssertion: Fixed fixture corpus.

import { readdirSync, readFileSync } from 'node:fs';
import { createMemoryDataSource, s, validatePropValue } from '@next-buildr/core';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';
import { CarouselSlide } from '../carousel-slide/definition.ts';
import { conventionProblems } from '../conventions.test-kit.ts';
import { Loop } from '../loop/definition.ts';
import { Page } from '../page/definition.ts';
import { createRegistry, pageWith, problemsOf, render } from '../test-kit.tsx';
import { Text } from '../text/definition.ts';
import { Carousel } from './definition.ts';
import { carouselFixtures } from './fixtures.ts';
import { carouselProps } from './props.ts';
import { CarouselView } from './view.tsx';

const registry = createRegistry({ components: [Page, Carousel, CarouselSlide, Text, Loop] });

describe('buildr/carousel', () => {
  it('renders accessible SSR with root classes and all slides reachable without JS', async () => {
    const { html, diagnostics } = await render(registry, pageWith(carouselFixtures[0]!.tree));
    expect(diagnostics).toEqual([]);
    const container = document.createElement('main');
    container.innerHTML = html;
    const section = container.querySelector('section')!;
    expect(section.className).toContain('bc-carousel b-');
    expect(section.querySelectorAll('[inert]')).toHaveLength(0);
    expect(section.querySelector('.bc-carousel__track')?.getAttribute('tabindex')).toBe('0');
    expect((await axe(container)).violations).toEqual([]);
  });
  it('validates numeric bounds and clamps resolved bindings', async () => {
    expect(validatePropValue(carouselProps.interval, s(2000)).ok).toBe(false);
    expect(validatePropValue(carouselProps.slidesPerView, s(5)).ok).toBe(false);
    const { html } = await render(registry, pageWith(carouselFixtures[2]!.tree), undefined, {
      carousel: {
        ariaLabel: 'Bound carousel',
        showArrows: false,
        showDots: false,
        loop: true,
        autoplay: true,
        interval: 1,
        slidesPerView: 4,
      },
    });
    expect(html).toContain('aria-label="Bound carousel"');
    expect(html).toContain('data-per-view="4"');
    const clamped = renderToStaticMarkup(
      createElement(CarouselView, {
        props: {
          ariaLabel: '',
          showArrows: true,
          showDots: true,
          loop: false,
          autoplay: false,
          interval: 1,
          slidesPerView: 99,
        },
        root: { className: 'bc-carousel', style: { margin: 7 }, 'data-probe': 'yes' },
        env: { mode: 'canvas', locale: 'en', messages: {} },
      } as never),
    );
    expect(clamped).not.toContain('bc-carousel__controls');
    expect(clamped).toContain('data-per-view="4"');
    expect(clamped).toContain('margin:7px');
    expect(clamped).toContain('data-probe="yes"');
  });
  it('has valid fixtures, defaults, serializable compact metadata and directory conventions', () => {
    for (const fixture of carouselFixtures) expect(problemsOf(registry, fixture)).toEqual([]);
    // biome-ignore lint/complexity/useLiteralKeys: TypeScript requires index-signature access.
    expect(Carousel.meta.defaults?.slots?.['default']).toHaveLength(3);
    expect(JSON.parse(JSON.stringify(Carousel.meta))).toEqual(Carousel.meta);
    for (const name of ['carousel', 'carousel-slide']) {
      const relative = `../${name}/`;
      const dir = new URL(relative, import.meta.url);
      const files = Object.fromEntries(
        readdirSync(dir)
          .filter((file) => /\.(ts|tsx|css)$/.test(file))
          .map((file) => [file, readFileSync(new URL(file, dir), 'utf8')]),
      );
      expect(conventionProblems(name, files)).toEqual([]);
    }
  });
});

it.each(carouselFixtures)('SSR snapshot and axe: $id', async (fixture) => {
  const { html, diagnostics } = await render(
    registry,
    pageWith(fixture.tree),
    createMemoryDataSource({
      collections: { slides: [{ title: 'First' }, { title: 'Second' }, { title: 'Third' }] },
    }),
    {
      carousel: {
        ariaLabel: 'Bound carousel',
        showArrows: true,
        showDots: true,
        loop: false,
        autoplay: false,
        interval: 5000,
        slidesPerView: 1,
      },
    },
  );
  expect(diagnostics).toEqual([]);
  const host = document.createElement('main');
  host.innerHTML = html;
  const markup = host.querySelector('section')?.outerHTML.replace(/ b-[^" ]+/g, '');
  if (fixture.id === 'carousel-default')
    expect(markup).toMatchInlineSnapshot(
      `"<section class="bc-carousel" aria-roledescription="carousel" aria-label="Carousel"><div class="bc-carousel__controls" hidden=""><button type="button" aria-disabled="true">Previous slide</button><button type="button" aria-disabled="true">Next slide</button><div class="bc-carousel__dots" role="group" aria-label="Choose a slide"></div></div><div class="bc-carousel__track" tabindex="0" data-per-view="1"><div class="bc-carousel-slide" role="group" aria-roledescription="slide"><p class="bc-text">Slide 1</p></div><div class="bc-carousel-slide" role="group" aria-roledescription="slide"><p class="bc-text">Slide 2</p></div><div class="bc-carousel-slide" role="group" aria-roledescription="slide"><p class="bc-text">Slide 3</p></div></div></section>"`,
    );
  if (fixture.id === 'carousel-bound')
    expect(markup).toMatchInlineSnapshot(
      `"<section class="bc-carousel" aria-roledescription="carousel" aria-label="Bound carousel"><div class="bc-carousel__controls" hidden=""><button type="button" aria-disabled="true">Previous slide</button><button type="button" aria-disabled="true">Next slide</button><div class="bc-carousel__dots" role="group" aria-label="Choose a slide"></div></div><div class="bc-carousel__track" tabindex="0" data-per-view="1"><div class="bc-carousel-slide" role="group" aria-roledescription="slide"></div><div class="bc-carousel-slide" role="group" aria-roledescription="slide"></div></div></section>"`,
    );
  if (fixture.id === 'carousel-autoplay')
    expect(markup).toMatchInlineSnapshot(
      `"<section class="bc-carousel" aria-roledescription="carousel" aria-label="Carousel"><div class="bc-carousel__controls" hidden=""><button type="button" disabled="">Start automatic rotation</button><button type="button" aria-disabled="false">Previous slide</button><button type="button" aria-disabled="false">Next slide</button><div class="bc-carousel__dots" role="group" aria-label="Choose a slide"></div></div><div class="bc-carousel__track" tabindex="0" data-per-view="2"><div class="bc-carousel-slide" role="group" aria-roledescription="slide"><p class="bc-text">Slide 1</p></div><div class="bc-carousel-slide" role="group" aria-roledescription="slide"><p class="bc-text">Slide 2</p></div><div class="bc-carousel-slide" role="group" aria-roledescription="slide"><p class="bc-text">Slide 3</p></div><div class="bc-carousel-slide" role="group" aria-roledescription="slide"><p class="bc-text">Slide 4</p></div></div></section>"`,
    );
  if (fixture.id === 'carousel-loop')
    expect(markup).toMatchInlineSnapshot(
      `"<section class="bc-carousel" aria-roledescription="carousel" aria-label="Carousel"><div class="bc-carousel__controls" hidden=""><button type="button" aria-disabled="true">Previous slide</button><button type="button" aria-disabled="true">Next slide</button><div class="bc-carousel__dots" role="group" aria-label="Choose a slide"></div></div><div class="bc-carousel__track" tabindex="0" data-per-view="1"><div class="bc-loop"><div class="bc-carousel-slide" role="group" aria-roledescription="slide"><p class="bc-text">First</p></div><div class="bc-carousel-slide" role="group" aria-roledescription="slide"><p class="bc-text">Second</p></div><div class="bc-carousel-slide" role="group" aria-roledescription="slide"><p class="bc-text">Third</p></div><div class="bc-loop__after"></div></div></div></section>"`,
    );
  expect((await axe(host, { rules: { 'color-contrast': { enabled: false } } })).violations).toEqual(
    [],
  );
  if (fixture.id === 'carousel-loop')
    expect(host.querySelectorAll('.bc-carousel-slide')).toHaveLength(3);
});
