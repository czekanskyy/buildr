import type { Endpoint } from 'payload';
import type { EndpointEnv } from './context.ts';
import { dataContextEndpoint } from './data-context.ts';
import { dataSchemaEndpoint } from './data-schema.ts';
import { getDocumentEndpoint } from './document.ts';
import { manifestEndpoint } from './manifest.ts';
import { publishEndpoint } from './publish.ts';
import { samplesEndpoint } from './samples.ts';
import { saveEndpoint } from './save.ts';
import { sessionEndpoint } from './session.ts';

/** The builder API (docs/payload.md#endpoint-contract) as Payload endpoints, served under `/api`. */
export const buildrEndpoints = (env: EndpointEnv): Endpoint[] => [
  sessionEndpoint(env),
  manifestEndpoint(env),
  getDocumentEndpoint(env),
  saveEndpoint(env),
  publishEndpoint(env),
  dataSchemaEndpoint(env),
  dataContextEndpoint(env),
  samplesEndpoint(env),
];

export type { EndpointEnv } from './context.ts';
