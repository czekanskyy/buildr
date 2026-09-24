import type { Endpoint } from 'payload';
import { type SessionResponse, sessionResponseSchema } from '../../contract.ts';
import { allowed, type EndpointEnv } from './context.ts';
import { json, unauthorized } from './respond.ts';

/** `GET /api/buildr/session`: who is asking, what they may do, and the limits their documents live under. */
export const sessionEndpoint = (env: EndpointEnv): Endpoint => ({
  path: '/buildr/session',
  method: 'get',
  handler: async (req) => {
    const user = req.user as { id?: string | number; email?: string } | null | undefined;
    if (user === null || user === undefined || user.id === undefined) return unauthorized();
    const body: SessionResponse = {
      user: { id: user.id, ...(user.email === undefined ? {} : { email: user.email }) },
      permissions: {
        canEdit: await allowed(env, 'edit', req),
        canPublish: await allowed(env, 'publish', req),
      },
      limits: { ...env.options.limits },
    };
    return json(sessionResponseSchema.parse(body));
  },
});
