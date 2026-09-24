import {
  type BuilderDocument,
  err,
  generateId,
  type NodeId,
  ok,
  type Result,
  runA11y,
  validateDocument,
} from '@buildr/core';
import {
  applyDocumentPatches,
  type Command,
  type CommandEnv,
  type CommandError,
  type CommandResult,
  commandError,
  commandMergeKey,
  coreCommandHandlers,
  createCommandRegistry,
  createHistory,
  type DocumentPatch,
  execute,
  executeBatch,
} from '@buildr/core/commands';
import { createStore } from 'zustand/vanilla';
import {
  EMPTY_SELECTION,
  normalizeSelection,
  relativeNode,
  type SelectionState,
  selectIn,
} from './selection.ts';
import type {
  DispatchOptions,
  DocumentChange,
  EditorState,
  EditorStore,
  EditorStoreOptions,
  ValidationSnapshot,
} from './types.ts';

/** How long after the last change validation and the accessibility checks run. */
export const DEFAULT_VALIDATION_DELAY_MS = 300;

function defaultTimers(): NonNullable<EditorStoreOptions['timers']> {
  const g = globalThis as unknown as NonNullable<EditorStoreOptions['timers']>;
  return { setTimeout: (cb, ms) => g.setTimeout(cb, ms), clearTimeout: (h) => g.clearTimeout(h) };
}

/** The ids that are still nodes of `doc`, in order and without repeats. */
function existing(doc: BuilderDocument, ids: readonly NodeId[]): NodeId[] {
  const kept: NodeId[] = [];
  for (const id of ids) {
    if (Object.hasOwn(doc.nodes, id) && !kept.includes(id)) kept.push(id);
  }
  return kept;
}

const readOnlyError = (): CommandError =>
  commandError('editor.read-only', 'the document cannot be changed');

/**
 * The editor's store (docs/state-management.md, ADR-013): a vanilla Zustand store whose document
 * changes only through `@buildr/core/commands`. `dispatch` runs `execute`, records the result in
 * the history and swaps in the new document; `undo` and `redo` apply the history's patches with
 * `applyDocumentPatches`; nothing here writes into a document. Every change bumps `docVersion` and
 * is announced to `onChange` (the canvas host turns it into `doc:patch` / `doc:set`), and validation
 * runs a moment after the last one.
 */
export function createEditorStore(options: EditorStoreOptions): EditorStore {
  const commands = options.commands ?? createCommandRegistry(coreCommandHandlers);
  const history = createHistory(options.history);
  const env: CommandEnv = {
    registry: options.registry,
    commands,
    generateId: options.generateId ?? generateId,
    canUnlock: options.canUnlock,
    checkInvariants: options.checkInvariants ?? false,
  };
  const timers = options.timers ?? defaultTimers();
  const delay =
    options.validationDelayMs === undefined
      ? DEFAULT_VALIDATION_DELAY_MS
      : options.validationDelayMs;

  const historyState = () => ({
    canUndo: history.canUndo,
    canRedo: history.canRedo,
    inTransaction: history.inTransaction,
    cursorId: history.cursorId,
    undoLabel: history.past[history.past.length - 1]?.label,
    redoLabel: history.future[history.future.length - 1]?.label,
  });

  const api = createStore<EditorState>(() => ({
    doc: options.doc,
    docVersion: 0,
    readOnly: options.readOnly ?? false,
    ...historyState(),
    savedCursorId: history.cursorId,
    ...EMPTY_SELECTION,
    hoveredId: null,
    validation: undefined,
  }));

  const listeners = new Set<(change: DocumentChange) => void>();
  let timer: unknown;

  const validateNow = (): ValidationSnapshot => {
    timers.clearTimeout(timer);
    const { doc, docVersion } = api.getState();
    const snapshot: ValidationSnapshot = {
      docVersion,
      issues: validateDocument(doc, { registry: options.registry }).issues,
      a11y: runA11y(doc, options.registry),
    };
    api.setState({ validation: snapshot });
    return snapshot;
  };

  const scheduleValidation = () => {
    if (delay === null) return;
    timers.clearTimeout(timer);
    timer = timers.setTimeout(validateNow, delay);
  };

  const announce = (change: DocumentChange) => {
    for (const listener of [...listeners]) listener(change);
  };

  /** Puts a new document in the state and tells the listeners which patches led to it. */
  const commit = (
    doc: BuilderDocument,
    patches: readonly DocumentPatch[],
    selection: readonly NodeId[],
  ) => {
    const state = api.getState();
    const from = state.docVersion;
    api.setState({
      doc,
      docVersion: from + 1,
      ...normalizeSelection(doc, {
        selectedIds: selection,
        anchorId: state.anchorId,
        selectedInstance: state.selectedInstance,
      }),
      hoveredId:
        state.hoveredId !== null && Object.hasOwn(doc.nodes, state.hoveredId)
          ? state.hoveredId
          : null,
      ...historyState(),
    });
    scheduleValidation();
    announce({ kind: 'patch', from, to: from + 1, patches });
  };

  const applyPatches = (
    patches: readonly DocumentPatch[],
    selection: readonly NodeId[],
  ): Result<true, CommandError> => {
    const applied = applyDocumentPatches(api.getState().doc, patches);
    if (!applied.ok) return err(applied.error);
    commit(applied.value, patches, selection);
    return ok(true);
  };

  const run = (
    commandList: readonly Command[],
    options_: DispatchOptions | undefined,
  ): Result<CommandResult, CommandError> => {
    const state = api.getState();
    if (state.readOnly) return err(readOnlyError());
    const only = commandList.length === 1 ? commandList[0] : undefined;
    const result =
      only !== undefined
        ? execute(state.doc, only, env)
        : executeBatch(state.doc, commandList, env);
    if (!result.ok) return result;

    const { value } = result;
    const before = state.selectedIds;
    const after = value.select ?? before;
    history.record({
      label: options_?.label ?? commandList[0]?.type ?? 'batch',
      commands: commandList,
      patches: value.patches,
      inverse: value.inverse,
      selectionBefore: before,
      selectionAfter: existing(value.doc, after),
      mergeKey: commandMergeKey(commands, commandList),
    });
    if (value.patches.length > 0) commit(value.doc, value.patches, after);
    else api.setState(historyState());
    return result;
  };

  const store: EditorStore = {
    ...api,
    registry: options.registry,
    history,

    dispatch: (command, options_) => run([command], options_),
    dispatchBatch: (commandList, options_) => run(commandList, options_),

    transaction(label, fn) {
      if (api.getState().readOnly) return false;
      const began = history.begin(label);
      if (!began.ok) return false;
      api.setState(historyState());

      const rollBack = () => {
        const inverse = history.rollback();
        if (inverse.ok && inverse.value.length > 0) {
          applyPatches(inverse.value, api.getState().selectedIds);
        } else api.setState(historyState());
      };
      let keep: boolean;
      try {
        keep = fn() !== false;
      } catch (error) {
        rollBack();
        throw error;
      }
      if (!keep) {
        rollBack();
        return false;
      }
      history.commit();
      api.setState(historyState());
      return true;
    },

    undo() {
      if (api.getState().readOnly) return err(readOnlyError());
      const step = history.undo();
      if (step === undefined) return err(commandError('editor.nothing-to-undo', 'nothing to undo'));
      return applyPatches(step.patches, step.selection);
    },

    redo() {
      if (api.getState().readOnly) return err(readOnlyError());
      const step = history.redo();
      if (step === undefined) return err(commandError('editor.nothing-to-redo', 'nothing to redo'));
      return applyPatches(step.patches, step.selection);
    },

    replaceDocument(doc, replaceOptions) {
      history.clear();
      const state = api.getState();
      const version = state.docVersion + 1;
      api.setState({
        doc,
        docVersion: version,
        readOnly: replaceOptions?.readOnly ?? state.readOnly,
        ...historyState(),
        savedCursorId: history.cursorId,
        ...normalizeSelection(doc, {
          selectedIds: state.selectedIds,
          anchorId: state.anchorId,
          selectedInstance: state.selectedInstance,
        }),
        hoveredId: null,
        validation: undefined,
      });
      scheduleValidation();
      announce({ kind: 'set', doc, version });
    },

    markSaved: () => api.setState({ savedCursorId: history.cursorId }),
    select: (id, selectOptions) =>
      api.setState((state) =>
        Object.hasOwn(state.doc.nodes, id)
          ? selectIn(state, id, selectOptions?.mode, selectOptions?.instance)
          : state,
      ),
    setSelection: (ids) =>
      api.setState((state) => {
        const next: SelectionState = {
          selectedIds: ids,
          anchorId: null,
          selectedInstance: undefined,
        };
        return normalizeSelection(state.doc, next);
      }),
    clearSelection: () => api.setState(EMPTY_SELECTION),
    moveSelection(move) {
      const { doc, anchorId } = api.getState();
      if (anchorId === null) return undefined;
      const target = relativeNode(doc, anchorId, move);
      if (target === undefined) return undefined;
      api.setState(selectIn(EMPTY_SELECTION, target));
      return target;
    },
    setHovered: (id) => api.setState({ hoveredId: id }),
    setReadOnly: (readOnly) => api.setState({ readOnly }),

    onChange(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    validateNow,
    destroy: () => timers.clearTimeout(timer),
  };
  return store;
}
