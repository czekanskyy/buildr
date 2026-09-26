import { toManifest } from '@next-buildr/core';
import type { Endpoint } from 'payload';
import { allowed, type EndpointEnv } from './context.ts';
import { fail, json, unauthorized } from './respond.ts';

/** `GET /api/buildr/manifest`: the registry the editor builds with (only present when the plugin has one). */
export const manifestEndpoint = (env: EndpointEnv): Endpoint => ({
  path: '/buildr/manifest',
  method: 'get',
  handler: async (req) => {
    if (req.user === null || req.user === undefined) return unauthorized();
    if (!(await allowed(env, 'edit', req))) return fail(403, 'You may not edit with the builder.');
    const registry = env.options.registry;
    if (registry === undefined) return fail(404, 'The plugin was configured without a registry.');
    return json(toManifest(registry.meta));
  },
});
