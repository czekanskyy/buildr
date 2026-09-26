import { p } from '@next-buildr/core';

/** How wide the image is displayed, so the browser can pick a source from the `srcset`. */
export const IMAGE_SIZES = ['full', 'half', 'third', 'quarter'] as const;
export const IMAGE_FITS = ['cover', 'contain', 'fill', 'none', 'scale-down'] as const;

export const imageProps = {
  image: p.media({ label: 'Image', accept: ['image'], bindable: true }),
  /** Overrides the description stored with the image; empty falls back to it. */
  alt: p.text({ label: 'Alternative text', default: '', bindable: true, localizable: true }),
  /** An image that adds no information: it gets an empty `alt` and is skipped by screen readers. */
  decorative: p.boolean({ label: 'Decorative', default: false }),
  sizes: p.select({ label: 'Display width', options: IMAGE_SIZES, default: 'full' }),
  fit: p.select({ label: 'Fit', options: IMAGE_FITS, default: 'cover' }),
  /** Loads first: for the image at the top of the page. */
  priority: p.boolean({ label: 'Load first', default: false }),
} as const;
