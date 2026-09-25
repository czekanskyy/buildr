import { defineComponent } from '@buildr/react';
import { cardProps } from './props.ts';
import { CardView } from './view.tsx';

export { CARD_ELEMENTS, CARD_VARIANTS } from './props.ts';

/**
 * A card with a media region, a body and actions. With a `href` the whole card is clickable
 * through a stretched link: one real anchor, empty except for its name, whose pseudo-element
 * covers the card. Buttons and links in `actions` sit above it, so nothing interactive is nested.
 */
export const Card = defineComponent({
  type: 'buildr/card',
  version: 1,
  label: 'Card',
  description: 'A boxed piece of content with media, text and actions.',
  keywords: ['box', 'tile', 'teaser', 'panel'],
  category: 'ui',
  icon: 'panel-top',
  contentCategories: ['flow'],
  props: cardProps,
  slots: {
    media: { label: 'Media', allow: ['#media'], max: 1, axis: 'vertical' },
    body: { label: 'Body', allow: ['#flow'], axis: 'vertical' },
    actions: { label: 'Actions', allow: ['#interactive'], axis: 'horizontal' },
  },
  styles: {
    groups: ['layout', 'size', 'spacing', 'background', 'border', 'effects', 'visibility'],
  },
  a11y: { element: 'article' },
  editor: {
    emptySlotText: {
      media: 'Add an image',
      body: 'Add a heading and text',
      actions: 'Add a button',
    },
  },
  runtime: 'shared',
  render: CardView,
});
