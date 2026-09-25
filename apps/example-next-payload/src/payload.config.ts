import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { revalidateHooks } from '@buildr/payload/next';
import { buildrPlugin } from '@buildr/payload/plugin';
import { postgresAdapter } from '@payloadcms/db-postgres';
import { sqliteAdapter } from '@payloadcms/db-sqlite';
import { seoPlugin } from '@payloadcms/plugin-seo';
import { lexicalEditor } from '@payloadcms/richtext-lexical';
import { buildConfig } from 'payload';
import sharp from 'sharp';
import {
  MCP_ENABLED,
  MCP_RATE_LIMIT,
  pluginAccess,
  pluginCollections,
  queryable,
} from './buildr.options.ts';
import { DEFAULT_LOCALE, LOCALES, registry } from './buildr.registry.ts';
import { Authors } from './collections/authors.ts';
import { Categories, ProductCategories } from './collections/categories.ts';
import { Media } from './collections/media.ts';
import { Pages } from './collections/pages.ts';
import { Posts } from './collections/posts.ts';
import { Products } from './collections/products.ts';
import { Users } from './collections/users.ts';
import { SiteSettings } from './globals/site-settings.ts';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const hooks = revalidateHooks();

// Postgres when DATABASE_URL is set, otherwise a local SQLite file: `pnpm dev:example` needs nothing else.
const db = process.env['DATABASE_URL']
  ? postgresAdapter({ pool: { connectionString: process.env['DATABASE_URL'] } })
  : sqliteAdapter({ client: { url: process.env['SQLITE_URL'] ?? 'file:./buildr-example.db' } });

const withRevalidation = <T extends { hooks?: Record<string, unknown> }>(config: T): T => ({
  ...config,
  hooks: {
    ...config.hooks,
    afterChange: [...hooks.collection.afterChange],
    afterDelete: [...hooks.collection.afterDelete],
  },
});

export default buildConfig({
  secret: process.env['PAYLOAD_SECRET'] ?? 'dev-only-secret-change-me',
  db,
  editor: lexicalEditor(),
  sharp,
  localization: { locales: [...LOCALES], defaultLocale: DEFAULT_LOCALE, fallback: true },
  admin: { user: Users.slug, importMap: { baseDir: dirname } },
  collections: [
    Users,
    Media,
    Authors,
    Categories,
    ProductCategories,
    withRevalidation(Pages),
    withRevalidation(Posts),
    withRevalidation(Products),
  ],
  globals: [{ ...SiteSettings, hooks: { afterChange: [...hooks.global.afterChange] } }],
  // The generated types would narrow `collection: string` inside @buildr/payload's sources, which type-check with this app.
  typescript: { autoGenerate: false },
  plugins: [
    seoPlugin({
      collections: ['pages', 'posts', 'products'],
      uploadsCollection: 'media',
      tabbedUI: false,
    }),
    buildrPlugin({
      registry,
      routes: { editor: '/buildr/edit', canvas: '/buildr/canvas', preview: '/buildr/preview' },
      collections: pluginCollections,
      globals: { site: 'site-settings' },
      queryable,
      media: { collection: 'media' },
      forms: { enabled: true, notifyAllowlist: [] },
      access: pluginAccess,
      a11y: { publish: 'warn' },
      mcp: {
        enabled: MCP_ENABLED,
        ...(MCP_RATE_LIMIT === undefined ? {} : { rateLimit: MCP_RATE_LIMIT }),
      },
    }),
  ],
});
