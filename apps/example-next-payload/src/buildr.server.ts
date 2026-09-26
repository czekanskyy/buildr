import { BUILT_IN_MESSAGES } from '@next-buildr/components';
import { createBuildrConfig, createNextPlatform } from '@next-buildr/next';
import { createPayloadDataSource } from '@next-buildr/payload/data';
import config from '@payload-config';
import { getPayload } from 'payload';
import { contextNames, pluginCollections, queryable } from './buildr.options.ts';
import { registry, theme } from './buildr.registry.ts';

/** Everything `BuildrPage` needs; built once per server process. */
export const buildr = createBuildrConfig({
  registry,
  theme,
  platform: createNextPlatform(),
  // Called per render: a visitor's read of the published content, through the Local API.
  dataSource: async () =>
    createPayloadDataSource({
      payload: await getPayload({ config }),
      queryable,
      mediaCollection: 'media',
      contextNames,
      // Links to a queried document carry the language, as every public route does.
      itemPath: (collection, doc, locale) => {
        const path = (pluginCollections as Record<string, { path?: (doc: never) => string }>)[
          collection
        ]?.path?.(doc as never);
        return path === undefined ? undefined : `/${locale}${path === '/' ? '' : path}`;
      },
    }),
  messages: (locale) => (BUILT_IN_MESSAGES as Record<string, Record<string, string>>)[locale],
  onError: (error) => console.error('[buildr]', error),
});

export const getPayloadClient = () => getPayload({ config });
