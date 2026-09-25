import type { McpBackend } from './backend.ts';
import { createDiscoveryCache, createResources } from './resources/index.ts';
import {
  type BuildrMcpServer,
  type BuildrMcpServerOptions,
  createBuildrMcpServer,
} from './server.ts';
import {
  createSessionStore,
  type SessionStore,
  type SessionStoreOptions,
} from './session/index.ts';
import { createBuildrTools } from './tools/index.ts';

export interface CreateFullBuildrMcpServerInput {
  readonly backend: McpBackend;
  /** `tools` and `resources` are filled in when absent; everything else is passed through. */
  readonly options?: BuildrMcpServerOptions;
  /** TTL, per-user cap, clock, ... of the session store. */
  readonly sessions?: Omit<SessionStoreOptions, 'backend'>;
}

export interface FullBuildrMcpServer {
  readonly server: BuildrMcpServer;
  /** The open working copies; hosts can `sweep()` it or inspect it. */
  readonly store: SessionStore;
}

/**
 * The wiring hosts use (stdio CLI, the site's HTTP route): a session store, the complete tool list
 * (`createBuildrTools`) and the `buildr://` resources on top of `createBuildrMcpServer`. Explicit
 * `options.tools` / `options.resources` win, so a host can still serve a custom set.
 */
export async function createBuildrMcpServerWithTools(
  input: CreateFullBuildrMcpServerInput,
): Promise<FullBuildrMcpServer> {
  const { backend } = input;
  const options = input.options ?? {};
  const store = createSessionStore({ ...input.sessions, backend });
  const discoveryCache = createDiscoveryCache();
  const tools =
    options.tools ??
    (await createBuildrTools({
      store,
      backend,
      discoveryCache,
      ...(options.allowPublish === undefined ? {} : { allowPublish: options.allowPublish }),
    }));
  const resources = options.resources ?? createResources(discoveryCache);
  const server = createBuildrMcpServer({ backend, options: { ...options, tools, resources } });
  return { server, store };
}
