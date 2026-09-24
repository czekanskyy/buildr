import { bind, type Diagnostic, expr, type JsonValue, queryKey, s } from '@buildr/core';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { withNodeIds } from './instrument.ts';
import { MAX_LOOP_ITEMS } from './loop.ts';
import { dataContext, doc, emptyData, ID, node, options } from './render.test-kit.tsx';
import { renderTree } from './render-tree.ts';

const render = (...args: Parameters<typeof renderTree>) =>
  renderToStaticMarkup(<>{renderTree(...args)}</>);

const posts = [
  { title: 'One', tags: ['a', 'b'] },
  { title: 'Two', tags: ['c'] },
  { title: 'Three', tags: [] },
];

/** A loop over `post.related` whose `item` slot holds one text bound to `item.title`. */
const simpleLoop = (extra: Parameters<typeof node>[3] = {}, props = {}) =>
  doc(
    [
      node(
        1,
        'buildr/loop',
        { source: s({ type: 'binding', path: 'post.related' }), ...props },
        { slots: { item: [ID(2)], empty: [ID(3)] }, ...extra },
      ),
      node(2, 'buildr/text', { text: bind('item.title') }),
      node(3, 'buildr/text', { text: s('Nothing here') }),
    ],
    {},
    [ID(1)],
  );

const withPosts = (list: unknown = posts) =>
  options({ context: dataContext({ post: { related: list as JsonValue } }) });

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Loop in the renderer', () => {
  it('renders the item slot once per entry, under the item scope', () => {
    const out = render(simpleLoop(), withPosts());
    expect(out).toContain('<p class="bc-text b-node000002">One</p>');
    expect(out).toContain('<p class="bc-text b-node000002">Two</p>');
    expect(out).toContain('<p class="bc-text b-node000002">Three</p>');
    expect(out).not.toContain('Nothing here');
  });

  it('gives every instance the same style class', () => {
    const out = render(simpleLoop(), withPosts());
    expect(out.match(/b-node000002/g)).toHaveLength(3);
  });

  it('renders the empty slot, and only that, for an empty list', () => {
    const out = render(simpleLoop(), withPosts([]));
    expect(out).toContain('Nothing here');
    expect(out).not.toContain('b-node000002');
  });

  it('renders the empty slot when the source is unset', () => {
    const unset = doc(
      [
        node(1, 'buildr/loop', {}, { slots: { item: [ID(2)], empty: [ID(3)] } }),
        node(2, 'buildr/text'),
        node(3, 'buildr/text', { text: s('None') }),
      ],
      {},
      [ID(1)],
    );
    expect(render(unset, options())).toContain('None');
  });

  it('exposes index and the as alias', () => {
    const d = doc(
      [
        node(
          1,
          'buildr/loop',
          { source: s({ type: 'binding', path: 'post.related' }), as: s('article') },
          { slots: { item: [ID(2)] } },
        ),
        node(2, 'buildr/text', { text: expr('article.title + " #" + index') }),
      ],
      {},
      [ID(1)],
    );
    const out = render(d, withPosts());
    expect(out).toContain('>One #0<');
    expect(out).toContain('>Three #2<');
  });

  it('does not leak the scopes outside the item slot', () => {
    const d = doc(
      [
        node(
          1,
          'buildr/loop',
          { source: s({ type: 'binding', path: 'post.related' }) },
          { slots: { item: [ID(2)] } },
        ),
        node(2, 'buildr/text', { text: bind('item.title') }),
        node(3, 'buildr/text', { text: bind('item.title', { fallback: 'no item' }) }),
      ],
      {},
      [ID(1), ID(3)],
    );
    expect(render(d, withPosts())).toContain('<p class="bc-text b-node000003">no item</p>');
  });

  it('gives a nested loop over a field its own item', () => {
    const d = doc(
      [
        node(
          1,
          'buildr/loop',
          { source: s({ type: 'binding', path: 'post.related' }) },
          { slots: { item: [ID(2), ID(3)] } },
        ),
        node(2, 'buildr/text', { text: bind('item.title') }),
        node(
          3,
          'buildr/loop',
          { source: s({ type: 'binding', path: 'item.tags' }) },
          { slots: { item: [ID(4)] } },
        ),
        node(4, 'buildr/text', { text: expr('item') }),
      ],
      {},
      [ID(1)],
    );
    const out = render(d, withPosts());
    expect(out).toMatch(/One<\/p><div class="bc-loop b-node000003">.*>a<.*>b<.*<\/div>/);
    expect(out).toContain('>c<');
    expect(out.match(/b-node000004/g)).toHaveLength(3);
  });

  it('suffixes anchors with the instance, and nested instances with the path', () => {
    const d = doc(
      [
        node(
          1,
          'buildr/loop',
          { source: s({ type: 'binding', path: 'post.related' }) },
          { slots: { item: [ID(2), ID(3)] } },
        ),
        node(2, 'buildr/text', { text: bind('item.title') }, { anchor: 'row' }),
        node(
          3,
          'buildr/loop',
          { source: s({ type: 'binding', path: 'item.tags' }) },
          { slots: { item: [ID(4)] } },
        ),
        node(4, 'buildr/text', { text: expr('item') }, { anchor: 'tag' }),
      ],
      {},
      [ID(1)],
    );
    const out = render(d, withPosts());
    expect(out).toContain('id="row-0"');
    expect(out).toContain('id="row-1"');
    expect(out).toContain('id="tag-0-0"');
    expect(out).toContain('id="tag-0-1"');
    expect(out).toContain('id="tag-1-0"');
    const ids = [...out.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('leaves an anchor alone outside a loop', () => {
    const d = doc([node(1, 'buildr/text', {}, { anchor: 'top' })]);
    expect(render(d, options())).toContain('id="top"');
  });

  it('marks instances for the canvas with the shared data-bid and their own data-bi', () => {
    const out = render(simpleLoop(), { ...withPosts(), instrument: withNodeIds });
    expect(out).toContain('data-bid="node000002" data-bi="0"');
    expect(out).toContain('data-bid="node000002" data-bi="1"');
    expect(out).toContain('data-bid="node000002" data-bi="2"');
    // The loop itself is not an instance.
    expect(out).toContain('<div class="bc-loop b-node000001" data-bid="node000001">');
  });

  it('adds no data-bi in production output', () => {
    expect(render(simpleLoop(), withPosts())).not.toContain('data-bi');
  });

  it('keys the instances, so React has nothing to warn about', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(simpleLoop(), withPosts());
    expect(error).not.toHaveBeenCalled();
  });

  describe('a query source', () => {
    const query = { type: 'query', spec: { source: 'posts', limit: 2 } };
    const d = doc(
      [
        node(
          1,
          'buildr/loop',
          { source: s(query) },
          { slots: { item: [ID(2)], after: [ID(3)], empty: [ID(4)] } },
        ),
        node(2, 'buildr/text', { text: bind('item.title') }),
        node(3, 'buildr/text', {
          text: expr('Page {{ loop.page }} of {{ loop.totalPages }} ({{ loop.total }})', {
            mode: 'template',
          }),
        }),
        node(4, 'buildr/text', { text: s('No posts') }),
      ],
      {},
      [ID(1)],
    );

    it('renders the prepared result and lets the after slot read the loop scope', () => {
      const data = {
        ...emptyData,
        queries: {
          [queryKey(ID(1), 'source')]: {
            items: posts.slice(0, 2),
            total: 3,
            page: 1,
            totalPages: 2,
          },
        },
      };
      const out = render(d, options({ data }));
      expect(out).toContain('>One<');
      expect(out).toContain('>Two<');
      expect(out).not.toContain('Three');
      expect(out).toContain('Page 1 of 2 (3)');
      expect(out).not.toContain('No posts');
    });

    it('renders the after slot for an empty result too', () => {
      const data = {
        ...emptyData,
        queries: { [queryKey(ID(1), 'source')]: { items: [], total: 0, page: 1, totalPages: 0 } },
      };
      const out = render(d, options({ data }));
      expect(out).toContain('No posts');
      expect(out).toContain('Page 1 of 0 (0)');
    });

    it('reports a query that was never prepared and shows the empty slot', () => {
      const diagnostics: Diagnostic[] = [];
      const out = render(d, options({ diagnostics }));
      expect(out).toContain('No posts');
      expect(diagnostics.map((x) => x.code)).toContain('render.loop-query-missing');
    });
  });

  describe('a bad source', () => {
    it('reports a path that is not a list', () => {
      const diagnostics: Diagnostic[] = [];
      const out = render(simpleLoop(), { ...withPosts('text'), diagnostics });
      expect(out).toContain('Nothing here');
      expect(diagnostics.map((x) => x.code)).toContain('render.loop-source');
    });

    it('reports a path that is missing', () => {
      const diagnostics: Diagnostic[] = [];
      render(simpleLoop(), { ...options(), diagnostics });
      expect(diagnostics.map((x) => x.code)).toContain('binding.missing');
    });

    it('cuts a list longer than the limit and says so', () => {
      const many = Array.from({ length: MAX_LOOP_ITEMS + 5 }, (_, i) => ({ title: `T${i}` }));
      const diagnostics: Diagnostic[] = [];
      const out = render(simpleLoop(), { ...withPosts(many), diagnostics });
      expect(out.match(/b-node000002/g)).toHaveLength(MAX_LOOP_ITEMS);
      expect(diagnostics.map((x) => x.code)).toContain('render.loop-truncated');
    });
  });
});
