import type { CommandError } from '@buildr/core/commands';
import type { McpError } from '../backend.ts';

export type SessionErrorCode =
  /** A command in the batch was rejected; nothing was applied. `command` has the core error. */
  | 'command-rejected'
  /** The batch or the resulting document exceeds a limit; nothing was applied. */
  | 'limit-exceeded'
  /** The document (or the agent user) is not editable. */
  | 'read-only'
  | 'nothing-to-undo'
  | 'nothing-to-redo'
  /** Unknown, closed or expired session id. */
  | 'session-not-found'
  /** The agent user already has the maximum number of open sessions. */
  | 'session-limit'
  /** The site's component manifest changed since the session opened; reopen the document. */
  | 'manifest-changed'
  /** `close` on a session with unsaved changes, without `discard`. */
  | 'unsaved-changes'
  /** The manifest from the backend cannot build a registry. */
  | 'invalid-manifest'
  /** The backend refused or failed; `backend` has the typed error. */
  | 'backend';

/** A typed failure of the session layer; `message` is one sentence an agent can act on. */
export interface SessionError {
  readonly code: SessionErrorCode;
  readonly message: string;
  readonly command?: CommandError;
  readonly backend?: McpError;
  readonly details?: Readonly<Record<string, unknown>>;
}

export function sessionError(
  code: SessionErrorCode,
  message: string,
  extra: Pick<SessionError, 'command' | 'backend' | 'details'> = {},
): SessionError {
  return { code, message, ...extra };
}

export function backendFailure(error: McpError): SessionError {
  return sessionError('backend', error.message, { backend: error });
}
