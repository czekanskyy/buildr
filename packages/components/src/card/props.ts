import { p } from '@next-buildr/core';

export const CARD_VARIANTS = ['outlined', 'elevated', 'flat'] as const;
export const CARD_ELEMENTS = ['article', 'div'] as const;

export const cardProps = {
  /** Makes the whole card a link (a stretched link: see the CSS). */
  href: p.link({ label: 'Link', bindable: true }),
  /** Names the card's link for assistive technology; needed when there is a `href`. */
  linkLabel: p.text({ label: 'Link name', bindable: true, localizable: true }),
  newTab: p.boolean({ label: 'Open in a new tab', default: false }),
  variant: p.select({ label: 'Variant', options: CARD_VARIANTS, default: 'outlined' }),
  as: p.select({ label: 'Element', options: CARD_ELEMENTS, default: 'article' }),
} as const;
