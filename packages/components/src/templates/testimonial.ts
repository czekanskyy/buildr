import { defineTemplate, type TemplateDefinition } from '@buildr/core';
import { section, stack, text } from './build.ts';
import { thumbnail } from './thumbnail.ts';

/** A quote with the name and role of the person who said it. */
export const Testimonial: TemplateDefinition = defineTemplate({
  id: 'buildr/testimonial',
  version: 1,
  label: 'Testimonial',
  category: 'marketing',
  thumbnail: thumbnail([
    [30, 26, 100, 6],
    [24, 38, 112, 6],
    [40, 50, 80, 6],
    [62, 68, 36, 4, 'media'],
    [68, 76, 24, 3],
  ]),
  lock: 'none',
  tree: section(
    [
      stack(
        [
          text('“A sentence from a customer that says what changed for them.”', {
            base: { typography: { fontSize: '$fontSize.2xl', lineHeight: 1.4 } },
          }),
          stack(
            [
              text('Customer name', {
                base: { typography: { fontWeight: '$fontWeight.semibold' } },
              }),
              text('Role, Company', {
                base: { typography: { color: '$color.text-muted', fontSize: '$fontSize.sm' } },
              }),
            ],
            { base: { layout: { gap: '$space.1' } } },
            { name: 'Author' },
          ),
        ],
        {
          base: {
            layout: { gap: '$space.6', align: 'center' },
            typography: { textAlign: 'center' },
          },
        },
        { name: 'Quote' },
      ),
    ],
    { container: 'md' },
  ),
});
