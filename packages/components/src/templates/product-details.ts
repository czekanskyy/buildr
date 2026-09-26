import { defineTemplate, s, type TemplateDefinition } from '@next-buildr/core';
import { bind, heading, section, stack, text } from './build.ts';
import { thumbnail } from './thumbnail.ts';

/** What a product is: its description, and its attributes as name and value pairs. */
export const ProductDetails: TemplateDefinition = defineTemplate({
  id: 'buildr/product-details',
  version: 1,
  label: 'Product details',
  category: 'commerce',
  thumbnail: thumbnail([
    [30, 12, 100, 4],
    [30, 22, 100, 4],
    [30, 32, 76, 4],
    [30, 52, 30, 4, 'media'],
    [80, 52, 40, 4],
    [30, 64, 30, 4, 'media'],
    [80, 64, 40, 4],
    [30, 76, 30, 4, 'media'],
    [80, 76, 40, 4],
  ]),
  lock: 'none',
  tree: section(
    [
      stack(
        [
          { type: 'buildr/rich-text', props: { content: bind('product.description') } as never },
          heading('Details', 2),
          {
            type: 'buildr/loop',
            name: 'Attributes',
            props: { source: s({ type: 'binding', path: 'product.attributes' }) } as never,
            styles: {
              base: { layout: { display: 'grid', columns: 1, gap: '$space.2' } },
            } as never,
            slots: {
              item: [
                stack(
                  [
                    text(bind('item.name'), {
                      base: { typography: { fontWeight: '$fontWeight.semibold' } },
                    }),
                    text(bind('item.value')),
                  ],
                  {
                    base: {
                      layout: { direction: 'row', gap: '$space.4', justify: 'space-between' },
                      border: { width: { bottom: '1px' }, style: 'solid', color: '$color.border' },
                      spacing: { padding: { bottom: '$space.2' } },
                    },
                  },
                  { name: 'Attribute' },
                ),
              ],
            },
          },
        ],
        { base: { layout: { gap: '$space.6' } } },
      ),
    ],
    { container: 'md' },
  ),
});
