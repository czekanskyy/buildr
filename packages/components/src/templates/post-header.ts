import { defineTemplate, s, type TemplateDefinition } from '@next-buildr/core';
import { bind, heading, section, stack, text } from './build.ts';
import { thumbnail } from './thumbnail.ts';

/** The top of a post: its title (the page's H1), the date, and the featured image. */
export const PostHeader: TemplateDefinition = defineTemplate({
  id: 'buildr/post-header',
  version: 1,
  label: 'Post header',
  category: 'blog',
  thumbnail: thumbnail([
    [30, 12, 100, 9],
    [56, 28, 48, 4],
    [20, 40, 120, 48, 'media'],
  ]),
  lock: 'none',
  tree: section(
    [
      stack(
        [
          heading(bind('post.title', { fallback: 'Untitled' }), 1, {
            bp: {
              tablet: { typography: { fontSize: '$fontSize.4xl' } },
              mobile: { typography: { fontSize: '$fontSize.3xl' } },
            },
          }),
          text(bind('post.publishedAt', { format: { type: 'date', style: 'long' } }), {
            base: { typography: { color: '$color.text-muted' } },
          }),
          {
            type: 'buildr/image',
            props: { image: bind('post.featuredImage'), sizes: s('full') } as never,
            name: 'Featured image',
            styles: {
              base: {
                size: { width: '100%' },
                border: {
                  radius: {
                    topLeft: '$radius.md',
                    topRight: '$radius.md',
                    bottomRight: '$radius.md',
                    bottomLeft: '$radius.md',
                  },
                },
              },
            } as never,
          },
        ],
        { base: { layout: { gap: '$space.4' } } },
      ),
    ],
    { container: 'md' },
  ),
});
