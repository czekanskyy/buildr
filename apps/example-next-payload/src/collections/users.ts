import type { CollectionConfig } from 'payload';
import { isAdmin, isSignedIn } from '../access.ts';
import { MCP_ENABLED } from '../buildr.options.ts';

export const Users: CollectionConfig = {
  slug: 'users',
  // API keys let an agent user connect to the MCP endpoint; only when BUILDR_MCP=1.
  auth: MCP_ENABLED ? { useAPIKey: true } : true,
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
