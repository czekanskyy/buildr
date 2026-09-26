import { defineTemplate, s, type TemplateDefinition, type TreeNode } from '@next-buildr/core';
import { bind, heading, section, stack, text } from './build.ts';
import { PostCard } from './post-card.ts';
import { thumbnail } from './thumbnail.ts';

/** Posts per page; the query and the pagination agree because both read the same loop. */
const PER_PAGE = 6;

const posts: TreeNode = {
  type: 'buildr/loop',
  name: 'Posts',
  props: {
    source: s({
      type: 'query',
      spec: {
        source: 'posts',
        limit: PER_PAGE,
        sort: [{ field: 'publishedAt', dir: 'desc' }],
        page: bind('route.params.page', { fallback: 1 }),
      },
    }),
  } as never,
  styles: {
    base: { layout: { display: 'grid', columns: 3, gap: '$space.6' } },
    bp: { tablet: { layout: { columns: 2 } }, mobile: { layout: { columns: 1 } } },
  } as never,
  slots: {
    item: [PostCard.tree],
    empty: [text('No posts yet.')],
    after: [
      {
        type: 'buildr/pagination',
        props: {
          page: bind('loop.page'),
          totalPages: bind('loop.totalPages'),
        } as never,
      },
    ],
  },
};

type Tone = 'line' | 'media';

/** A page of posts, newest first: a grid of cards (three, two, one column) and page links. */
export const BlogListing: TemplateDefinition = defineTemplate({
  id: 'buildr/blog-listing',
  version: 1,
  label: 'Blog listing',
  category: 'blog',
  thumbnail: thumbnail([
    [10, 8, 40, 8],
    ...[0, 1, 2].flatMap((col): [number, number, number, number, Tone][] => [
      [10 + col * 50, 26, 44, 52, 'line'],
      [13 + col * 50, 29, 38, 22, 'media'],
    ]),
    [62, 86, 36, 6],
  ]),
  lock: 'none',
  tree: section([stack([heading('Blog', 1), posts], { base: { layout: { gap: '$space.8' } } })]),
});
