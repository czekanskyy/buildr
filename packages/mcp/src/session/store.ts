import type { Result } from '@next-buildr/core';
import { err, generateId, ok } from '@next-buildr/core';
import type {
  CreateDocumentInput,
  DocumentRef,
  LoadOptions,
  McpBackend,
  McpResult,
} from '../backend.ts';
import { backendFailure, type SessionError, sessionError } from './errors.ts';
import { createEditSession, type EditSession } from './session.ts';

export const DEFAULT_SESSION_TTL_MS = 30 * 60_000;
export const DEFAULT_MAX_SESSIONS_PER_USER = 5;
export const DEFAULT_MANIFEST_CHECK_INTERVAL_MS = 60_000;

export interface SessionStoreOptions {
  readonly backend: McpBackend;
  /** Idle time after which a session is dropped (unsaved changes included). Default 30 minutes. */
  readonly ttlMs?: number;
  /** Open sessions per backend user; opening one more is refused, never evicts. Default 5. */
  readonly maxSessionsPerUser?: number;
  /** How often `get` re-checks that the manifest still matches the pinned hash. Default 60 s; 0 checks every time. */
  readonly manifestCheckIntervalMs?: number;
  /** Injected for deterministic tests. Default `Date.now`. */
  readonly now?: () => number;
  readonly generateSessionId?: () => string;
  /** Node id generator handed to the commands; injected for deterministic tests. */
  readonly generateNodeId?: () => string;
}

export interface SessionInfo {
  readonly id: string;
  readonly ref: DocumentRef;
  readonly userId: string | number;
  readonly dirty: boolean;
  readonly revision: number;
  readonly idleMs: number;
}

export interface GetSessionOptions {
  /** Skip the manifest pin check (to save or close a session whose manifest changed). */
  readonly ignoreManifest?: boolean;
}

/**
 * Holds the open edit sessions of a server (ADR-024, decision 5). No timers: expired sessions are
 * dropped lazily on every call (and by `sweep`), so a store never keeps a process alive. A session
 * is idle-timed: every successful `get` refreshes it.
 */
export interface SessionStore {
  /** Creates a draft through the backend (never publishes) and opens a session on it. */
  create(
    input: CreateDocumentInput,
    options?: LoadOptions,
  ): Promise<Result<EditSession, SessionError>>;
  /** Loads the document through the backend and opens a session on it. */
  open(ref: DocumentRef, options?: LoadOptions): Promise<Result<EditSession, SessionError>>;
  /** The live session, refreshed; `session-not-found` when unknown or expired, `manifest-changed` when stale. */
  get(id: string, options?: GetSessionOptions): Promise<Result<EditSession, SessionError>>;
  /** Closes a session; refuses a dirty one unless `discard` is set. Returns whether changes were discarded. */
  close(
    id: string,
    options?: { readonly discard?: boolean },
  ): Result<{ readonly discarded: boolean }, SessionError>;
  list(): readonly SessionInfo[];
  /** Drops expired sessions now; returns how many. */
  sweep(): number;
  readonly size: number;
}

function defaultSessionId(): string {
  return `s_${generateId()}`;
}

export function createSessionStore(options: SessionStoreOptions): SessionStore {
  const { backend } = options;
  const ttlMs = options.ttlMs ?? DEFAULT_SESSION_TTL_MS;
  const maxPerUser = options.maxSessionsPerUser ?? DEFAULT_MAX_SESSIONS_PER_USER;
  const checkIntervalMs = options.manifestCheckIntervalMs ?? DEFAULT_MANIFEST_CHECK_INTERVAL_MS;
  const now = options.now ?? Date.now;
  const newId = options.generateSessionId ?? defaultSessionId;

  interface Entry {
    readonly session: EditSession;
    lastUsed: number;
    lastManifestCheck: number;
  }
  const entries = new Map<string, Entry>();

  function sweep(): number {
    const t = now();
    let dropped = 0;
    for (const [id, entry] of entries) {
      if (t - entry.lastUsed >= ttlMs) {
        entries.delete(id);
        dropped++;
      }
    }
    return dropped;
  }

  const fromBackend = <T>(result: McpResult<T>): Result<T, SessionError> =>
    result.ok ? result : err(backendFailure(result.error));

  async function open(ref: DocumentRef, loadOptions?: LoadOptions) {
    sweep();
    const session = fromBackend(await backend.getSession());
    if (!session.ok) return session;
    const user = session.value.user.id;
    const openForUser = [...entries.values()].filter((e) => e.session.userId === user);
    if (openForUser.length >= maxPerUser) {
      return err(
        sessionError(
          'session-limit',
          `at most ${maxPerUser} documents can be open at once; close one first (open: ${openForUser
            .map((e) => e.session.id)
            .join(', ')})`,
          { details: { limit: maxPerUser } },
        ),
      );
    }
    const manifest = fromBackend(await backend.getManifest());
    if (!manifest.ok) return manifest;
    const loaded = fromBackend(await backend.load(ref, loadOptions));
    if (!loaded.ok) return loaded;

    // The awaits above let another open slip in; re-check so the cap holds.
    if ([...entries.values()].filter((e) => e.session.userId === user).length >= maxPerUser) {
      return err(
        sessionError(
          'session-limit',
          `at most ${maxPerUser} documents can be open at once; close one first`,
        ),
      );
    }

    let id = newId();
    while (entries.has(id)) id = newId();
    const created = createEditSession({
      id,
      ref,
      userId: user,
      locale: loadOptions?.locale,
      revision: loaded.value.revision,
      layoutSource: loaded.value.layoutSource,
      layoutRef: loaded.value.layoutRef,
      contextRef: loaded.value.contextRef,
      previewPath: loaded.value.previewPath,
      document: loaded.value.document,
      readOnly: loaded.value.readOnly === true || !session.value.permissions.canEdit,
      manifest: manifest.value,
      limits: session.value.limits,
      canUnlockTemplates: session.value.permissions.canUnlockTemplates,
      clock: now,
      ...(options.generateNodeId === undefined ? {} : { generateId: options.generateNodeId }),
    });
    if (!created.ok) return created;
    const t = now();
    entries.set(id, { session: created.value, lastUsed: t, lastManifestCheck: t });
    return created;
  }

  return {
    open,

    async create(input, loadOptions) {
      sweep();
      const summary = fromBackend(await backend.createDocument(input));
      if (!summary.ok) return summary;
      return open(summary.value.ref, loadOptions);
    },

    async get(id, getOptions) {
      sweep();
      const entry = entries.get(id);
      if (entry === undefined) {
        return err(
          sessionError(
            'session-not-found',
            `session "${id}" does not exist or has expired after ${Math.round(ttlMs / 60_000)} minutes of inactivity; open the document again`,
          ),
        );
      }
      if (
        getOptions?.ignoreManifest !== true &&
        now() - entry.lastManifestCheck >= checkIntervalMs
      ) {
        const manifest = fromBackend(await backend.getManifest());
        if (!manifest.ok) return manifest;
        // The session may have been closed while awaiting.
        if (entries.get(id) !== entry) {
          return err(sessionError('session-not-found', `session "${id}" was closed`));
        }
        entry.lastManifestCheck = now();
        if (manifest.value.hash !== entry.session.manifestHash) {
          return err(
            sessionError(
              'manifest-changed',
              "the site's components changed since this document was opened; close the session and open the document again (unsaved changes in this session cannot be continued)",
              { details: { pinned: entry.session.manifestHash, current: manifest.value.hash } },
            ),
          );
        }
      }
      entry.lastUsed = now();
      return ok(entry.session);
    },

    close(id, closeOptions) {
      sweep();
      const entry = entries.get(id);
      if (entry === undefined) {
        return err(
          sessionError('session-not-found', `session "${id}" does not exist or has expired`),
        );
      }
      const dirty = entry.session.dirty;
      if (dirty && closeOptions?.discard !== true) {
        return err(
          sessionError(
            'unsaved-changes',
            'the session has unsaved changes; save them first or close with discard set',
          ),
        );
      }
      entries.delete(id);
      return ok({ discarded: dirty });
    },

    list() {
      sweep();
      const t = now();
      return [...entries.values()].map((e) => ({
        id: e.session.id,
        ref: e.session.ref,
        userId: e.session.userId,
        dirty: e.session.dirty,
        revision: e.session.revision,
        idleMs: t - e.lastUsed,
      }));
    },

    sweep,

    get size() {
      sweep();
      return entries.size;
    },
  };
}
