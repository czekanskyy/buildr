import { isJsonValue, p, s } from '@next-buildr/core';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { defineComponent } from '../define/define-component.ts';
import { createRegistry } from '../define/registry.ts';
import { isResolvedMedia, markResolvedMedia } from './media-trust.ts';
import { doc, emptyData, node, options, Page } from './render.test-kit.tsx';
import { renderTree } from './render-tree.ts';

// ADR-028: a component may treat a media value as a library asset only when the renderer resolved it
// from the prepared data. A reference with no prepared asset (its snapshot) and any raw object in the
// document are author data and arrive unmarked.

const seen: unknown[] = [];
const Probe = defineComponent({
  version: 1,
  category: 'content',
  contentCategories: ['flow'],
  styles: { groups: [] },
  type: 'buildr/probe',
  label: 'Probe',
  runtime: 'shared',
  props: { image: p.media({ bindable: true }) },
  render: ({ props }) => {
    seen.push(props.image);
    return null;
  },
});
const registry = createRegistry({ components: [Page, Probe] });

const render = (value: unknown, media: Record<string, never> = {}) => {
  seen.length = 0;
  const d = doc([node(1, 'buildr/probe', { image: s(value as never) })]);
  renderToStaticMarkup(<>{renderTree(d, options({ registry, data: { ...emptyData, media } }))}</>);
  return seen[0];
};

describe('the renderer marks the media it resolved', () => {
  const ref = { source: 'payload', collection: 'media', id: 'm1' };

  it('marks an asset from the prepared data, and it is still plain JSON', () => {
    const asset = { id: 'm1', url: '/a.png', mimeType: 'image/png', alt: 'A' };
    const got = render(ref, { m1: asset } as never);
    expect(JSON.parse(JSON.stringify(got))).toEqual(asset);
    expect(isResolvedMedia(got)).toBe(true);
    expect(isJsonValue(got)).toBe(true);
    expect(JSON.stringify(got)).toBe(JSON.stringify(asset));
  });

  it('does not mark the snapshot of a reference that was not prepared', () => {
    const got = render({ ...ref, snapshot: { url: 'http://tracker.evil/p.gif', mimeType: '' } });
    expect(got).toMatchObject({ id: 'm1', url: 'http://tracker.evil/p.gif' });
    expect(isResolvedMedia(got)).toBe(false);
  });

  it.each([
    ['a raw object with a URL', { url: 'http://tracker.evil/p.gif' }],
    ['a raw external value', { external: true, url: 'https://a.test/x.png' }],
    ['an object that claims to be resolved', { url: 'http://x.test/', resolved: true }],
    ['a reference with an id of an asset that is not prepared', { ...ref, id: 'unknown' }],
  ])('does not mark %s', (_name, value) => {
    expect(isResolvedMedia(render(value))).toBe(false);
  });

  it('ignores keys the media map only inherits', () => {
    expect(isResolvedMedia(render({ ...ref, id: 'toString' }))).toBe(false);
  });
});

describe('markResolvedMedia', () => {
  it('cannot be forged by data from JSON, and is not copied by a JSON round trip', () => {
    const asset = markResolvedMedia({ id: 'a', url: '/a.png' });
    expect(isResolvedMedia(asset)).toBe(true);
    expect(isResolvedMedia({ ...asset })).toBe(true);
    expect(isResolvedMedia(JSON.parse(JSON.stringify(asset)))).toBe(false);
    expect(isResolvedMedia(null)).toBe(false);
    expect(isResolvedMedia('x')).toBe(false);
  });
});
