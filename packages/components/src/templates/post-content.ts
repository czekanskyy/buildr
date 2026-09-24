import { defineTemplate, type TemplateDefinition } from '@buildr/core';
import { bind, section } from './build.ts';
import { thumbnail } from './thumbnail.ts';

/** The body of a post: the article's rich text, in a reading-width column. */
export const PostContent: TemplateDefinition = defineTemplate({
  id: 'buildr/post-content',
  version: 1,
  label: 'Post content',
  category: 'blog',
  thumbnail: thumbnail([
    [30, 14, 60, 7],
    [30, 30, 100, 4],
    [30, 40, 100, 4],
    [30, 50, 92, 4],
    [30, 66, 100, 4],
    [30, 76, 70, 4],
  ]),
  lock: 'none',
  tree: section(
    [
      {
        type: 'buildr/rich-text',
        props: { content: bind('post.content') } as never,
        name: 'Article',
      },
    ],
    { container: 'sm' },
  ),
});
