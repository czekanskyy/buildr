import { defineTemplate, s, type TemplateDefinition } from '@buildr/core';
import { bind, section, stack, text } from './build.ts';
import { thumbnail } from './thumbnail.ts';

/** Who wrote the post: the author's picture, name, job title and bio, as a labelled aside. */
export const AuthorBox: TemplateDefinition = defineTemplate({
  id: 'buildr/author-box',
  version: 1,
  label: 'Author box',
  category: 'blog',
  thumbnail: thumbnail([
    [20, 26, 120, 48, 'line'],
    [28, 34, 26, 26, 'media'],
    [64, 36, 46, 5],
    [64, 47, 34, 4],
    [64, 56, 66, 4],
  ]),
  lock: 'none',
  tree: section(
    [
      {
        type: 'buildr/card',
        props: { variant: s('flat'), as: s('div') } as never,
        slots: {
          media: [
            {
              type: 'buildr/image',
              props: { image: bind('post.author.avatar'), sizes: s('quarter') } as never,
              name: 'Avatar',
              styles: {
                base: {
                  size: { width: '4rem', height: '4rem' },
                  border: {
                    radius: {
                      topLeft: '$radius.full',
                      topRight: '$radius.full',
                      bottomRight: '$radius.full',
                      bottomLeft: '$radius.full',
                    },
                  },
                },
              } as never,
            },
          ],
          body: [
            stack(
              [
                text(bind('post.author.name'), {
                  base: { typography: { fontWeight: '$fontWeight.semibold' } },
                }),
                text(bind('post.author.jobTitle'), {
                  base: {
                    typography: { color: '$color.text-muted', fontSize: '$fontSize.sm' },
                  },
                }),
                text(bind('post.author.bio')),
              ],
              { base: { layout: { gap: '$space.1' } } },
              { name: 'About' },
            ),
          ],
        },
      },
    ],
    { container: 'md', ariaLabel: 'About the author', as: 'aside' },
  ),
});
