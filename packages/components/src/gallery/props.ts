import { p } from '@next-buildr/core';
export const galleryProps = {
  ariaLabel: p.text({ default: '', localizable: true, bindable: true }),
  columns: p.number({ default: 3, min: 2, max: 6, step: 1, bindable: true }),
  aspectRatio: p.select({
    options: ['1:1', '4:3', '3:2', '16:9', 'auto'],
    default: '1:1',
    optionLabels: { auto: 'Original' },
  }),
  lightbox: p.boolean({ default: true }),
} as const;
