import { createStore, type StoreApi } from 'zustand/vanilla';
import type { EditorStore } from '../store/index.ts';
import { checkSaveResult, loadDocument } from './load.ts';
import type { Clock, DocumentAdapter, DocumentRef, PersistenceState, SaveResult } from './types.ts';

/** How long to wait before retrying a failed save; the last delay repeats. */
export const RETRY_DELAYS_MS: readonly number[] = [2000, 5000, 15_000];

export const systemClock: Clock = {
  now: () => Date.now(),
  setTimeout: (handler, ms) => setTimeout(handler, ms),
  clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

export interface PersistenceOptions {
  readonly store: EditorStore;
  readonly adapter: DocumentAdapter;
  readonly ref: DocumentRef;
  /** The revision the document was loaded at. */
  readonly revision: number;
  readonly debounceMs?: number;
  readonly maxWaitMs?: number;
  readonly clock?: Clock;
}

export interface PersistenceController {
  readonly state: StoreApi<PersistenceState>;
  /** Starts watching the store. Returns the function that stops it (timers cleared; no more saves). */
  start(): () => void;
  /** Saves now (Ctrl+S). Resolves when the save (and any that had to follow it) is over. */
  saveNow(): Promise<void>;
  /** After a conflict: takes the backend's document and drops the local changes. */
  reload(): Promise<void>;
  /** After a conflict: saves the local document over the backend's. */
  overwrite(): Promise<void>;
  /** Whether closing the tab would lose something. */
  hasUnsavedWork(): boolean;
}

const errorMessage = (cause: unknown) => (cause instanceof Error ? cause.message : String(cause));

/**
 * The autosave state machine (docs/state-management.md#autosave):
 * `clean → dirty → saving → clean`, with `conflict` and `error` on the side. One save is in flight
 * at a time; a change made while it runs is saved by the next one. Whether the document is dirty
 * is read from the history (`cursorId` ≠ `savedCursorId`), so undoing back to the saved state is
 * clean again.
 */
export function createPersistence(options: PersistenceOptions): PersistenceController {
  const { store, adapter, ref } = options;
  const clock = options.clock ?? systemClock;
  const debounceMs = options.debounceMs ?? 2000;
  const maxWaitMs = options.maxWaitMs ?? 20_000;
  const state = createStore<PersistenceState>(() => ({
    status: 'clean',
    revision: options.revision,
    lastSavedAt: undefined,
    error: undefined,
    conflictRevision: undefined,
  }));
  const set = (patch: Partial<PersistenceState>) => state.setState(patch);

  let debounceTimer: unknown;
  let maxWaitTimer: unknown;
  let retryTimer: unknown;
  let attempt = 0;
  let inFlight: Promise<void> | undefined;
  let saveAgain = false;
  let stopped = true;

  const isDirty = () => {
    const { cursorId, savedCursorId } = store.getState();
    return cursorId !== savedCursorId;
  };
  const clearTimers = () => {
    if (debounceTimer !== undefined) clock.clearTimeout(debounceTimer);
    if (maxWaitTimer !== undefined) clock.clearTimeout(maxWaitTimer);
    if (retryTimer !== undefined) clock.clearTimeout(retryTimer);
    debounceTimer = maxWaitTimer = retryTimer = undefined;
  };

  async function attemptSave(autosave: boolean, baseRevision: number): Promise<void> {
    const { doc, cursorId } = store.getState();
    set({ status: 'saving' });
    let result: SaveResult;
    try {
      result = checkSaveResult(await adapter.save(ref, { document: doc, baseRevision, autosave }));
    } catch (cause) {
      if (stopped) return;
      attempt += 1;
      set({ status: 'error', error: { kind: 'network', message: errorMessage(cause), attempt } });
      // Ctrl+S retries by itself when the author presses it again; the autosave keeps trying.
      const delay = RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length) - 1] ?? 15_000;
      retryTimer = clock.setTimeout(() => {
        retryTimer = undefined;
        void run(true);
      }, delay);
      return;
    }
    if (stopped) return;
    if (result.ok) {
      attempt = 0;
      store.markSaved(cursorId);
      set({
        revision: result.revision,
        lastSavedAt: result.updatedAt,
        error: undefined,
        conflictRevision: undefined,
      });
      if (isDirty()) {
        // Changed while saving: the next save takes it.
        set({ status: 'dirty' });
        schedule();
      } else {
        set({ status: 'clean' });
      }
      return;
    }
    if (result.kind === 'conflict') {
      clearTimers();
      set({ status: 'conflict', conflictRevision: result.currentRevision, error: undefined });
      return;
    }
    clearTimers();
    // Rejected for what it contains: retrying the same document cannot help; a change re-arms it.
    set({ status: 'error', error: { kind: 'invalid', diagnostics: result.diagnostics } });
  }

  /** One save at a time; anything asked for meanwhile runs after it. */
  function run(autosave: boolean, baseRevision?: number): Promise<void> {
    if (inFlight !== undefined) {
      saveAgain = true;
      return inFlight;
    }
    if (store.getState().readOnly) return Promise.resolve();
    clearTimers();
    const flight = (async () => {
      try {
        await attemptSave(autosave, baseRevision ?? state.getState().revision);
      } finally {
        inFlight = undefined;
      }
      if (saveAgain && !stopped) {
        saveAgain = false;
        const { status } = state.getState();
        if (status === 'dirty' || (status === 'clean' && isDirty())) await run(autosave);
      }
    })();
    inFlight = flight;
    return flight;
  }

  function schedule() {
    if (stopped || store.getState().readOnly) return;
    if (debounceTimer !== undefined) clock.clearTimeout(debounceTimer);
    debounceTimer = clock.setTimeout(() => {
      debounceTimer = undefined;
      void run(true);
    }, debounceMs);
    if (maxWaitTimer === undefined) {
      maxWaitTimer = clock.setTimeout(() => {
        maxWaitTimer = undefined;
        void run(true);
      }, maxWaitMs);
    }
  }

  function onDocumentChanged() {
    const { status } = state.getState();
    if (status === 'conflict') return;
    if (!isDirty()) {
      // Undone back to the saved state.
      if (status === 'dirty' || status === 'error') {
        clearTimers();
        set({ status: 'clean', error: undefined });
      }
      return;
    }
    if (status === 'saving') return; // The save that follows it picks the change up.
    if (status === 'error') {
      // A new change gives a rejected document another chance, and a failing network a sooner retry.
      clearTimers();
      set({ status: 'dirty', error: undefined });
    } else if (status === 'clean') {
      set({ status: 'dirty' });
    }
    schedule();
  }

  return {
    state,
    start() {
      stopped = false;
      // Every step of the history moves the cursor, so this sees edits, undo, redo and replacements.
      const stopSubscription = store.subscribe((next, previous) => {
        if (next.cursorId !== previous.cursorId || next.savedCursorId !== previous.savedCursorId) {
          onDocumentChanged();
        }
      });
      return () => {
        stopped = true;
        stopSubscription();
        clearTimers();
      };
    },
    saveNow: () => {
      const { status } = state.getState();
      if (status === 'conflict') return Promise.resolve();
      if (!isDirty() && status !== 'error') return Promise.resolve();
      return run(false);
    },
    async reload() {
      const loaded = await loadDocument(adapter, ref);
      clearTimers();
      attempt = 0;
      store.replaceDocument(loaded.document, { readOnly: loaded.readOnly === true });
      set({
        status: 'clean',
        revision: loaded.revision,
        lastSavedAt: loaded.updatedAt,
        error: undefined,
        conflictRevision: undefined,
      });
    },
    overwrite() {
      const { conflictRevision } = state.getState();
      if (conflictRevision === undefined) return Promise.resolve();
      return run(false, conflictRevision);
    },
    hasUnsavedWork() {
      const { status } = state.getState();
      return status === 'saving' || status === 'conflict' || isDirty();
    },
  };
}
