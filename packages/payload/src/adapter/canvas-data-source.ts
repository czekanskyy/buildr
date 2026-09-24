import type { DataSource } from '@buildr/core';
import {
  type DataMediaRequest,
  type DataQueryRequest,
  dataMediaResponseSchema,
  dataQueryResponseSchema,
} from '../contract.ts';
import { createHttp, expectBody, type HttpOptions } from './http.ts';

/**
 * The `DataSource` of the canvas: queries and media go to the builder API, which answers with the
 * access of the editing user (drafts included). A refused query (not allowlisted, too broad) rejects
 * with an `AdapterError` carrying the server's reason.
 */
export function createPayloadCanvasDataSource(options: HttpOptions): DataSource {
  const http = createHttp(options);
  return {
    async query(spec, ctx) {
      const body: DataQueryRequest = { spec, locale: ctx.locale };
      const reply = await http.send('POST', '/buildr/data/query', { body });
      return expectBody(reply, dataQueryResponseSchema);
    },
    async getMedia(ids, ctx) {
      if (ids.length === 0) return {};
      const body: DataMediaRequest = { ids: [...new Set(ids)], locale: ctx.locale };
      const reply = await http.send('POST', '/buildr/data/media', { body });
      return expectBody(reply, dataMediaResponseSchema);
    },
  };
}
