import type { McpBackend } from '../backend.ts';
import { createDiscoveryCache, type DiscoveryCache } from '../resources/index.ts';
import type { McpTool } from '../server.ts';
import type { SessionStore } from '../session/index.ts';
import { createDiscoveryTools } from './discovery.ts';
import { createDocumentTools } from './documents.ts';
import { createEditingTools } from './editing.ts';
import { createPersistenceTools } from './persistence.ts';
import { createQualityTools } from './quality.ts';

export interface BuildrToolsOptions {
  readonly store: SessionStore;
  /** The backend the store was built on; asked once whether the user may publish. */
  readonly backend: McpBackend;
  /** The operator's opt-in for `publish` (default false). */
  readonly allowPublish?: boolean;
  /** Share it with `createResources` so both serve identical text. */
  readonly discoveryCache?: DiscoveryCache;
}

/**
 * The complete built-in tool list: discovery, documents, editing, quality and persistence.
 *
 * `publish` is registered only when `allowPublish` is true AND the backend session reports
 * `permissions.canPublish`. The list is fixed when the server is created, so the session is read
 * once here; if it cannot be read, `publish` is left out (the conservative answer). `publish` still
 * re-checks the permission on every call.
 */
export async function createBuildrTools(options: BuildrToolsOptions): Promise<McpTool[]> {
  const { store, backend, allowPublish = false } = options;
  let canPublish = false;
  if (allowPublish) {
    const session = await backend.getSession();
    canPublish = session.ok && session.value.permissions.canPublish;
  }
  return [
    ...createDiscoveryTools(options.discoveryCache ?? createDiscoveryCache()),
    ...createDocumentTools({ store }),
    ...createEditingTools({ store }),
    ...createQualityTools({ store }),
    ...createPersistenceTools({ store, allowPublish, canPublish }),
  ];
}
