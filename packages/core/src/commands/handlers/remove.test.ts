import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { checkInvariants } from '../../document/invariants.ts';
import { applyDocumentPatches } from '../apply-patches.ts';
import { canExecute, execute } from '../execute.ts';
import { buildDoc, cmd, env, ID, node, snapshot } from './handlers.test-kit.ts';

const [S, A, B, C, D, X] = [ID(1), ID(2), ID(3), ID(4), ID(5), ID(6)];

const text = (id: string) => node(id, 'buildr/text');
const remove = (...ids: string[]) => cmd('node.remove', { ids });

// root -> S -> [A, B(section -> [C]), D]
const doc = () =>
  buildDoc(
    [
      node(S, 'buildr/section', [A, B, D]),
      text(A),
      node(B, 'buildr/section', [C]),
      text(C),
      text(D),
    ],
    [S],
  );

function run(d: ReturnType<typeof doc>, ...ids: string[]) {
  const result = execute(d, remove(...ids), env);
  if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`);
  return result.value;
}

describe('node.remove', () => {
  it('removes a leaf', () => {
    const { doc: next, affected } = run(doc(), A);
    expect(next.nodes[S]?.slots?.default).toEqual([B, D]);
    expect(next.nodes[A]).toBeUndefined();
    expect(affected).toEqual([S]);
  });

  it('removes a whole subtree and leaves no orphans', () => {
    const { doc: next } = run(doc(), B);
    expect(next.nodes[S]?.slots?.default).toEqual([A, D]);
    expect(Object.keys(next.nodes).sort()).toEqual(['root', S, A, D].sort());
    expect(checkInvariants(next)).toEqual([]);
  });

  it('removes several nodes, and treats a node listed with its ancestor as redundant', () => {
    const { doc: next } = run(doc(), A, C, B);
    expect(next.nodes[S]?.slots?.default).toEqual([D]);
    expect(Object.keys(next.nodes).sort()).toEqual(['root', S, D].sort());
    expect(checkInvariants(next)).toEqual([]);
  });

  it('removing the same id twice is fine', () => {
    expect(run(doc(), A, A).doc.nodes[S]?.slots?.default).toEqual([B, D]);
  });

  it('selects the next sibling, else the previous one, else the parent', () => {
    expect(run(doc(), A).select).toEqual([B]);
    expect(run(doc(), D).select).toEqual([B]);
    expect(run(doc(), A, B).select).toEqual([D]);
    expect(run(doc(), A, B, D).select).toEqual([S]);
    expect(run(doc(), C).select).toEqual([B]);
  });

  it('undo restores an identical document, and the patches redo it', () => {
    const before = doc();
    const result = run(before, B, D);
    const undone = applyDocumentPatches(result.doc, result.inverse);
    expect(undone.ok && undone.value).toEqual(before);
    const redone = applyDocumentPatches(before, result.patches);
    expect(redone.ok && redone.value).toEqual(result.doc);
  });

  it('does not mutate the input', () => {
    const d = doc();
    const before = snapshot(d);
    run(d, B);
    expect(snapshot(d)).toBe(before);
  });
});

describe('node.remove rejections', () => {
  const rejected = (d: ReturnType<typeof doc>, ...ids: string[]) => {
    const before = snapshot(d);
    const result = execute(d, remove(...ids), env);
    expect(snapshot(d)).toBe(before);
    if (result.ok) throw new Error('expected a rejection');
    return result.error;
  };

  it('the root', () => {
    expect(rejected(doc(), 'root').reason?.code).toBe('cannot-remove-root');
  });

  it('a node that does not exist', () => {
    expect(rejected(doc(), X).reason?.code).toBe('node-not-found');
  });

  it('a component that is not removable', () => {
    const d = buildDoc([node(X, 'buildr/sticky')], [X]);
    expect(rejected(d, X).reason?.code).toBe('not-removable');
  });

  it('a node inside a structurally locked section', () => {
    const d = buildDoc(
      [node(S, 'buildr/section', [A], { lock: { structure: true } }), text(A)],
      [S],
    );
    expect(rejected(d, A).reason?.code).toBe('locked-structure');
  });

  it('siblings removed together cannot drop a slot below its min', () => {
    const d = buildDoc([node(S, 'buildr/list', [A, B]), text(A), text(B)], [S]);
    expect(execute(d, remove(A), env).ok).toBe(true);
    expect(rejected(d, A, B).reason?.code).toBe('slot-min-violation');
  });

  it('one bad id rejects the whole command', () => {
    expect(rejected(doc(), A, 'root').reason?.code).toBe('cannot-remove-root');
  });

  it('a malformed payload', () => {
    for (const payload of [null, {}, { ids: [] }, { ids: [1] }, { ids: [A], extra: 1 }]) {
      expect(execute(doc(), { type: 'node.remove', payload }, env)).toMatchObject({
        ok: false,
        error: { code: 'command.invalid-payload' },
      });
    }
  });

  it('canExecute agrees', () => {
    expect(canExecute(doc(), remove(A), env).ok).toBe(true);
    expect(canExecute(doc(), remove('root'), env).ok).toBe(false);
  });
});

describe('node.remove keeps the document valid (property)', () => {
  it('removing any subset leaves invariants intact and undo restores the document', () => {
    const ids = [S, A, B, C, D];
    fc.assert(
      fc.property(fc.subarray(ids, { minLength: 1 }), (subset) => {
        const before = doc();
        const result = execute(before, remove(...subset), env);
        if (!result.ok) return; // rejected (e.g. nothing to do) is fine; a corrupt result is not
        expect(checkInvariants(result.value.doc)).toEqual([]);
        const undone = applyDocumentPatches(result.value.doc, result.value.inverse);
        expect(undone.ok && undone.value).toEqual(before);
      }),
    );
  });
});
