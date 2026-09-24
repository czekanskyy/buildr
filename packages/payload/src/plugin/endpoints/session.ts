import type { Endpoint, PayloadRequest } from 'payload';
import { type SessionResponse, sessionResponseSchema } from '../../contract.ts';
import { permissionsOf } from '../access.ts';
import type { EndpointEnv } from './context.ts';
import { json, unauthorized } from './respond.ts';

/** The languages of the site (Payload localization), for the editor's language switcher. */
function localesOf(req: PayloadRequest): SessionResponse['locales'] {
  const localization = req.payload.config.localization;
  if (localization === false) return undefined;
  const intl: Record<string, string> = {};
  for (const locale of localization.locales) {
    const label = locale.label;
    intl[locale.code] =
      typeof label === 'string'
        ? label
        : ((label as Record<string, string> | undefined)?.[localization.defaultLocale] ??
          locale.code);
  }
  return {
    locales: localization.localeCodes,
    default: localization.defaultLocale,
    fallback: localization.fallback !== false,
    intl,
  };
}

/** `GET /api/buildr/session`: who is asking, what they may do, and the limits their documents live under. */
export const sessionEndpoint = (env: EndpointEnv): Endpoint => ({
  path: '/buildr/session',
  method: 'get',
  handler: async (req) => {
    const user = req.user as { id?: string | number; email?: string } | null | undefined;
    if (user === null || user === undefined || user.id === undefined) return unauthorized();
    const body: SessionResponse = {
      user: { id: user.id, ...(user.email === undefined ? {} : { email: user.email }) },
      permissions: await permissionsOf(env.options, req),
      limits: { ...env.options.limits },
    };
    const locales = localesOf(req);
    if (locales !== undefined) body.locales = locales;
    return json(sessionResponseSchema.parse(body));
  },
});
