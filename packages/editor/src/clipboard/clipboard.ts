import {
  type BuilderFragment,
  type ComponentMigrations,
  createIndex,
  extractFragment,
  generateId,
  type IdGenerator,
  isAncestor,
  migrateFragment,
  type NodeId,
  registryVersions,
  reId,
} from '@next-buildr/core';
import type { EditorStore } from '../store/index.ts';
import { type ClipboardError, parseClipboardText, serializeFragment } from './format.ts';

/** The system clipboard as far as the editor needs it; both calls may reject (no permission, no API). */
export interface ClipboardIO {
  writeText(text: string): Promise<void>;
  readText(): Promise<string>;
}

/** `navigator.clipboard`, or `undefined` where there is none (an insecure context, a test). */
export function browserClipboard(): ClipboardIO | undefined {
  if (typeof navigator === 'undefined' || navigator.clipboard === undefined) return undefined;
  const clipboard = navigator.clipboard;
  return {
    writeText: (text) => clipboard.writeText(text),
    readText: () => clipboard.readText(),
  };
}

export type ClipboardResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly error: ClipboardError };

export interface ClipboardOptions {
  readonly store: EditorStore;
  /** The system clipboard; the editor works without it, within this window only. */
  readonly io?: ClipboardIO | undefined;
  readonly generateId?: IdGenerator;
  /** What brings a fragment copied under older component versions up to the registry; without it such a paste is refused. */
  readonly migrations?: ComponentMigrations | undefined;
}

export interface Clipboard {
  copy(): Promise<ClipboardResult>;
  cut(): Promise<ClipboardResult>;
  paste(): Promise<ClipboardResult>;
}

interface Target {
  readonly parentId: NodeId;
  readonly slot: string;
  readonly index: number;
}

const fail = (error: ClipboardError): ClipboardResult => ({ ok: false, error });
const OK: ClipboardResult = { ok: true };

/** The selected nodes to copy, in document order, without the ones whose ancestor is selected too. */
function copyable(store: EditorStore): NodeId[] {
  const { doc, selectedIds } = store.getState();
  const rank = new Map(createIndex(doc).order.map((id, position) => [id, position]));
  const wanted = selectedIds.filter((id) => id !== doc.root && Object.hasOwn(doc.nodes, id));
  return wanted
    .filter((id) => !wanted.some((other) => other !== id && isAncestor(doc, other, id)))
    .sort((a, b) => (rank.get(a) ?? 0) - (rank.get(b) ?? 0));
}

/**
 * Where a paste could go, best first: after the selected node, inside it, then after each of its
 * ancestors, and finally at the end of the page. The first place the rules accept wins.
 */
function pasteTargets(store: EditorStore): Target[] {
  const { doc, anchorId } = store.getState();
  const index = createIndex(doc);
  const endOf = (parentId: NodeId, slot: string) => doc.nodes[parentId]?.slots?.[slot]?.length ?? 0;
  const after = (id: NodeId): Target | undefined => {
    const parentId = index.parentOf[id];
    const slot = index.slotOf[id];
    const position = index.indexOf[id];
    return parentId === undefined || slot === undefined || position === undefined
      ? undefined
      : { parentId, slot, index: position + 1 };
  };
  const targets: Target[] = [];
  if (anchorId !== null && anchorId !== doc.root && doc.nodes[anchorId] !== undefined) {
    const next = after(anchorId);
    if (next !== undefined) targets.push(next);
    const slots = new Set(['default', ...Object.keys(doc.nodes[anchorId]?.slots ?? {})]);
    for (const slot of slots)
      targets.push({ parentId: anchorId, slot, index: endOf(anchorId, slot) });
    for (
      let up = index.parentOf[anchorId];
      up !== undefined && up !== doc.root;
      up = index.parentOf[up]
    ) {
      const outer = after(up);
      if (outer !== undefined) targets.push(outer);
    }
  }
  targets.push({ parentId: doc.root, slot: 'default', index: endOf(doc.root, 'default') });
  return targets;
}

/**
 * Copy, cut and paste of nodes (docs/editor.md#clipboard-pb-085). What is copied is a fragment
 * (`extractFragment`) written as text with a marker; what is pasted is parsed, validated, given new
 * ids and inserted with `node.insert`, which checks it against the rules of the target. Without
 * access to the system clipboard the last copy is kept in memory. Paste can therefore never do more
 * than any other insert: an invalid fragment or an illegal place is refused, not partly applied.
 */
export function createClipboard(options: ClipboardOptions): Clipboard {
  const { store, io } = options;
  const idGenerator = options.generateId ?? generateId;
  let memory: string | undefined;

  async function copy(): Promise<ClipboardResult> {
    const ids = copyable(store);
    if (ids.length === 0) return fail({ code: 'empty' });
    const text = serializeFragment(extractFragment(store.getState().doc, ids));
    memory = text;
    try {
      await io?.writeText(text);
    } catch {
      // No permission or no API: the in-memory copy still serves this window.
    }
    return OK;
  }

  async function readText(): Promise<string | undefined> {
    if (io === undefined) return memory;
    try {
      return await io.readText();
    } catch {
      return memory;
    }
  }

  /** The fragment as the running registry knows it, or `undefined` when it is outdated and cannot be migrated. */
  function current(fragment: BuilderFragment): BuilderFragment | undefined {
    const versions = registryVersions(store.registry);
    // The nodes count too: a type left out of `components` must not slip past the check.
    const outdated = (candidate: BuilderFragment) =>
      Object.entries(candidate.components).some(([type, version]) => versions[type] !== version) ||
      Object.values(candidate.nodes).some(
        ({ type }) => versions[type] === undefined || candidate.components[type] !== versions[type],
      );
    if (!outdated(fragment)) return fragment;
    if (options.migrations === undefined) return undefined;
    try {
      const migrated = migrateFragment(fragment, options.migrations);
      // Still not what the registry serves (a type nothing migrates): refuse rather than guess.
      return migrated.readOnlyReasons.length === 0 && !outdated(migrated.fragment)
        ? migrated.fragment
        : undefined;
    } catch {
      return undefined;
    }
  }

  function insert(source: BuilderFragment): ClipboardResult {
    const fragment = current(source);
    if (fragment === undefined) return fail({ code: 'outdated' });
    let fresh: BuilderFragment;
    try {
      fresh = reId(fragment, idGenerator);
    } catch {
      // A child that is not in the fragment: the shape passed, the tree does not hold together.
      return fail({ code: 'invalid' });
    }
    let firstError: string | undefined;
    for (const target of pasteTargets(store)) {
      const result = store.dispatch({
        type: 'node.insert',
        payload: { ...target, fragment: fresh },
      });
      if (result.ok) return OK;
      firstError ??= result.error.message;
    }
    return fail({ code: 'rejected', detail: firstError });
  }

  return {
    copy,
    async cut() {
      if (store.getState().readOnly) return fail({ code: 'readOnly' });
      const copied = await copy();
      if (!copied.ok) return copied;
      const removed = store.dispatch({ type: 'node.remove', payload: { ids: copyable(store) } });
      return removed.ok ? OK : fail({ code: 'rejected', detail: removed.error.message });
    },
    async paste() {
      if (store.getState().readOnly) return fail({ code: 'readOnly' });
      const text = await readText();
      if (text === undefined) return fail({ code: 'notFragment' });
      const parsed = parseClipboardText(text);
      if (!parsed.ok) return parsed;
      return insert(parsed.fragment);
    },
  };
}
