import type { NodeId } from '../document/types.ts';
import { err, ok, type Result } from '../result/result.ts';
import { type CommandError, commandError } from './errors.ts';
import type { Command, DocumentPatch } from './types.ts';

export const DEFAULT_HISTORY_LIMIT = 200;
export const DEFAULT_MERGE_WINDOW_MS = 800;

/** One undo step (docs/commands.md#undoredo-transactions-batching). */
export interface HistoryEntry {
  /** Changes whenever the entry does (a merge gives it a new id), so `cursorId` tracks the state. */
  readonly id: string;
  readonly label: string;
  readonly commands: readonly Command[];
  /** Redo: apply in order. */
  readonly patches: readonly DocumentPatch[];
  /** Undo: apply in order. */
  readonly inverse: readonly DocumentPatch[];
  readonly selectionBefore: readonly NodeId[];
  readonly selectionAfter: readonly NodeId[];
  readonly mergeKey?: string | undefined;
  readonly timestamp: number;
}

/** What to record after a command ran (the fields of `CommandResult` plus the surrounding context). */
export interface HistoryRecord {
  readonly label: string;
  readonly commands: readonly Command[];
  readonly patches: readonly DocumentPatch[];
  readonly inverse: readonly DocumentPatch[];
  readonly selectionBefore: readonly NodeId[];
  readonly selectionAfter: readonly NodeId[];
  /** Consecutive records with the same key, close in time, become one entry. */
  readonly mergeKey?: string | undefined;
}

/** What the caller applies to the document (with `applyDocumentPatches`) and the selection to restore. */
export interface HistoryStep {
  readonly entry: HistoryEntry;
  readonly patches: readonly DocumentPatch[];
  readonly selection: readonly NodeId[];
}

export interface HistoryOptions {
  /** Most undo steps kept; the oldest are dropped. Default 200. */
  readonly limit?: number;
  /** Milliseconds; injected so tests control time. Default `Date.now`. */
  readonly clock?: () => number;
  /** How long after the previous record a same-key record still merges. Default 800ms. */
  readonly mergeWindowMs?: number;
}

/**
 * Undo/redo bookkeeping (ADR-012). It stores patches, never a document: `undo()` / `redo()` hand
 * back the patches to apply and the selection to restore, so a different implementation (say a
 * per-user undo manager) can be swapped in without touching the UI or the command layer.
 */
export interface HistoryManager {
  /**
   * Adds an entry, clearing the redo stack. Inside a transaction it joins the transaction
   * instead. A record without patches (a command that changed nothing) is ignored. Returns the
   * entry that now holds it (a merge returns the merged entry), or `undefined` when ignored or
   * joined to an open transaction.
   */
  record(input: HistoryRecord): HistoryEntry | undefined;
  undo(): HistoryStep | undefined;
  redo(): HistoryStep | undefined;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  /** Opens a transaction: everything recorded until `commit` becomes a single entry. */
  begin(label: string): Result<void, CommandError>;
  /** Closes it as one entry (nothing recorded means no entry). */
  commit(): Result<HistoryEntry | undefined, CommandError>;
  /** Abandons it; returns the patches that revert what it had recorded, for the caller to apply. */
  rollback(): Result<readonly DocumentPatch[], CommandError>;
  readonly inTransaction: boolean;
  /**
   * Identifies the current point in history: the id of the newest undo step, or of the empty
   * state. Undoing back to a point returns to the same id, so `dirty = cursorId !== savedCursorId`
   * is right after any undo/redo (docs/state-management.md).
   */
  readonly cursorId: string;
  readonly past: readonly HistoryEntry[];
  readonly future: readonly HistoryEntry[];
  /** Forgets everything (`doc.replace`); `cursorId` becomes a fresh value. */
  clear(): void;
}

const misuse = (code: string, message: string): CommandError => commandError(code, message);

interface OpenTransaction {
  readonly label: string;
  readonly commands: Command[];
  readonly patches: DocumentPatch[];
  /** Per-record inverses, oldest first; reversed when flattened. */
  readonly inverses: (readonly DocumentPatch[])[];
  selectionBefore: readonly NodeId[] | undefined;
  selectionAfter: readonly NodeId[];
}

export function createHistory(options: HistoryOptions = {}): HistoryManager {
  const limit = Math.max(1, Math.floor(options.limit ?? DEFAULT_HISTORY_LIMIT));
  const clock = options.clock ?? Date.now;
  const windowMs = options.mergeWindowMs ?? DEFAULT_MERGE_WINDOW_MS;

  let counter = 0;
  const nextId = (prefix: string): string => `${prefix}${++counter}`;
  let baseId = nextId('b');
  let past: HistoryEntry[] = [];
  let future: HistoryEntry[] = [];
  let transaction: OpenTransaction | undefined;
  /** The entry a same-key record may still merge into: only the newest one, only until undo/redo. */
  let mergeable: string | undefined;

  function push(entry: HistoryEntry): void {
    past.push(entry);
    if (past.length > limit) past = past.slice(past.length - limit);
  }

  function record(input: HistoryRecord): HistoryEntry | undefined {
    if (input.patches.length === 0) return undefined;

    if (transaction !== undefined) {
      transaction.commands.push(...input.commands);
      transaction.patches.push(...input.patches);
      transaction.inverses.push(input.inverse);
      transaction.selectionBefore ??= input.selectionBefore;
      transaction.selectionAfter = input.selectionAfter;
      return undefined;
    }

    const now = clock();
    future = [];
    const last = past[past.length - 1];
    if (
      last !== undefined &&
      input.mergeKey !== undefined &&
      last.mergeKey === input.mergeKey &&
      mergeable === last.id &&
      now - last.timestamp <= windowMs
    ) {
      const merged: HistoryEntry = {
        ...last,
        id: nextId('h'),
        commands: [...last.commands, ...input.commands],
        patches: [...last.patches, ...input.patches],
        // Undo reverts the newer change first.
        inverse: [...input.inverse, ...last.inverse],
        selectionAfter: input.selectionAfter,
        timestamp: now,
      };
      past[past.length - 1] = merged;
      mergeable = merged.id;
      return merged;
    }

    const entry: HistoryEntry = {
      id: nextId('h'),
      label: input.label,
      commands: [...input.commands],
      patches: [...input.patches],
      inverse: [...input.inverse],
      selectionBefore: input.selectionBefore,
      selectionAfter: input.selectionAfter,
      mergeKey: input.mergeKey,
      timestamp: now,
    };
    push(entry);
    mergeable = input.mergeKey === undefined ? undefined : entry.id;
    return entry;
  }

  return {
    record,

    undo() {
      if (transaction !== undefined) return undefined;
      const entry = past.pop();
      if (entry === undefined) return undefined;
      future.push(entry);
      mergeable = undefined;
      return { entry, patches: entry.inverse, selection: entry.selectionBefore };
    },

    redo() {
      if (transaction !== undefined) return undefined;
      const entry = future.pop();
      if (entry === undefined) return undefined;
      past.push(entry);
      mergeable = undefined;
      return { entry, patches: entry.patches, selection: entry.selectionAfter };
    },

    get canUndo() {
      return transaction === undefined && past.length > 0;
    },
    get canRedo() {
      return transaction === undefined && future.length > 0;
    },

    begin(label) {
      if (transaction !== undefined) {
        return err(misuse('history.transaction-open', 'A transaction is already open.'));
      }
      transaction = {
        label,
        commands: [],
        patches: [],
        inverses: [],
        selectionBefore: undefined,
        selectionAfter: [],
      };
      return ok(undefined);
    },

    commit() {
      const open = transaction;
      if (open === undefined) {
        return err(misuse('history.no-transaction', 'There is no open transaction.'));
      }
      transaction = undefined;
      if (open.patches.length === 0) return ok(undefined);
      future = [];
      const entry: HistoryEntry = {
        id: nextId('h'),
        label: open.label,
        commands: open.commands,
        patches: open.patches,
        inverse: [...open.inverses].reverse().flat(),
        selectionBefore: open.selectionBefore ?? [],
        selectionAfter: open.selectionAfter,
        timestamp: clock(),
      };
      push(entry);
      mergeable = undefined;
      return ok(entry);
    },

    rollback() {
      const open = transaction;
      if (open === undefined) {
        return err(misuse('history.no-transaction', 'There is no open transaction.'));
      }
      transaction = undefined;
      return ok([...open.inverses].reverse().flat());
    },

    get inTransaction() {
      return transaction !== undefined;
    },

    get cursorId() {
      return past[past.length - 1]?.id ?? baseId;
    },
    get past() {
      return past;
    },
    get future() {
      return future;
    },

    clear() {
      past = [];
      future = [];
      transaction = undefined;
      mergeable = undefined;
      baseId = nextId('b');
    },
  };
}
