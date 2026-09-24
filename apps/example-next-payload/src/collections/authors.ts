import type { CollectionConfig } from 'payload';
import { isSignedIn, readAll } from '../access.ts';

/** A public profile, deliberately separate from `users` so the auth collection is never exposed. */
export const Authors: CollectionConfig = {
  slug: 'authors',
  admin: { useAsTitle: 'name' },
  access: { read: readAll, create: isSignedIn, update: isSignedIn, delete: isSignedIn },
  fields: [
    { name: 'name', type: 'text', required: true },
    { name: 'slug', type: 'text', required: true, unique: true, index: true },
    { name: 'avatar', type: 'upload', relationTo: 'media' },
    { name: 'jobTitle', type: 'text', localized: true },
    { name: 'bio', type: 'textarea', localized: true },
    {
      name: 'socials',
      type: 'array',
      fields: [
        { name: 'label', type: 'text', required: true },
        { name: 'url', type: 'text', required: true },
      ],
    },
  ],
};
