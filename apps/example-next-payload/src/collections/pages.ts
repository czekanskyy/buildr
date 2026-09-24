import type { CollectionConfig } from 'payload';
import { isSignedIn, readPublished } from '../access.ts';
import { slugField, statusDefaults } from '../fields.ts';

export const Pages: CollectionConfig = {
  slug: 'pages',
  admin: { useAsTitle: 'title', defaultColumns: ['title', 'slug', '_status', 'updatedAt'] },
  access: { read: readPublished, create: isSignedIn, update: isSignedIn, delete: isSignedIn },
  ...statusDefaults,
  fields: [
    { name: 'title', type: 'text', required: true, localized: true },
    slugField(),
    { name: 'publishedAt', type: 'date', admin: { position: 'sidebar' } },
  ],
};
