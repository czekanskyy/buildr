import { defineTemplate, s, type TemplateDefinition } from '@buildr/core';
import { bind, button, formula, grid, heading, section, stack, text } from './build.ts';
import { thumbnail } from './thumbnail.ts';

/** The top of a product page: its pictures next to its title, price and a buy button. */
export const ProductHero: TemplateDefinition = defineTemplate({
  id: 'buildr/product-hero',
  version: 1,
  label: 'Product hero',
  category: 'commerce',
  thumbnail: thumbnail([
    [10, 12, 66, 76, 'media'],
    [88, 16, 56, 8],
    [88, 32, 30, 7],
    [88, 48, 56, 4],
    [88, 56, 48, 4],
    [88, 72, 32, 9, 'action'],
  ]),
  lock: 'none',
  tree: section([
    grid(
      [
        {
          type: 'buildr/loop',
          name: 'Gallery',
          props: { source: s({ type: 'binding', path: 'product.images' }) } as never,
          styles: {
            base: { layout: { display: 'grid', columns: 2, gap: '$space.3' } },
            bp: { mobile: { layout: { columns: 1 } } },
          } as never,
          slots: {
            item: [
              {
                type: 'buildr/image',
                props: { image: bind('item'), sizes: s('half') } as never,
                styles: { base: { size: { width: '100%' } } } as never,
              },
            ],
          },
        },
        stack(
          [
            heading(bind('product.title', { fallback: 'Product' }), 1, {
              bp: {
                tablet: { typography: { fontSize: '$fontSize.4xl' } },
                mobile: { typography: { fontSize: '$fontSize.3xl' } },
              },
            }),
            text(formula('formatCurrency(product.price, product.currency)'), {
              base: { typography: { fontSize: '$fontSize.2xl', fontWeight: '$fontWeight.bold' } },
            }),
            text(bind('product.shortDescription')),
            stack(
              [button('Buy now', { size: 'lg', href: bind('product.buyUrl') })],
              { base: { layout: { direction: 'row', wrap: 'wrap', gap: '$space.3' } } },
              { name: 'Actions' },
            ),
          ],
          { base: { layout: { gap: '$space.4', justify: 'center' } } },
          { name: 'Summary' },
        ),
      ],
      2,
      1,
      '$space.12',
    ),
  ]),
});
