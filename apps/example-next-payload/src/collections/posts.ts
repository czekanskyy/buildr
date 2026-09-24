import type { CollectionConfig } from 'payload';
import { isSignedIn, readPublished } from '../access.ts';
import { slugField, statusDefaults } from '../fields.ts';

export const Posts: CollectionConfig = {
  slug: 'posts',
  admin: { useAsTitle: 'title', defaultColumns: ['title', 'author', 'publishedAt', '_status'] },
  access: { read: readPublished, create: isSignedIn, update: isSignedIn, delete: isSignedIn },
  ...statusDefaults,
  fields: [
    { name: 'title', type: 'text', required: true, localized: true },
    slugField(),
    { name: 'excerpt', type: 'textarea', localized: true, maxLength: 300 },
    { name: 'featuredImage', type: 'upload', relationTo: 'media' },
    { name: 'author', type: 'relationship', relationTo: 'authors' },
    { name: 'categories', type: 'relationship', relationTo: 'categories', hasMany: true },
    { name: 'publishedAt', type: 'date', admin: { position: 'sidebar' } },
    { name: 'content', type: 'richText', localized: true },
    {
      name: 'readingTime',
      type: 'number',
      admin: { readOnly: true, position: 'sidebar' },
      hooks: {
        beforeChange: [
          ({ siblingData }) => {
            // Words in the text nodes of the Lexical tree, at 200 words per minute.
            const texts = JSON.stringify(siblingData?.['content'] ?? '').match(/"text":"([^"]*)"/g);
            const words = (texts ?? []).join(' ').split(/\s+/).length;
            return Math.max(1, Math.round(words / 200));
          },
        ],
      },
    },
  ],
};
