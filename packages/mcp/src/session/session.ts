import type { BuilderDocument, NodeId, RegistryManifest, RegistryMeta, Result } from '@buildr/core';
import { createRegistryMeta, err, generateId, ok } from '@buildr/core';
import {
  applyDocumentPatches,
  type Command,
  type CommandEnv,
  coreCommandHandlers,
  createCommandRegistry,
  createHistory,
  executeBatch,
  type HistoryManager,
} from '@buildr/core/commands';
import type { DocumentRef, LayoutSource, McpSession, SaveResult } from '../backend.ts';
import { type SessionError, sessionError } from './errors.ts';

/** The most commands one `apply` accepts; a guard against runaway agent output. */
export const MAX_COMMANDS_PER_BATCH = 500;

export interface EditSessionInit {
  readonly id: string;
  readonly ref: DocumentRef;
  readonly userId: string | number;
  readonly locale?: string | undefined;
  readonly revision: number;
  readonly layoutSource: LayoutSource;
  readonly layoutRef: string | null;
  readonly contextRef: string;
  readonly previewPath: string | null;
  readonly document: BuilderDocument;
  readonly readOnly: boolean;
  readonly manifest: RegistryManifest;
  readonly limits: McpSession['limits'];
  readonly canUnlockTemplates: boolean;
  readonly clock: () => number;
  readonly generateId?: () => string;
}

/** What `apply`, `undo` and `redo` report. */
export interface SessionChange {
  readonly doc: BuilderDocument;
  /** Nodes the change touched (inserted, changed, moved), deduplicated. */
  readonly affected: readonly NodeId[];
  /** The selection the commands asked for (the newly inserted nodes, typically). */
  readonly select: readonly NodeId[];
  readonly dirty: boolean;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
}

/**
 * The agent's working copy of one document: a headless editor store (ADR-024, decision 5). The
 * document changes only through `apply` (core's `executeBatch`) and `undo`/`redo` (history
 * patches), so every change is atomic, validated and reversible. `doc` is deeply frozen.
 */
export interface EditSession {
  readonly id: string;
  readonly ref: DocumentRef;
  readonly userId: string | number;
  readonly locale: string | undefined;
  /** The backend revision the working copy is based on; what `save` sends as `baseRevision`. */
  readonly revision: number;
  readonly layoutSource: LayoutSource;
  readonly layoutRef: string | null;
  readonly contextRef: string;
  readonly previewPath: string | null;
  readonly readOnly: boolean;
  readonly doc: BuilderDocument;
  readonly registry: RegistryMeta;
  /** The manifest hash the session is pinned to. */
  readonly manifestHash: string;
  readonly history: HistoryManager;
  /** True when the document differs from the last saved (or loaded) state. Correct after undo/redo. */
  readonly dirty: boolean;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  /** Runs `commands` as one atomic, single-undo-step batch. On failure the document is untouched. */
  apply(
    commands: readonly Command[],
    options?: { readonly label?: string },
  ): Result<SessionChange, SessionError>;
  undo(): Result<SessionChange, SessionError>;
  redo(): Result<SessionChange, SessionError>;
  /** Records a successful `backend.save`: the new base revision, and the current state as clean. */
  markSaved(result: Pick<SaveResult, 'revision'>): void;
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

/** UTF-8 size of the serialized document (no `TextEncoder`/`Buffer` in this package's lib set). */
function byteSize(doc: BuilderDocument): number {
  const json = JSON.stringify(doc);
  let bytes = 0;
  for (let i = 0; i < json.length; i++) {
    const c = json.charCodeAt(i);
    if (c < 0x80) bytes += 1;
    else if (c < 0x800) bytes += 2;
    else if (c >= 0xd800 && c <= 0xdbff) {
      bytes += 4;
      i++;
    } else bytes += 3;
  }
  return bytes;
}

/** Builds the registry a session runs commands against from a manifest (validated at the boundary). */
export function registryFromManifest(manifest: RegistryManifest): RegistryMeta {
  return createRegistryMeta({
    components: Object.values(manifest.components),
    templates: Object.values(manifest.templates),
  });
}

export function createEditSession(init: EditSessionInit): Result<EditSession, SessionError> {
  let registry: RegistryMeta;
  try {
    registry = registryFromManifest(init.manifest);
  } catch (cause) {
    return err(
      sessionError(
        'invalid-manifest',
        `the site's component manifest is not usable: ${cause instanceof Error ? cause.message : 'unknown error'}`,
      ),
    );
  }

  const history = createHistory({ clock: init.clock });
  const env: CommandEnv = {
    registry,
    commands: createCommandRegistry(coreCommandHandlers),
    generateId: init.generateId ?? generateId,
    canUnlock: init.canUnlockTemplates ? () => true : undefined,
  };

  let doc = deepFreeze(init.document);
  let revision = init.revision;
  let savedCursor = history.cursorId;
  let nodeCount = Object.keys(doc.nodes).length;
  let bytes = byteSize(doc);

  const snapshot = (affected: readonly NodeId[], select: readonly NodeId[]): SessionChange => ({
    doc,
    affected,
    select,
    dirty: history.cursorId !== savedCursor,
    canUndo: history.canUndo,
    canRedo: history.canRedo,
  });

  const adopt = (next: BuilderDocument): void => {
    doc = deepFreeze(next);
    nodeCount = Object.keys(doc.nodes).length;
    bytes = byteSize(doc);
  };

  const patchFailure = (): SessionError =>
    sessionError('command-rejected', 'the change could not be replayed on the document; reopen it');

  const session: EditSession = {
    id: init.id,
    ref: init.ref,
    userId: init.userId,
    locale: init.locale,
    layoutSource: init.layoutSource,
    layoutRef: init.layoutRef,
    contextRef: init.contextRef,
    previewPath: init.previewPath,
    readOnly: init.readOnly,
    registry,
    manifestHash: init.manifest.hash,
    history,
    get revision() {
      return revision;
    },
    get doc() {
      return doc;
    },
    get dirty() {
      return history.cursorId !== savedCursor;
    },
    get canUndo() {
      return history.canUndo;
    },
    get canRedo() {
      return history.canRedo;
    },

    apply(commands, options) {
      if (init.readOnly) {
        return err(sessionError('read-only', 'this document is read-only for the current user'));
      }
      if (commands.length === 0) return ok(snapshot([], []));
      if (commands.length > MAX_COMMANDS_PER_BATCH) {
        return err(
          sessionError(
            'limit-exceeded',
            `a batch may hold at most ${MAX_COMMANDS_PER_BATCH} commands (got ${commands.length}); split it`,
          ),
        );
      }
      const result = executeBatch(doc, commands, env);
      if (!result.ok) {
        return err(
          sessionError('command-rejected', result.error.message, { command: result.error }),
        );
      }
      const next = result.value.doc;
      const nextNodes = Object.keys(next.nodes).length;
      if (nextNodes > init.limits.maxNodes && nextNodes > nodeCount) {
        return err(
          sessionError(
            'limit-exceeded',
            `the change would make the document ${nextNodes} nodes, over the limit of ${init.limits.maxNodes}; nothing was applied`,
            { details: { nodes: nextNodes, limit: init.limits.maxNodes } },
          ),
        );
      }
      const nextBytes = byteSize(next);
      if (nextBytes > init.limits.maxBytes && nextBytes > bytes) {
        return err(
          sessionError(
            'limit-exceeded',
            `the change would make the document ${nextBytes} bytes, over the limit of ${init.limits.maxBytes}; nothing was applied`,
            { details: { bytes: nextBytes, limit: init.limits.maxBytes } },
          ),
        );
      }
      const select = result.value.select ?? [];
      history.record({
        label: options?.label ?? commands.map((c) => c.type).join(', '),
        commands,
        patches: result.value.patches,
        inverse: result.value.inverse,
        selectionBefore: [],
        selectionAfter: select,
      });
      adopt(next);
      return ok(snapshot(result.value.affected, select));
    },

    undo() {
      const step = history.undo();
      if (step === undefined) {
        return err(sessionError('nothing-to-undo', 'there is nothing to undo'));
      }
      const next = applyDocumentPatches(doc, step.patches);
      if (!next.ok) {
        history.redo();
        return err(patchFailure());
      }
      adopt(next.value);
      return ok(snapshot([], step.selection));
    },

    redo() {
      const step = history.redo();
      if (step === undefined) {
        return err(sessionError('nothing-to-redo', 'there is nothing to redo'));
      }
      const next = applyDocumentPatches(doc, step.patches);
      if (!next.ok) {
        history.undo();
        return err(patchFailure());
      }
      adopt(next.value);
      return ok(snapshot([], step.selection));
    },

    markSaved(result) {
      revision = result.revision;
      savedCursor = history.cursorId;
    },
  };
  return ok(session);
}
