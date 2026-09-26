import {
  type BuilderDocument,
  type ComponentMeta,
  createRegistryMeta,
  createSeededIdGenerator,
  type PageNode,
  p,
  s,
} from '@next-buildr/core';
import type { Command } from '@next-buildr/core/commands';
import { describe, expect, it } from 'vitest';
import { createEditorStore } from './create-store.ts';
import { selectChildren, selectIndex, selectIsDirty, selectNode } from './selectors.ts';
import type { DocumentChange, EditorStoreOptions } from './types.ts';

const meta = (type: string, overrides: Partial<ComponentMeta> = {}): ComponentMeta => ({
  type,
  version: 1,
  label: type,
  category: 'content',
  props: {},
  contentCategories: ['flow'],
  styles: { groups: [] },
  runtime: 'shared',
  ...overrides,
});

const registry = createRegistryMeta({
  components: [
    meta('buildr/page', { capabilities: { root: true }, slots: { default: {} } }),
    meta('buildr/box', { slots: { default: {} } }),
    meta('buildr/text', { props: { text: p.text({ default: '' }) } }),
  ],
});

const node = (id: string, type: string, extra: Partial<PageNode> = {}): PageNode => ({
  id,
  type,
  ...extra,
});

function fixture(): BuilderDocument {
  return {
    schemaVersion: 1,
    root: 'root',
    nodes: {
      root: node('root', 'buildr/page', { slots: { default: ['boxNode001'] } }),
      boxNode001: node('boxNode001', 'buildr/box', {
        slots: { default: ['textNodeA1', 'textNodeB1'] },
      }),
      textNodeA1: node('textNodeA1', 'buildr/text', { props: { text: s('A') } }),
      textNodeB1: node('textNodeB1', 'buildr/text', { props: { text: s('B') } }),
    },
    components: { 'buildr/page': 1, 'buildr/box': 1, 'buildr/text': 1 },
  };
}

/** A document that throws on any write, at any depth: proof that nothing mutates it. */
function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

const create = (overrides: Partial<EditorStoreOptions> = {}) =>
  createEditorStore({
    doc: fixture(),
    registry,
    generateId: createSeededIdGenerator(7),
    validationDelayMs: null,
    ...overrides,
  });

const setText = (id: string, text: string): Command => ({
  type: 'node.setProp',
  payload: { id, prop: 'text', value: s(text) },
});
const remove = (...ids: string[]): Command => ({ type: 'node.remove', payload: { ids } });
const textOf = (store: ReturnType<typeof create>, id: string) =>
  JSON.stringify(selectNode(store.getState(), id)?.props?.['text']);

describe('dispatch', () => {
  it('runs a command, swaps the document in and counts the version', () => {
    const store = create();
    const before = store.getState().doc;
    const result = store.dispatch(setText('textNodeA1', 'Changed'));
    expect(result.ok).toBe(true);
    const state = store.getState();
    expect(state.doc).not.toBe(before);
    expect(textOf(store, 'textNodeA1')).toContain('Changed');
    expect(state.docVersion).toBe(1);
    expect(state.canUndo).toBe(true);
    expect(state.undoLabel).toBe('node.setProp');
    // Structural sharing: an untouched node is the very same object.
    expect(selectNode(state, 'textNodeB1')).toBe(before.nodes['textNodeB1']);
  });

  it('leaves everything as it was when a command fails', () => {
    const store = create();
    const before = store.getState();
    const result = store.dispatch(setText('missing', 'x'));
    expect(result.ok).toBe(false);
    expect(store.getState()).toBe(before);
  });

  it('refuses in a read-only document', () => {
    const store = create({ readOnly: true });
    const result = store.dispatch(setText('textNodeA1', 'x'));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('editor.read-only');
    expect(store.undo().ok).toBe(false);
    expect(store.transaction('x', () => true)).toBe(false);
    store.setReadOnly(false);
    expect(store.dispatch(setText('textNodeA1', 'x')).ok).toBe(true);
  });

  it('names the undo step, and merges typing into one', () => {
    const store = create();
    store.dispatch(setText('textNodeA1', 'A1'), { label: 'Edit text' });
    store.dispatch(setText('textNodeA1', 'A12'), { label: 'Edit text' });
    expect(store.getState().undoLabel).toBe('Edit text');
    expect(store.history.past).toHaveLength(1);
  });

  it('runs a batch as one undo step, all or nothing', () => {
    const store = create();
    const failed = store.dispatchBatch([setText('textNodeA1', '1'), setText('missing', '2')]);
    expect(failed.ok).toBe(false);
    expect(textOf(store, 'textNodeA1')).toContain('A');
    expect(store.getState().docVersion).toBe(0);

    expect(
      store.dispatchBatch([setText('textNodeA1', '1'), setText('textNodeB1', '2')], {
        label: 'Two',
      }).ok,
    ).toBe(true);
    expect(store.history.past).toHaveLength(1);
    store.undo();
    expect(textOf(store, 'textNodeA1')).toContain('A');
    expect(textOf(store, 'textNodeB1')).toContain('B');
  });
});

describe('undo and redo', () => {
  it('go back and forth, with the version always moving forward', () => {
    const store = create();
    store.dispatch(setText('textNodeA1', 'One'));
    store.dispatch(remove('textNodeB1'));
    expect(selectNode(store.getState(), 'textNodeB1')).toBeUndefined();

    expect(store.undo().ok).toBe(true);
    expect(selectNode(store.getState(), 'textNodeB1')).toBeDefined();
    expect(store.getState().canRedo).toBe(true);
    expect(store.getState().redoLabel).toBe('node.remove');

    expect(store.redo().ok).toBe(true);
    expect(selectNode(store.getState(), 'textNodeB1')).toBeUndefined();
    expect(store.getState().docVersion).toBe(4);

    store.undo();
    store.undo();
    expect(JSON.stringify(store.getState().doc)).toBe(JSON.stringify(fixture()));
    expect(store.undo().ok).toBe(false);
    expect(store.getState().canUndo).toBe(false);
  });

  it('restores the selection that went with the step', () => {
    const store = create();
    store.setSelection(['textNodeB1']);
    store.dispatch(remove('textNodeB1'));
    expect(store.getState().selectedIds).not.toContain('textNodeB1');
    store.undo();
    expect(store.getState().selectedIds).toEqual(['textNodeB1']);
  });

  it('a new change drops what could be redone', () => {
    const store = create();
    store.dispatch(setText('textNodeA1', 'One'));
    store.undo();
    store.dispatch(setText('textNodeB1', 'Two'));
    expect(store.getState().canRedo).toBe(false);
  });
});

describe('transactions', () => {
  it('make everything inside one step', () => {
    const store = create();
    const done = store.transaction('Rewrite', () => {
      store.dispatch(setText('textNodeA1', '1'));
      store.dispatch(setText('textNodeB1', '2'));
      return true;
    });
    expect(done).toBe(true);
    expect(store.getState().inTransaction).toBe(false);
    expect(store.history.past).toHaveLength(1);
    expect(store.getState().undoLabel).toBe('Rewrite');
    store.undo();
    expect(JSON.stringify(store.getState().doc)).toBe(JSON.stringify(fixture()));
  });

  it('roll back when told to, and when they throw', () => {
    const store = create();
    expect(
      store.transaction('No', () => {
        store.dispatch(setText('textNodeA1', '1'));
        return false;
      }),
    ).toBe(false);
    expect(JSON.stringify(store.getState().doc)).toBe(JSON.stringify(fixture()));
    expect(store.getState().canUndo).toBe(false);

    expect(() =>
      store.transaction('Boom', () => {
        store.dispatch(setText('textNodeA1', '1'));
        throw new Error('boom');
      }),
    ).toThrow('boom');
    expect(JSON.stringify(store.getState().doc)).toBe(JSON.stringify(fixture()));
    expect(store.getState().inTransaction).toBe(false);
  });

  it('cannot be nested', () => {
    const store = create();
    let inner: boolean | undefined;
    store.transaction('Outer', () => {
      inner = store.transaction('Inner', () => true);
      return true;
    });
    expect(inner).toBe(false);
  });
});

describe('what the canvas host hears', () => {
  it('a patch per change, from and to consecutive versions, that reproduce the document', async () => {
    const { applyDocumentPatches } = await import('@next-buildr/core/commands');
    const store = create();
    const seen: DocumentChange[] = [];
    store.onChange((change) => seen.push(change));
    let replica = fixture();

    store.dispatch(setText('textNodeA1', 'One'));
    store.dispatch(remove('textNodeB1'));
    store.undo();
    store.redo();

    expect(seen.map((c) => (c.kind === 'patch' ? [c.from, c.to] : null))).toEqual([
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
    ]);
    for (const change of seen) {
      if (change.kind !== 'patch') throw new Error('expected patches');
      const applied = applyDocumentPatches(replica, change.patches);
      if (!applied.ok) throw new Error(applied.error.message);
      replica = applied.value;
    }
    expect(JSON.stringify(replica)).toBe(JSON.stringify(store.getState().doc));
  });

  it('a set for a replaced document, which also forgets the history; and stops when unsubscribed', () => {
    const store = create();
    const seen: DocumentChange[] = [];
    const off = store.onChange((change) => seen.push(change));
    store.dispatch(setText('textNodeA1', 'One'));
    const other = fixture();
    store.replaceDocument(other);
    expect(seen.at(-1)).toEqual({ kind: 'set', doc: other, version: 2 });
    expect(store.getState().canUndo).toBe(false);
    expect(store.getState().docVersion).toBe(2);
    off();
    store.dispatch(setText('textNodeB1', 'x'));
    expect(seen).toHaveLength(2);
  });
});

describe('selection', () => {
  it('keeps only nodes that exist', () => {
    const store = create();
    store.setSelection(['textNodeA1', 'ghost', 'textNodeA1', 'textNodeB1']);
    expect(store.getState().selectedIds).toEqual(['textNodeA1', 'textNodeB1']);
    store.dispatch(remove('textNodeA1'));
    expect(store.getState().selectedIds).toEqual(['textNodeB1']);
  });
});

describe('dirty state', () => {
  it('is clean again after undoing back to the saved state', () => {
    const store = create();
    expect(selectIsDirty(store.getState())).toBe(false);
    store.dispatch(setText('textNodeA1', 'One'));
    expect(selectIsDirty(store.getState())).toBe(true);
    store.markSaved();
    expect(selectIsDirty(store.getState())).toBe(false);
    store.dispatch(setText('textNodeB1', 'Two'));
    expect(selectIsDirty(store.getState())).toBe(true);
    store.undo();
    expect(selectIsDirty(store.getState())).toBe(false);
    store.undo();
    expect(selectIsDirty(store.getState())).toBe(true);
  });
});

describe('derived state', () => {
  it('builds the index once per document', () => {
    const store = create();
    const first = selectIndex(store.getState());
    expect(selectIndex(store.getState())).toBe(first);
    store.dispatch(setText('textNodeA1', 'One'));
    expect(selectIndex(store.getState())).not.toBe(first);
    expect(selectChildren(store.getState(), 'boxNode001')).toEqual(['textNodeA1', 'textNodeB1']);
    expect(selectChildren(store.getState(), 'boxNode001', 'nope')).toEqual([]);
  });

  it('validates a moment after the last change, not on each one', () => {
    const scheduled: { callback: () => void; ms: number }[] = [];
    const cleared: unknown[] = [];
    const store = create({
      validationDelayMs: 300,
      timers: {
        setTimeout: (callback, ms) => {
          scheduled.push({ callback, ms });
          return scheduled.length;
        },
        clearTimeout: (h) => cleared.push(h),
      },
    });
    store.dispatch(setText('textNodeA1', 'One'));
    store.dispatch(setText('textNodeB1', 'Two'));
    expect(store.getState().validation).toBeUndefined();
    expect(scheduled.map((t) => t.ms)).toEqual([300, 300]);
    expect(cleared).toContain(1);

    scheduled.at(-1)?.callback();
    const validation = store.getState().validation;
    expect(validation?.docVersion).toBe(2);
    expect(validation?.issues).toEqual([]);
    expect(Array.isArray(validation?.a11y)).toBe(true);
  });

  it('validates on request, and reports a problem the document has', () => {
    const base = fixture();
    const doc = {
      ...base,
      nodes: { ...base.nodes, textNodeA1: node('textNodeA1', 'acme/unknown') },
    };
    const store = create({ doc, validationDelayMs: null });
    const snapshot = store.validateNow();
    expect(snapshot.issues.length).toBeGreaterThan(0);
    expect(store.getState().validation).toBe(snapshot);
  });
});

describe('no mutation outside execute', () => {
  it('works on a deeply frozen document through every operation', () => {
    const store = create({ doc: deepFreeze(fixture()) });
    expect(() => {
      store.dispatch(setText('textNodeA1', 'One'));
      store.dispatch(remove('textNodeB1'));
      store.undo();
      store.redo();
      store.transaction('T', () => {
        store.dispatch(setText('textNodeA1', 'Two'));
        return true;
      });
      store.transaction('R', () => {
        store.dispatch(setText('textNodeA1', 'Three'));
        return false;
      });
      store.undo();
      store.replaceDocument(deepFreeze(fixture()));
      store.dispatch(setText('textNodeB1', 'Four'));
      store.validateNow();
    }).not.toThrow();
    expect(textOf(store, 'textNodeB1')).toContain('Four');
  });
});
