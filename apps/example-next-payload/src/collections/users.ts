import type { CollectionConfig } from 'payload';
import { isAdmin, isSignedIn } from '../access.ts';

export const Users: CollectionConfig = {
  slug: 'users',
  auth: true,
  admin: { useAsTitle: 'email' },
  access: { read: isSignedIn, create: isAdmin, update: isSignedIn, delete: isAdmin },
  fields: [
    { name: 'name', type: 'text' },
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: 'editor',
      options: ['admin', 'editor', 'author'],
      access: { update: ({ req }) => (req.user as { role?: string } | null)?.role === 'admin' },
    },
  ],
};
