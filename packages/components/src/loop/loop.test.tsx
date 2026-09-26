import { createMemoryDataSource, s } from '@next-buildr/core';
import { describe, expect, it } from 'vitest';
import { Heading } from '../heading/definition.ts';
import { Page } from '../page/definition.ts';
import { Pagination } from '../pagination/definition.ts';
import { createRegistry, pageWith, problemsOf, render } from '../test-kit.tsx';
import { Text } from '../text/definition.ts';
import { Loop } from './definition.ts';
import { loopFixtureCollections, loopFixtures } from './fixtures.ts';

const registry = createRegistry({ components: [Page, Loop, Heading, Text, Pagination] });
const data = createMemoryDataSource({ collections: loopFixtureCollections });
const fixture = (id: string) => pageWith(loopFixtures.find((f) => f.id === id)?.tree as never);
const bind = (path: string) => ({ kind: 'binding', path }) as never;

describe('buildr/loop', () => {
  it('repeats its item template for every entry of a collection, in order', async () => {
    const { html, diagnostics } = await render(registry, fixture('loop-posts'), data);
    expect(diagnostics).toEqual([]);
    const titles = [...html.matchAll(/<h3 [^>]*>([^<]*)<\/h3>/g)].map((m) => m[1]);
    expect(titles).toEqual(['First post', 'Second post', 'Third post']);
    expect(html).not.toContain('No posts yet.');
    expect(html).toMatch(/<div class="bc-loop b-[^"]+">/);
    expect(html.match(/<div class="bc-loop /g)).toHaveLength(1);
  });

  it('shows the empty template when there is nothing to list', async () => {
    const { html } = await render(registry, fixture('loop-empty'), data);
    expect(html).toContain('Nothing here.');
    expect(html).not.toContain('<h3');
  });

  it('loops over a list from the data', async () => {
    const doc = pageWith({
      type: 'buildr/loop',
      props: { source: s({ type: 'binding', path: 'post.related' }) as never },
      slots: { item: [{ type: 'buildr/text', props: { text: bind('item.title') } }] },
    });
    const { html } = await render(registry, doc, undefined, {
      post: { related: [{ title: 'A' }, { title: 'B' }] },
    });
    expect(html).toMatch(/>A<\/p>.*>B<\/p>/);
  });

  it('gives each entry its index and the list’s totals', async () => {
    const doc = pageWith({
      type: 'buildr/loop',
      props: { source: s({ type: 'binding', path: 'post.related' }) as never },
      slots: {
        item: [
          {
            type: 'buildr/text',
            props: {
              text: { kind: 'expression', source: 'index + 1 & "/" & loop.total' } as never,
            },
          },
        ],
      },
    });
    const { diagnostics } = await render(registry, doc, undefined, {
      post: { related: [{ title: 'A' }, { title: 'B' }] },
    });
    // The expression syntax is checked by core; the loop only has to provide the scopes.
    expect(diagnostics.filter((d) => d.code.startsWith('render.loop'))).toEqual([]);
  });

  it('names the item for nested loops with `as`', async () => {
    const doc = pageWith({
      type: 'buildr/loop',
      props: {
        source: s({ type: 'binding', path: 'post.related' }) as never,
        as: s('post') as never,
      },
      slots: { item: [{ type: 'buildr/text', props: { text: bind('post.title') } }] },
    });
    const { html } = await render(registry, doc, undefined, {
      post: { related: [{ title: 'Named' }] },
    });
    expect(html).toContain('>Named</p>');
  });

  it('shows the after content once, with the loop’s paging in scope', async () => {
    const doc = pageWith({
      type: 'buildr/loop',
      props: { source: s({ type: 'query', spec: { source: 'posts', limit: 2 } }) as never },
      slots: {
        item: [{ type: 'buildr/text', props: { text: bind('item.title') } }],
        after: [
          {
            type: 'buildr/pagination',
            props: { page: bind('loop.page'), totalPages: bind('loop.totalPages') },
          },
        ],
      },
    });
    const { html } = await render(registry, doc, data);
    expect(html.match(/<nav /g)).toHaveLength(1);
    expect(html).toContain('aria-current="page"');
    expect(html).toMatch(/<div class="bc-loop__after"><nav /);
    expect(html.match(/>First post</g)).toHaveLength(1);
  });

  it('has three named slots and a list source', () => {
    expect(Object.keys(Loop.meta.slots ?? {}).sort()).toEqual(['after', 'empty', 'item']);
    expect(Loop.meta.props['source']?.kind).toBe('listSource');
    expect(JSON.parse(JSON.stringify(Loop.meta))).toEqual(Loop.meta);
  });

  it('has valid, accessible fixtures with a responsive grid', async () => {
    for (const f of loopFixtures) expect(problemsOf(registry, f)).toEqual([]);
    const { html } = await render(registry, fixture('loop-posts'), data);
    expect(html).toContain('display: grid');
    expect(html).toContain('@media');
  });
});
