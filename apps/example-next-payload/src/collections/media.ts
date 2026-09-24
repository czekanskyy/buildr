import type { CollectionConfig } from 'payload';
import { isSignedIn, readAll } from '../access.ts';

export const Media: CollectionConfig = {
  slug: 'media',
  access: { read: readAll, create: isSignedIn, update: isSignedIn, delete: isSignedIn },
  upload: {
    mimeTypes: ['image/*'],
    focalPoint: true,
    imageSizes: [
      { name: 'thumbnail', width: 400 },
      { name: 'card', width: 800 },
      { name: 'hero', width: 1600 },
      { name: 'og', width: 1200, height: 630 },
    ],
  },
  fields: [
    { name: 'alt', type: 'text', required: true, localized: true },
    { name: 'caption', type: 'text', localized: true },
  ],
};
