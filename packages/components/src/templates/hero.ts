import { defineTemplate, s, type TemplateDefinition, type TreeNode } from '@buildr/core';
import { button, grid, heading, section, stack, text } from './build.ts';
import { thumbnail } from './thumbnail.ts';

/** The words and the buttons; `centered` puts everything on the middle axis. */
const copy = (centered: boolean): TreeNode =>
  stack(
    [
      heading('A headline that says what you do', 1, {
        bp: {
          tablet: { typography: { fontSize: '$fontSize.4xl' } },
          mobile: { typography: { fontSize: '$fontSize.3xl' } },
        },
      }),
      text('One or two sentences that tell a visitor why it matters and what to do next.'),
      stack(
        [button('Get started', { href: '/contact' }), button('Learn more', { variant: 'outline' })],
        {
          base: {
            layout: {
              direction: 'row',
              wrap: 'wrap',
              gap: '$space.3',
              ...(centered ? { justify: 'center' } : {}),
            },
          },
        },
        { region: 'actions', name: 'Actions' },
      ),
    ],
    {
      base: {
        layout: { gap: '$space.4', justify: 'center', ...(centered ? { align: 'center' } : {}) },
        ...(centered ? { typography: { textAlign: 'center' } } : {}),
      },
    },
    { name: 'Copy' },
  );

const picture = (): TreeNode => ({
  type: 'buildr/image',
  props: { sizes: s('half') } as never,
  name: 'Image',
});

/** Two columns, text and a picture; on a phone the picture goes under the text. */
const split = (imageFirst: boolean): TreeNode =>
  section([
    grid(imageFirst ? [picture(), copy(false)] : [copy(false), picture()], 2, 1, '$space.12', {
      align: 'center',
    }),
  ]);

export const Hero: TemplateDefinition = defineTemplate({
  id: 'buildr/hero',
  version: 1,
  label: 'Hero',
  category: 'marketing',
  thumbnail: thumbnail([
    [10, 30, 60, 8],
    [10, 44, 50, 4],
    [10, 52, 44, 4],
    [10, 66, 22, 9, 'action'],
    [86, 18, 64, 62, 'media'],
  ]),
  lock: 'structure',
  tree: split(true),
  variants: {
    imageRight: split(false),
    centered: section([copy(true)], { container: 'md' }),
  },
});
