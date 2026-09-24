import type { Endpoint } from 'payload';
import type { EndpointEnv } from './context.ts';
import { getDocumentEndpoint } from './document.ts';
import { manifestEndpoint } from './manifest.ts';
import { publishEndpoint } from './publish.ts';
import { saveEndpoint } from './save.ts';
import { sessionEndpoint } from './session.ts';

/** The builder API (docs/payload.md#endpoint-contract) as Payload endpoints, served under `/api`. */
export const buildrEndpoints = (env: EndpointEnv): Endpoint[] => [
  sessionEndpoint(env),
  manifestEndpoint(env),
  getDocumentEndpoint(env),
  saveEndpoint(env),
  publishEndpoint(env),
];

export type { EndpointEnv } from './context.ts';
