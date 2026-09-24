import { defineTemplate, type TemplateDefinition } from '@buildr/core';
import { button, heading, section, stack, text } from './build.ts';
import { thumbnail } from './thumbnail.ts';

/** A band on the brand colour with one message and one action. */
export const Cta: TemplateDefinition = defineTemplate({
  id: 'buildr/cta',
  version: 1,
  label: 'Call to action',
  category: 'marketing',
  thumbnail: thumbnail([
    [0, 20, 160, 60, 'action'],
    [50, 34, 60, 7],
    [40, 47, 80, 4],
    [66, 60, 28, 9],
  ]),
  lock: 'structure',
  tree: section(
    [
      stack(
        [
          heading('Ready to get started?', 2),
          text('Tell people what happens when they click, in one short sentence.'),
          stack(
            [button('Get in touch', { variant: 'secondary', size: 'lg', href: '/contact' })],
            { base: { layout: { direction: 'row', justify: 'center', gap: '$space.3' } } },
            { region: 'actions', name: 'Actions' },
          ),
        ],
        {
          base: {
            layout: { gap: '$space.4', align: 'center' },
            typography: { textAlign: 'center' },
          },
        },
        { name: 'Copy' },
      ),
    ],
    { container: 'md' },
    {
      base: {
        background: { color: '$color.primary' },
        typography: { color: '$color.on-primary' },
      },
    },
  ),
});
