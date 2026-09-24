import type {
  A11yIssue,
  BuilderDocument,
  IdGenerator,
  NodeId,
  RegistryMeta,
  Result,
  ValidationIssue,
} from '@buildr/core';
import type {
  Command,
  CommandEnv,
  CommandError,
  CommandRegistry,
  CommandResult,
  DocumentPatch,
  HistoryManager,
  HistoryOptions,
} from '@buildr/core/commands';
import type { StoreApi } from 'zustand/vanilla';
import type { SelectionMove, SelectMode } from './selection.ts';

/** Findings about the document as it is now, recomputed after it stops changing. */
export interface ValidationSnapshot {
  /** The version of the document they describe. */
  readonly docVersion: number;
  readonly issues: readonly ValidationIssue[];
  readonly a11y: readonly A11yIssue[];
}

/** The editor's state (docs/state-management.md#slices). Data only: what changes it is on `EditorStore`. */
export interface EditorState {
  // --- document ---
  readonly doc: BuilderDocument;
  /** Counts every change to `doc` (a command, an undo, a redo, a replacement), so the canvas can tell what it missed. */
  readonly docVersion: number;
  /** The document may not be changed (a component newer than this build knows, a viewer's role). */
  readonly readOnly: boolean;

  // --- history ---
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly inTransaction: boolean;
  /** Where in the history the document is; changes with every step, returns on undo. */
  readonly cursorId: string;
  /** The `cursorId` that was last saved; the document is dirty when it differs. */
  readonly savedCursorId: string;
  readonly undoLabel: string | undefined;
  readonly redoLabel: string | undefined;

  // --- selection ---
  /** In the order they were selected; only nodes of `doc`. */
  readonly selectedIds: readonly NodeId[];
  /** The node the selection is centred on: the inspector shows it, keyboard moves start from it. */
  readonly anchorId: NodeId | null;
  /** Which repetition of a Loop the single selected node is, as the canvas reported it. */
  readonly selectedInstance: string | undefined;
  readonly hoveredId: NodeId | null;

  // --- derived, debounced ---
  readonly validation: ValidationSnapshot | undefined;
}

/** A change to the document, as the canvas host sends it on (`doc:patch`, `doc:set`). */
export type DocumentChange =
  | {
      readonly kind: 'patch';
      readonly from: number;
      readonly to: number;
      readonly patches: readonly DocumentPatch[];
    }
  | { readonly kind: 'set'; readonly doc: BuilderDocument; readonly version: number };

export interface DispatchOptions {
  /** Names the undo step; the command's type by default. */
  readonly label?: string;
}

export interface EditorStoreOptions {
  readonly doc: BuilderDocument;
  readonly registry: RegistryMeta;
  /** The command set; the core commands by default. */
  readonly commands?: CommandRegistry;
  readonly generateId?: IdGenerator;
  readonly canUnlock?: CommandEnv['canUnlock'];
  /** Run `checkInvariants` after every command (a development aid); off by default. */
  readonly checkInvariants?: boolean;
  readonly readOnly?: boolean;
  readonly history?: HistoryOptions;
  /** Injected so tests control the validation delay. */
  readonly timers?: {
    setTimeout(callback: () => void, ms: number): unknown;
    clearTimeout(handle: unknown): void;
  };
  /** Validation and accessibility checks run this long after the last change; `null` turns them off. */
  readonly validationDelayMs?: number | null;
}

/** The store and what changes it. Every change to the document goes through `dispatch`, `undo`, `redo` or `replaceDocument`. */
export interface EditorStore extends StoreApi<EditorState> {
  /** The registry the commands run against; the palette asks it what may go where. */
  readonly registry: RegistryMeta;
  /** Runs a command (`execute`) on the document and records it in the history. */
  dispatch(command: Command, options?: DispatchOptions): Result<CommandResult, CommandError>;
  /** Runs commands as one undo step, all or nothing (`executeBatch`). */
  dispatchBatch(
    commands: readonly Command[],
    options?: DispatchOptions,
  ): Result<CommandResult, CommandError>;
  /**
   * Everything dispatched inside `fn` becomes one undo step. Returning `false` or throwing rolls it
   * back (the document goes back to what it was; a throw is rethrown).
   */
  transaction(label: string, fn: () => boolean | undefined): boolean;
  undo(): Result<true, CommandError>;
  redo(): Result<true, CommandError>;
  /** Loads another document; the history starts again. */
  replaceDocument(doc: BuilderDocument, options?: { readonly readOnly?: boolean }): void;
  /** Says that the document as it is now is the saved one. */
  markSaved(): void;
  /** Selects a node: replaces the selection, toggles it (Ctrl/Cmd) or adds to it (Shift). */
  select(id: NodeId, options?: { readonly mode?: SelectMode; readonly instance?: string }): void;
  /** Replaces the selection; the last id becomes the anchor. */
  setSelection(ids: readonly NodeId[]): void;
  clearSelection(): void;
  /** Moves the selection one step from the anchor; returns the node now selected, or `undefined` when there was nowhere to go. */
  moveSelection(move: SelectionMove): NodeId | undefined;
  setHovered(id: NodeId | null): void;
  setReadOnly(readOnly: boolean): void;
  /** Called after every change to the document. Returns the function that stops listening. */
  onChange(listener: (change: DocumentChange) => void): () => void;
  /** Runs validation and the accessibility checks now, instead of after the delay. */
  validateNow(): ValidationSnapshot;
  readonly history: HistoryManager;
  /** Stops the pending validation. */
  destroy(): void;
}
