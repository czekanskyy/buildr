// @vitest-environment jsdom
// biome-ignore-all lint/style/noNonNullAssertion: Fixed test documents.
import { canInsert, canMove, createIndex, extractFragment } from '@next-buildr/core';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';
import { Carousel } from '../carousel/definition.ts';
import { Loop } from '../loop/definition.ts';
import { Page } from '../page/definition.ts';
import { createRegistry, pageWith, problemsOf, render } from '../test-kit.tsx';
import { Text } from '../text/definition.ts';
import { CarouselSlide } from './definition.ts';
import { carouselSlideFixtures } from './fixtures.ts';

const registry = createRegistry({ components: [Page, Carousel, CarouselSlide, Loop, Text] });
describe('buildr/carousel-slide', () => {
  it('renders group semantics, root classes and valid flow content', async () => {
    for (const fixture of carouselSlideFixtures) expect(problemsOf(registry, fixture)).toEqual([]);
    const { html } = await render(registry, pageWith(carouselSlideFixtures[0]!.tree));
    const host = document.createElement('main');
    host.innerHTML = html;
    expect(
      host.querySelector('section')?.outerHTML.replace(/ b-[^" ]+/g, ''),
    ).toMatchInlineSnapshot(
      `"<section class="bc-carousel" aria-roledescription="carousel" aria-label="Carousel"><div class="bc-carousel__controls" hidden=""><button type="button" aria-disabled="true">Previous slide</button><button type="button" aria-disabled="true">Next slide</button><div class="bc-carousel__dots" role="group" aria-label="Choose a slide"></div></div><div class="bc-carousel__track" tabindex="0" data-per-view="1"><div class="bc-carousel-slide" role="group" aria-roledescription="slide"><p class="bc-text"></p></div></div></section>"`,
    );
    expect(
      (await axe(host, { rules: { 'color-contrast': { enabled: false } } })).violations,
    ).toEqual([]);
    expect(html).toMatch(
      /class="bc-carousel-slide b-[^"]+" role="group" aria-roledescription="slide"/,
    );
    expect(CarouselSlide.meta.capabilities?.insertable).toBe(false);
  });
  it('requires a carousel ancestor for insertion and moving through a Loop', () => {
    const doc = pageWith({
      type: 'buildr/carousel',
      children: [{ type: 'buildr/carousel-slide' }, { type: 'buildr/loop' }],
    });
    const index = createIndex(doc);
    const nodes = Object.values(doc.nodes);
    const carousel = nodes.find((n) => n.type === 'buildr/carousel')!;
    const slide = nodes.find((n) => n.type === 'buildr/carousel-slide')!;
    const loop = nodes.find((n) => n.type === 'buildr/loop')!;
    // Slides are scaffolded by their parent; direct insertion is deliberately disabled.
    expect(
      canInsert(
        doc,
        index,
        registry.meta,
        { parentId: carousel.id, slot: 'default' },
        extractFragment(doc, [slide.id]),
      ).ok,
    ).toBe(false);
    expect(
      canInsert(
        doc,
        index,
        registry.meta,
        { parentId: doc.root, slot: 'default' },
        'buildr/carousel-slide',
      ).ok,
    ).toBe(false);
    // Core enforces insertable on cross-slot moves too; integrator follow-up required.
    expect(
      canMove(doc, index, registry.meta, slide.id, { parentId: loop.id, slot: 'item' }).ok,
    ).toBe(false);
    expect(
      canMove(doc, index, registry.meta, loop.id, { parentId: doc.root, slot: 'default' }).ok,
    ).toBe(true);
    const outside = pageWith({
      type: 'buildr/loop',
      slots: { item: [{ type: 'buildr/carousel-slide' }] },
    });
    expect(
      canMove(
        outside,
        createIndex(outside),
        registry.meta,
        Object.values(outside.nodes).find((n) => n.type === 'buildr/carousel-slide')!.id,
        {
          parentId: Object.values(outside.nodes).find((n) => n.type === 'buildr/loop')!.id,
          slot: 'after',
        },
      ).ok,
    ).toBe(false);
  });
});
