import type { BuildrPluginOptions } from '@buildr/payload/plugin';
import type { PayloadRequest } from 'payload';
import { canPublish, roleOf } from './access.ts';

/** Agents (docs/mcp.md) are off unless `BUILDR_MCP=1`: they need an API-key user and add a field to every builder document. */
export const MCP_ENABLED = process.env['BUILDR_MCP'] === '1';

/** Shared by the Payload config (the plugin) and the frontend (the data source), so they cannot drift apart. */
export const queryable: Record<string, { fields: string[]; sort: string[] }> = {
  posts: {
    fields: ['title', 'slug', 'publishedAt', 'categories', 'author'],
    sort: ['publishedAt', 'title'],
  },
  products: {
    fields: ['title', 'price', 'categories', 'availability'],
    sort: ['price', 'title'],
  },
};

export const contextNames = { pages: 'page', posts: 'post', products: 'product' } as const;

export const pluginCollections = {
  pages: {
    context: 'page',
    path: (doc: { slug?: string }) => (doc.slug === 'home' ? '/' : `/${doc.slug}`),
    expectH1: true,
  },
  posts: {
    context: 'post',
    path: (doc: { slug?: string }) => `/blog/${doc.slug}`,
    templates: true,
    depth: 1,
    expectH1: true,
  },
  products: {
    context: 'product',
    path: (doc: { slug?: string }) => `/products/${doc.slug}`,
    templates: true,
    depth: 1,
    expectH1: true,
  },
} as unknown as BuildrPluginOptions['collections'];

export const pluginAccess = {
  edit: ({ req }: { req: PayloadRequest }): boolean => Boolean(req.user),
  publish: canPublish,
  unlockTemplates: ({ req }: { req: PayloadRequest }): boolean => roleOf(req) === 'admin',
};
