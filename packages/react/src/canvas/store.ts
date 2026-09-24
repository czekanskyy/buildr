import type { BuilderDocument, Diagnostic, NodeId, PageNode, Rect } from '@buildr/core';
import { applyDocumentPatches } from '@buildr/core/commands';

/** The locales the editor's project has, as `editor:init` carries them. */
export interface CanvasLocales {
  readonly locales: readonly string[];
  readonly default: string;
  readonly fallback: boolean;
  readonly intl: Readonly<Record<string, string>>;
}

/** What the canvas draws for a drag in progress: the insertion line, a container that will take the drop, or a refusal. */
export interface DropView {
  readonly kind: 'line' | 'inside' | 'forbidden';
  readonly rect: Rect;
  /** Why a drop is refused, for `forbidden`. */
  readonly message?: string;
}

/** What the editor last told the canvas. The canvas never edits any of it: it only receives. */
export interface CanvasState {
  /** The replica of the editor's document; `undefined` until `editor:init`. */
  readonly doc: BuilderDocument | undefined;
  /** The version of `doc`, as the editor counts them. */
  readonly version: number;
  /** How many `editor:init`s have arrived: the canvas answers each with `canvas:ready`. */
  readonly initCount: number;
  readonly selection: readonly NodeId[];
  readonly hover: NodeId | null;
  readonly viewport: { readonly breakpoint: string; readonly width: number };
  readonly mode: 'edit' | 'interact';
  readonly locale: string;
  readonly locales: CanvasLocales | undefined;
  readonly contextRef: string | null;
  /** The drag indicator, drawn by the overlay; owned by the canvas itself. */
  readonly drop: DropView | null;
}

/** How a `doc:patch` was received. */
export type PatchOutcome =
  /** Applied: the replica is now at `to`. */
  | 'applied'
  /** Not the next version: something was missed, so the editor must send the document again. */
  | 'gap'
  /** Already applied (a duplicate or a late message): nothing to do. */
  | 'stale'
  /** Could not be applied to this document: the replica may have drifted, so it must be replaced. */
  | 'invalid';

export interface CanvasStore {
  getState(): CanvasState;
  /** Called after any change to the state. */
  subscribe(listener: () => void): () => void;
  getNode(id: NodeId): BuilderDocument['nodes'][string] | undefined;
  /**
   * Called when the node `id` changed, appeared or disappeared, and only then: a change elsewhere
   * in the document, patches included, leaves the node's identity alone.
   */
  subscribeNode(id: NodeId, listener: () => void): () => void;
  /**
   * Freezes what a node's view sees while its text is being edited in place: patches still reach
   * the replica, but the view keeps its node (and so its DOM, and the caret in it) until
   * `endEdit`, which shows the latest.
   */
  beginEdit(id: NodeId): void;
  endEdit(): void;
  /** The node being edited in place, if any. */
  editing(): NodeId | null;
  /** Replaces the replica (`editor:init`, `doc:set`). */
  setDocument(doc: BuilderDocument, version: number): void;
  applyPatches(from: number, to: number, patches: readonly unknown[]): PatchOutcome;
  /** Records an `editor:init`, whose other parts (viewport, locale, ...) come with it. */
  init(state: Omit<CanvasState, 'initCount' | 'drop'>): void;
  update(partial: Partial<Omit<CanvasState, 'doc' | 'version' | 'initCount'>>): void;
  /** What each node reported while rendering; replaces what it reported before. */
  setDiagnostics(key: string, items: readonly Diagnostic[]): void;
  getDiagnostics(): readonly Diagnostic[];
  /** Called after any change to the diagnostics. */
  subscribeDiagnostics(listener: () => void): () => void;
}

const INITIAL: CanvasState = {
  doc: undefined,
  version: 0,
  initCount: 0,
  selection: [],
  hover: null,
  viewport: { breakpoint: 'desktop', width: 1280 },
  mode: 'edit',
  locale: 'en',
  locales: undefined,
  contextRef: null,
  drop: null,
};

/** Every id whose node differs between two documents, in either direction. */
function changedNodes(prev: BuilderDocument | undefined, next: BuilderDocument): NodeId[] {
  if (prev === undefined) return Object.keys(next.nodes);
  const changed: NodeId[] = [];
  for (const id of Object.keys(next.nodes)) {
    if (!Object.hasOwn(prev.nodes, id) || prev.nodes[id] !== next.nodes[id]) changed.push(id);
  }
  for (const id of Object.keys(prev.nodes)) {
    if (!Object.hasOwn(next.nodes, id)) changed.push(id);
  }
  return changed;
}

/**
 * The canvas's replica of the editor's state, small and subscribable per node (docs/editor.md).
 * A node is a subscription of its own: applying patches keeps the identity of every node they did
 * not touch (Immer's structural sharing), so only the nodes that changed are notified and only
 * their views render again.
 */
export function createCanvasStore(): CanvasStore {
  let state = INITIAL;
  const listeners = new Set<() => void>();
  const nodeListeners = new Map<NodeId, Set<() => void>>();
  const diagnosticListeners = new Set<() => void>();
  const diagnostics = new Map<string, readonly Diagnostic[]>();
  let flat: readonly Diagnostic[] = [];

  let edit: { id: NodeId; node: PageNode | undefined } | null = null;

  const emit = () => {
    for (const listener of [...listeners]) listener();
  };

  const notifyNodes = (ids: readonly NodeId[]) => {
    for (const id of ids) {
      for (const listener of [...(nodeListeners.get(id) ?? [])]) listener();
    }
  };

  const replace = (doc: BuilderDocument, version: number, initCount = state.initCount) => {
    const changed = changedNodes(state.doc, doc);
    state = { ...state, doc, version, initCount };
    notifyNodes(changed);
    emit();
  };

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getNode: (id) =>
      edit?.id === id
        ? edit.node
        : state.doc !== undefined && Object.hasOwn(state.doc.nodes, id)
          ? state.doc.nodes[id]
          : undefined,
    beginEdit(id) {
      const node =
        state.doc !== undefined && Object.hasOwn(state.doc.nodes, id)
          ? state.doc.nodes[id]
          : undefined;
      edit = { id, node };
    },
    endEdit() {
      if (edit === null) return;
      const { id } = edit;
      edit = null;
      notifyNodes([id]);
    },
    editing: () => edit?.id ?? null,
    subscribeNode(id, listener) {
      const set = nodeListeners.get(id) ?? new Set();
      set.add(listener);
      nodeListeners.set(id, set);
      return () => {
        set.delete(listener);
        if (set.size === 0) nodeListeners.delete(id);
      };
    },
    setDocument: (doc, version) => replace(doc, version),
    applyPatches(from, to, patches) {
      const doc = state.doc;
      if (doc === undefined || from !== state.version) return to <= state.version ? 'stale' : 'gap';
      const result = applyDocumentPatches(doc, patches);
      if (!result.ok) return 'invalid';
      replace(result.value, to);
      return 'applied';
    },
    init(next) {
      const { doc, version, ...rest } = next;
      const changed = doc === undefined ? [] : changedNodes(state.doc, doc);
      state = { ...state, ...rest, doc, version, initCount: state.initCount + 1 };
      notifyNodes(changed);
      emit();
    },
    update(partial) {
      state = { ...state, ...partial };
      emit();
    },
    setDiagnostics(key, items) {
      const before = diagnostics.get(key);
      if (items.length === 0 && before === undefined) return;
      if (
        before !== undefined &&
        before.length === items.length &&
        JSON.stringify(before) === JSON.stringify(items)
      ) {
        return;
      }
      if (items.length === 0) diagnostics.delete(key);
      else diagnostics.set(key, items);
      flat = [...diagnostics.values()].flat();
      for (const listener of [...diagnosticListeners]) listener();
    },
    getDiagnostics: () => flat,
    subscribeDiagnostics(listener) {
      diagnosticListeners.add(listener);
      return () => {
        diagnosticListeners.delete(listener);
      };
    },
  };
}
