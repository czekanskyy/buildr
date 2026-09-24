import { BUILT_IN_MESSAGES } from '@buildr/components';
import { createBuildrConfig, createNextPlatform } from '@buildr/next';
import { createPayloadDataSource } from '@buildr/payload/data';
import config from '@payload-config';
import { getPayload } from 'payload';
import { contextNames, queryable } from './buildr.options.ts';
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
    }),
  messages: (locale) => (BUILT_IN_MESSAGES as Record<string, Record<string, string>>)[locale],
  onError: (error) => console.error('[buildr]', error),
});

export const getPayloadClient = () => getPayload({ config });
