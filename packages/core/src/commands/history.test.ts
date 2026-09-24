import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { BuilderDocument } from '../document/types.ts';
import { applyDocumentPatches } from './apply-patches.ts';
import { execute, executeBatch } from './execute.ts';
import { buildDoc, cmd, env, ID, node } from './handlers/handlers.test-kit.ts';
import { createHistory, type HistoryManager } from './history.ts';
import { commandMergeKey } from './registry.ts';
import type { Command } from './types.ts';

const [A, B] = [ID(1), ID(2)];
const initial = (): BuilderDocument =>
  buildDoc([node(A, 'buildr/section', []), node(B, 'buildr/section', [])], [A, B]);

const rename = (id: string, name: string) => cmd('node.setAttr', { id, key: 'name', value: name });

/** A tiny editor: a document + a history, wired the way the store will wire them. */
function editor(options: { limit?: number; mergeWindowMs?: number } = {}) {
  let now = 0;
  const history = createHistory({ ...options, clock: () => now });
  let doc = initial();
  let selection: readonly string[] = [];
  const api = {
    history,
    get doc() {
      return doc;
    },
    get selection() {
      return selection;
    },
    tick(ms: number) {
      now += ms;
    },
    dispatch(command: Command, label = command.type) {
      const result = execute(doc, command, env);
      if (!result.ok) throw new Error(result.error.message);
      const before = selection;
      doc = result.value.doc;
      selection = result.value.select ?? selection;
      history.record({
        label,
        commands: [command],
        patches: result.value.patches,
        inverse: result.value.inverse,
        selectionBefore: before,
        selectionAfter: selection,
        mergeKey: commandMergeKey(env.commands, [command]),
      });
    },
    undo() {
      const step = history.undo();
      if (!step) return false;
      const next = applyDocumentPatches(doc, step.patches);
      if (!next.ok) throw new Error(next.error.message);
      doc = next.value;
      selection = step.selection;
      return true;
    },
    redo() {
      const step = history.redo();
      if (!step) return false;
      const next = applyDocumentPatches(doc, step.patches);
      if (!next.ok) throw new Error(next.error.message);
      doc = next.value;
      selection = step.selection;
      return true;
    },
  };
  return api;
}

const nameOf = (e: ReturnType<typeof editor>, id = A) => e.doc.nodes[id]?.name;

describe('undo / redo', () => {
  it('walks back and forward through a sequence, restoring document and selection', () => {
    const e = editor();
    const start = e.doc;
    e.dispatch(cmd('node.setAttr', { id: A, key: 'name', value: 'one' }));
    e.dispatch(rename(B, 'two'));
    e.dispatch(rename(A, 'three'));
    expect([nameOf(e), nameOf(e, B)]).toEqual(['three', 'two']);

    expect(e.undo() && e.undo()).toBe(true);
    expect([nameOf(e), nameOf(e, B)]).toEqual(['one', undefined]);
    e.undo();
    expect(e.doc).toEqual(start);
    expect(e.undo()).toBe(false);

    e.redo();
    e.redo();
    e.redo();
    expect([nameOf(e), nameOf(e, B)]).toEqual(['three', 'two']);
    expect(e.redo()).toBe(false);
  });

  it('a new command after an undo clears the redo stack', () => {
    const e = editor();
    e.dispatch(rename(A, 'one'));
    e.dispatch(rename(A, 'two'));
    e.undo();
    expect(e.history.canRedo).toBe(true);
    e.dispatch(rename(B, 'other'));
    expect(e.history.canRedo).toBe(false);
    expect(e.history.future).toEqual([]);
  });

  it('restores the selection before and after each step', () => {
    const e = editor();
    const insert = cmd('node.insert', {
      parentId: A,
      slot: 'default',
      index: 0,
      fragment: {
        format: 'buildr/fragment',
        schemaVersion: 1,
        components: { 'buildr/text': 1 },
        roots: [ID(50)],
        nodes: { [ID(50)]: { id: ID(50), type: 'buildr/text' } },
      },
    });
    e.dispatch(insert);
    expect(e.selection).toEqual([ID(50)]);
    e.undo();
    expect(e.selection).toEqual([]);
    e.redo();
    expect(e.selection).toEqual([ID(50)]);
  });

  it('ignores a command that changed nothing', () => {
    const e = editor();
    e.dispatch(rename(A, 'x'));
    e.dispatch(rename(A, 'x'));
    expect(e.history.past).toHaveLength(1);
  });

  it('property: undoing everything restores the document, redoing everything restores the result', () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({ id: fc.constantFrom(A, B), name: fc.string({ maxLength: 5 }) }), {
          maxLength: 10,
        }),
        (edits) => {
          const e = editor();
          const start = e.doc;
          for (const edit of edits) {
            e.tick(5_000); // far apart, so nothing merges
            e.dispatch(rename(edit.id, edit.name));
          }
          const end = e.doc;
          while (e.undo());
          expect(e.doc).toEqual(start);
          while (e.redo());
          expect(e.doc).toEqual(end);
        },
      ),
    );
  });
});

describe('coalescing', () => {
  it('merges same-key commands inside the window into one undo step', () => {
    const e = editor();
    e.dispatch(rename(A, 'a'));
    e.tick(300);
    e.dispatch(rename(A, 'ab'));
    e.tick(300);
    e.dispatch(rename(A, 'abc'));
    expect(e.history.past).toHaveLength(1);
    expect(e.history.past[0]?.commands).toHaveLength(3);
    e.undo();
    expect(nameOf(e)).toBeUndefined();
    e.redo();
    expect(nameOf(e)).toBe('abc');
  });

  it('the window slides: each record extends it', () => {
    const e = editor();
    for (const name of ['a', 'ab', 'abc', 'abcd']) {
      e.dispatch(rename(A, name));
      e.tick(700);
    }
    expect(e.history.past).toHaveLength(1);
  });

  it('starts a new step once the window has passed, or when the key differs', () => {
    const e = editor();
    e.dispatch(rename(A, 'a'));
    e.tick(801);
    e.dispatch(rename(A, 'ab'));
    e.tick(10);
    e.dispatch(rename(B, 'other'));
    expect(e.history.past).toHaveLength(3);
  });

  it('the window is configurable', () => {
    const e = editor({ mergeWindowMs: 50 });
    e.dispatch(rename(A, 'a'));
    e.tick(60);
    e.dispatch(rename(A, 'ab'));
    expect(e.history.past).toHaveLength(2);
  });

  it('never merges across an undo or redo', () => {
    const e = editor();
    e.dispatch(rename(A, 'a'));
    e.dispatch(rename(A, 'ab'));
    e.undo();
    e.redo();
    e.dispatch(rename(A, 'abc'));
    expect(e.history.past).toHaveLength(2);
  });

  it('commands without a merge key never merge', () => {
    const e = editor();
    const remove = (id: string) => cmd('node.remove', { ids: [id] });
    e.dispatch(remove(A));
    e.dispatch(remove(B));
    expect(e.history.past).toHaveLength(2);
    expect(commandMergeKey(env.commands, [remove(A), remove(B)])).toBeUndefined();
    expect(commandMergeKey(env.commands, [])).toBeUndefined();
  });
});

describe('transactions', () => {
  it('collapse several records into one entry with one undo', () => {
    const e = editor();
    const start = e.doc;
    expect(e.history.begin('Rename both').ok).toBe(true);
    e.dispatch(rename(A, 'a'));
    e.dispatch(rename(B, 'b'));
    e.dispatch(rename(A, 'aa'));
    expect(e.history.inTransaction).toBe(true);
    expect(e.history.past).toHaveLength(0);
    const committed = e.history.commit();
    expect(committed.ok && committed.value?.label).toBe('Rename both');
    expect(e.history.past).toHaveLength(1);
    expect(e.history.past[0]?.commands).toHaveLength(3);
    e.undo();
    expect(e.doc).toEqual(start);
    e.redo();
    expect([nameOf(e), nameOf(e, B)]).toEqual(['aa', 'b']);
  });

  it('a transaction is never merged into its neighbours, and an empty one leaves no entry', () => {
    const e = editor();
    e.dispatch(rename(A, 'a'));
    e.history.begin('x');
    e.dispatch(rename(A, 'ab'));
    e.history.commit();
    expect(e.history.past).toHaveLength(2);
    e.history.begin('empty');
    const empty = e.history.commit();
    expect(empty.ok && empty.value).toBeUndefined();
    expect(e.history.past).toHaveLength(2);
  });

  it('rollback returns the patches that revert everything recorded, and records nothing', () => {
    const e = editor();
    const start = e.doc;
    e.history.begin('fails');
    e.dispatch(rename(A, 'a'));
    e.dispatch(rename(B, 'b'));
    const rolled = e.history.rollback();
    if (!rolled.ok) throw new Error('unexpected');
    const back = applyDocumentPatches(e.doc, rolled.value);
    expect(back.ok && back.value).toEqual(start);
    expect(e.history.past).toHaveLength(0);
    expect(e.history.inTransaction).toBe(false);
  });

  it('a batch that fails partway leaves nothing to record', () => {
    const e = editor();
    e.history.begin('batch');
    const result = executeBatch(e.doc, [rename(A, 'a'), rename('missing', 'x')], env);
    expect(result.ok).toBe(false);
    expect(e.history.rollback()).toEqual({ ok: true, value: [] });
    expect(e.history.past).toHaveLength(0);
  });

  it('misuse is an Err, not an exception; undo/redo are unavailable while open', () => {
    const history = createHistory();
    expect(history.commit()).toMatchObject({
      ok: false,
      error: { code: 'history.no-transaction' },
    });
    expect(history.rollback()).toMatchObject({
      ok: false,
      error: { code: 'history.no-transaction' },
    });
    history.begin('one');
    expect(history.begin('two')).toMatchObject({
      ok: false,
      error: { code: 'history.transaction-open' },
    });
    expect(history.canUndo).toBe(false);
    expect(history.undo()).toBeUndefined();
    expect(history.redo()).toBeUndefined();
  });

  it('a transaction clears the redo stack when it commits', () => {
    const e = editor();
    e.dispatch(rename(A, 'a'));
    e.undo();
    e.history.begin('t');
    e.dispatch(rename(B, 'b'));
    e.history.commit();
    expect(e.history.canRedo).toBe(false);
  });
});

describe('limit', () => {
  it('keeps at most `limit` steps, dropping the oldest', () => {
    const e = editor({ limit: 3 });
    for (const name of ['a', 'b', 'c', 'd', 'e']) {
      e.tick(5_000);
      e.dispatch(rename(A, name));
    }
    expect(e.history.past).toHaveLength(3);
    while (e.undo());
    expect(nameOf(e)).toBe('b');
  });

  it('gives the floor of a trimmed history its own cursor id (found by the property test)', () => {
    const e = editor({ limit: 2 });
    const start = e.history.cursorId;
    for (const name of ['a', 'b', 'c']) {
      e.tick(5_000);
      e.dispatch(rename(A, name));
    }
    while (e.undo());
    // The oldest step was dropped, so the document at the floor is not the one the start id named.
    expect(nameOf(e)).toBe('a');
    expect(e.history.cursorId).not.toBe(start);
  });

  it('defaults to 200', () => {
    const e = editor();
    for (let i = 0; i < 250; i++) {
      e.tick(5_000);
      e.dispatch(rename(A, `n${i}`));
    }
    expect(e.history.past).toHaveLength(200);
  });
});

describe('cursorId (dirty tracking)', () => {
  const dirty = (history: HistoryManager, saved: string) => history.cursorId !== saved;

  it('is stable: undoing back to a saved point is clean again', () => {
    const e = editor();
    e.dispatch(rename(A, 'a'));
    const saved = e.history.cursorId;
    expect(dirty(e.history, saved)).toBe(false);
    e.tick(5_000);
    e.dispatch(rename(A, 'b'));
    expect(dirty(e.history, saved)).toBe(true);
    e.undo();
    expect(dirty(e.history, saved)).toBe(false);
    e.redo();
    expect(dirty(e.history, saved)).toBe(true);
  });

  it('a merge changes the cursor, so a saved point cannot look clean after an edit', () => {
    const e = editor();
    e.dispatch(rename(A, 'a'));
    const saved = e.history.cursorId;
    e.tick(100);
    e.dispatch(rename(A, 'ab'));
    expect(e.history.past).toHaveLength(1);
    expect(dirty(e.history, saved)).toBe(true);
  });

  it('the empty history has a cursor of its own, and undo returns to it', () => {
    const e = editor();
    const empty = e.history.cursorId;
    e.dispatch(rename(A, 'a'));
    expect(e.history.cursorId).not.toBe(empty);
    e.undo();
    expect(e.history.cursorId).toBe(empty);
  });

  it('clear() forgets everything and gives a fresh cursor', () => {
    const e = editor();
    const before = e.history.cursorId;
    e.dispatch(rename(A, 'a'));
    e.undo();
    e.history.clear();
    expect(e.history.past).toEqual([]);
    expect(e.history.future).toEqual([]);
    expect(e.history.cursorId).not.toBe(before);
    expect(e.history.canUndo || e.history.canRedo).toBe(false);
  });

  it('cursor ids are unique across the session', () => {
    const e = editor();
    const seen = new Set<string>([e.history.cursorId]);
    for (let i = 0; i < 20; i++) {
      e.tick(5_000);
      e.dispatch(rename(A, `n${i}`));
      seen.add(e.history.cursorId);
    }
    expect(seen.size).toBe(21);
  });
});
