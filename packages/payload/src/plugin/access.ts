import type { PayloadRequest } from 'payload';
import type { ResolvedOptions } from './options.ts';

export type Action = 'edit' | 'publish' | 'unlockTemplates';

export interface Permissions {
  readonly canEdit: boolean;
  readonly canPublish: boolean;
  readonly canUnlockTemplates: boolean;
}

const isAuthenticated = (req: PayloadRequest): boolean =>
  req.user !== null && req.user !== undefined;

/**
 * Whether the user of `req` may `action`. Nobody without a user may do anything; for an
 * authenticated user the plugin `access` function decides (any authenticated user when there is
 * none). Payload's own collection access still applies on top: every Local API call the endpoints
 * make uses the caller's `req` with `overrideAccess: false`.
 */
export async function allowed(
  options: Pick<ResolvedOptions, 'access'>,
  action: Action,
  req: PayloadRequest,
): Promise<boolean> {
  if (!isAuthenticated(req)) return false;
  const check = options.access[action];
  return check === undefined ? true : Boolean(await check({ req }));
}

export async function permissionsOf(
  options: Pick<ResolvedOptions, 'access'>,
  req: PayloadRequest,
): Promise<Permissions> {
  const [canEdit, canPublish, canUnlockTemplates] = await Promise.all([
    allowed(options, 'edit', req),
    allowed(options, 'publish', req),
    allowed(options, 'unlockTemplates', req),
  ]);
  return { canEdit, canPublish, canUnlockTemplates };
}
