import { defineTemplate, s, type TemplateDefinition, type TreeNode } from '@buildr/core';
import { button, grid, heading, section, stack, text } from './build.ts';
import { thumbnail } from './thumbnail.ts';

const field = (type: string, props: Record<string, string | number | boolean>): TreeNode => ({
  type: `buildr/${type}`,
  props: Object.fromEntries(Object.entries(props).map(([key, value]) => [key, s(value)])) as never,
});

/** A message form next to a few words about getting in touch. */
export const Contact: TemplateDefinition = defineTemplate({
  id: 'buildr/contact',
  version: 1,
  label: 'Contact',
  category: 'marketing',
  thumbnail: thumbnail([
    [10, 22, 56, 8],
    [10, 38, 50, 4],
    [10, 46, 44, 4],
    [84, 18, 66, 10, 'media'],
    [84, 34, 66, 10, 'media'],
    [84, 50, 66, 22, 'media'],
    [84, 78, 26, 9, 'action'],
  ]),
  lock: 'none',
  tree: section([
    grid(
      [
        stack(
          [
            heading('Get in touch', 2),
            text('Tell us a little about what you need and we will reply within two working days.'),
          ],
          { base: { layout: { gap: '$space.4' } } },
          { name: 'Intro' },
        ),
        {
          type: 'buildr/form',
          name: 'Contact form',
          props: { ariaLabel: s('Contact us') } as never,
          styles: { base: { layout: { gap: '$space.4' } } } as never,
          children: [
            field('input', { label: 'Name', name: 'name', required: true }),
            field('input', { label: 'Email', name: 'email', type: 'email', required: true }),
            field('textarea', {
              label: 'Message',
              name: 'message',
              required: true,
              maxLength: 2000,
            }),
            field('checkbox', { label: 'Send me a copy', name: 'copy' }),
            button('Send message', { type: 'submit' }),
          ],
        },
      ],
      2,
      1,
      '$space.12',
    ),
  ]),
});
