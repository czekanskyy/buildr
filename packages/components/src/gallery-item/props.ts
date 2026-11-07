import { p } from '@next-buildr/core';
export const galleryItemProps = {
  image: p.media({ accept: ['image'], bindable: true }),
  alt: p.text({ default: '', localizable: true, bindable: true }),
  caption: p.text({ default: '', localizable: true, bindable: true }),
} as const;
