import { defineTemplate, s, type TemplateDefinition } from '@buildr/core';
import { bind, heading, text } from './build.ts';
import { thumbnail } from './thumbnail.ts';

/**
 * A post as a card, for the `item` slot of a Loop over posts: the whole card links to the post
 * (`item.path`), and is named by its title.
 */
export const PostCard: TemplateDefinition = defineTemplate({
  id: 'buildr/post-card',
  version: 1,
  label: 'Post card',
  category: 'blog',
  thumbnail: thumbnail([
    [40, 8, 80, 84, 'line'],
    [44, 12, 72, 34, 'media'],
    [48, 52, 56, 6],
    [48, 64, 64, 4],
    [48, 72, 48, 4],
  ]),
  lock: 'none',
  tree: {
    type: 'buildr/card',
    props: {
      href: bind('item.path') as never,
      linkLabel: bind('item.title') as never,
      variant: s('outlined'),
    } as never,
    slots: {
      media: [
        {
          type: 'buildr/image',
          props: { image: bind('item.featuredImage'), sizes: s('third') } as never,
          name: 'Featured image',
        },
      ],
      body: [
        heading(bind('item.title'), 3),
        text(bind('item.publishedAt', { format: { type: 'date', style: 'medium' } }), {
          base: { typography: { color: '$color.text-muted', fontSize: '$fontSize.sm' } },
        }),
        text(bind('item.excerpt')),
      ],
    },
  },
});
