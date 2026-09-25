import type { PayloadRequest } from 'payload';
import type { ResolvedOptions } from './options.ts';

export type Action = 'edit' | 'publish' | 'unlockTemplates';

export interface Permissions {
  readonly canEdit: boolean;
  readonly canPublish: boolean;
  readonly canUnlockTemplates: boolean;
}

/** Whether the request was authenticated by a Payload API key (`user._strategy`, set by Payload). */
export const isApiKeyRequest = (req: PayloadRequest): boolean =>
  (req.user as { _strategy?: string } | null | undefined)?._strategy === 'api-key';

const isAuthenticated = (req: PayloadRequest): boolean =>
  req.user !== null && req.user !== undefined;

/**
 * Whether the user of `req` may `action`. Nobody without a user may do anything; for an
 * authenticated user the plugin `access` function decides (any authenticated user when there is
 * none). Payload's own collection access still applies on top: every Local API call the endpoints
 * make uses the caller's `req` with `overrideAccess: false`.
 */
export async function allowed(
  options: Pick<ResolvedOptions, 'access' | 'mcp'>,
  action: Action,
  req: PayloadRequest,
): Promise<boolean> {
  if (!isAuthenticated(req)) return false;
  if (isApiKeyRequest(req)) {
    // An API key reaches the builder only through the opt-in `mcp` option; it publishes only with `mcp.allowPublish`.
    if (!options.mcp.enabled) return false;
    if (action === 'publish' && !options.mcp.allowPublish) return false;
    if (action === 'unlockTemplates') return false;
  }
  const check = options.access[action];
  return check === undefined ? true : Boolean(await check({ req }));
}

export async function permissionsOf(
  options: Pick<ResolvedOptions, 'access' | 'mcp'>,
  req: PayloadRequest,
): Promise<Permissions> {
  const [canEdit, canPublish, canUnlockTemplates] = await Promise.all([
    allowed(options, 'edit', req),
    allowed(options, 'publish', req),
    allowed(options, 'unlockTemplates', req),
  ]);
  return { canEdit, canPublish, canUnlockTemplates };
}
