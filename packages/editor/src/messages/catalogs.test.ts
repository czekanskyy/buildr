import { expect, it } from 'vitest';
import { en } from './en.ts';
import { plLabels } from './pl/componentLabels.ts';
import { pl } from './pl.ts';

it('keeps English and Polish catalog key sets identical', () => {
  expect(Object.keys(pl).sort()).toEqual(Object.keys(en).sort());
});

it('provides Polish labels, descriptions and props for PB-160a', () => {
  const props = {
    'buildr/spacer': ['axis', 'size'],
    'buildr/anchor': ['name'],
    'buildr/fieldset': ['disabled', 'legend'],
  };
  for (const [type, names] of Object.entries(props)) {
    expect(plLabels.components[type]).toBeTruthy();
    expect(plLabels.descriptions[type]).toBeTruthy();
    expect(Object.keys(plLabels.props[type] ?? {}).sort()).toEqual(names);
  }
});

it('contains no damaged characters in Polish catalog strings', () => {
  const check = (value: unknown): void => {
    if (typeof value === 'string') {
      // These catalog questions intentionally end with a question mark after a letter.
      const text = /^(?:Opublikować stronę|Usunąć \{count\} (?:blok|bloki|bloków))\?$/u.test(value)
        ? value.slice(0, -1)
        : value;
      expect(text).not.toMatch(/\?\?|\uFFFD|\p{L}\?/u);
    } else if (value && typeof value === 'object') {
      for (const entry of Object.values(value)) check(entry);
    }
  };
  check(pl);
  check(plLabels);
});

it('provides PB-160b labels with carousel and gallery overrides', () => {
  const props = {
    'buildr/carousel': [
      'ariaLabel',
      'autoplay',
      'interval',
      'loop',
      'showArrows',
      'showDots',
      'slidesPerView',
    ],
    'buildr/carousel-slide': [],
    'buildr/gallery': ['ariaLabel', 'aspectRatio', 'columns', 'lightbox'],
    'buildr/gallery-item': ['alt', 'caption', 'image'],
  };
  for (const [type, names] of Object.entries(props)) {
    expect(plLabels.components[type]).toBeTruthy();
    expect(plLabels.descriptions[type]).toBeTruthy();
    expect(Object.keys(plLabels.props[type] ?? {}).sort()).toEqual(names);
  }
  expect(plLabels.props['buildr/carousel']).toMatchObject({ autoplay: 'Automatyczne przewijanie' });
  expect(plLabels.commonProps).toMatchObject({ autoplay: 'Autoodtwarzanie (bez dźwięku)' });
  expect(plLabels.options['buildr/gallery/aspectRatio']).toMatchObject({ auto: 'Oryginalny' });
  expect(plLabels.slots).toMatchObject({ Slides: 'Slajdy' });
});
