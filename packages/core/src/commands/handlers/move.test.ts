import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { checkInvariants } from '../../document/invariants.ts';
import { applyDocumentPatches } from '../apply-patches.ts';
import { canExecute, execute } from '../execute.ts';
import { buildDoc, cmd, env, ID, node, snapshot } from './handlers.test-kit.ts';

const [S, T, A, B, C, D, E, X] = [ID(1), ID(2), ID(3), ID(4), ID(5), ID(6), ID(7), ID(8)];

const text = (id: string) => node(id, 'buildr/text');
const move = (ids: string[], parentId: string, index: number, slot = 'default') =>
  cmd('node.move', { ids, parentId, slot, index });

// root -> [S -> [A, B, C, D], T -> [E]]
const doc = () =>
  buildDoc(
    [
      node(S, 'buildr/section', [A, B, C, D]),
      node(T, 'buildr/section', [E]),
      text(A),
      text(B),
      text(C),
      text(D),
      text(E),
    ],
    [S, T],
  );

function run(d: ReturnType<typeof doc>, ...args: Parameters<typeof move>) {
  const result = execute(d, move(...args), env);
  if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`);
  return result.value;
}

const order = (d: ReturnType<typeof doc>, id = S) => d.nodes[id]?.slots?.default;

describe('node.move within a slot (the index is the gap in the slot as it is now)', () => {
  it('moves a node down: dropping before D puts it right before D', () => {
    expect(order(run(doc(), [A], S, 3).doc)).toEqual([B, C, A, D]);
  });

  it('moves a node to the end', () => {
    expect(order(run(doc(), [A], S, 4).doc)).toEqual([B, C, D, A]);
  });

  it('moves a node up', () => {
    expect(order(run(doc(), [D], S, 1).doc)).toEqual([A, D, B, C]);
    expect(order(run(doc(), [D], S, 0).doc)).toEqual([D, A, B, C]);
  });

  it('dropping a node onto itself or its own trailing gap changes nothing', () => {
    for (const [id, index] of [
      [B, 1],
      [B, 2],
      [A, 0],
      [D, 4],
    ] as const) {
      const before = doc();
      const result = run(before, [id], S, index);
      expect(result.doc).toBe(before);
      expect(result.patches).toEqual([]);
    }
  });

  it('moves several siblings together, keeping their order', () => {
    expect(order(run(doc(), [A, B], S, 4).doc)).toEqual([C, D, A, B]);
    expect(order(run(doc(), [C, D], S, 0).doc)).toEqual([C, D, A, B]);
    expect(order(run(doc(), [B, D], S, 1).doc)).toEqual([A, B, D, C]);
  });

  it('a list given out of order still keeps the document order', () => {
    expect(order(run(doc(), [D, B], S, 0).doc)).toEqual([B, D, A, C]);
  });

  it('selects the moved nodes and reports the parent as affected', () => {
    const result = run(doc(), [A], S, 3);
    expect(result.select).toEqual([A]);
    expect(result.affected).toEqual([S]);
  });
});

describe('node.move across containers', () => {
  it('moves into another parent at an index', () => {
    const { doc: next, affected } = run(doc(), [B], T, 0);
    expect(order(next, S)).toEqual([A, C, D]);
    expect(order(next, T)).toEqual([B, E]);
    expect(affected).toEqual([S, T]);
    expect(checkInvariants(next)).toEqual([]);
  });

  it('moves a subtree with its descendants', () => {
    const d = buildDoc(
      [
        node(S, 'buildr/section', [A]),
        node(A, 'buildr/section', [B]),
        text(B),
        node(T, 'buildr/section', []),
      ],
      [S, T],
    );
    const next = run(d, [A], T, 0).doc;
    expect(order(next, T)).toEqual([A]);
    expect(order(next, A)).toEqual([B]);
    expect(order(next, S)).toEqual([]);
    expect(checkInvariants(next)).toEqual([]);
  });

  it('moves to the root', () => {
    expect(order(run(doc(), [E], 'root', 0).doc, 'root')).toEqual([E, S, T]);
  });

  it('undo restores the exact position, and patches redo', () => {
    for (const args of [
      [[A], S, 3],
      [[B, C], T, 1],
      [[D], 'root', 1],
    ] as const) {
      const before = doc();
      const result = run(before, [...args[0]], args[1], args[2]);
      const undone = applyDocumentPatches(result.doc, result.inverse);
      expect(undone.ok && undone.value).toEqual(before);
      const redone = applyDocumentPatches(before, result.patches);
      expect(redone.ok && redone.value).toEqual(result.doc);
    }
  });
});

describe('node.move rejections', () => {
  const rejected = (d: ReturnType<typeof doc>, ...args: Parameters<typeof move>) => {
    const before = snapshot(d);
    const result = execute(d, move(...args), env);
    expect(snapshot(d)).toBe(before);
    if (result.ok) throw new Error('expected a rejection');
    return result.error;
  };

  it('into its own subtree or itself', () => {
    const d = buildDoc(
      [
        node(S, 'buildr/section', [A]),
        node(A, 'buildr/section', [B]),
        node(B, 'buildr/section', []),
      ],
      [S],
    );
    expect(rejected(d, [S], B, 0).reason?.code).toBe('cycle');
    expect(rejected(d, [S], S, 0).reason?.code).toBe('cycle');
    expect(rejected(d, [A], A, 0).reason?.code).toBe('cycle');
  });

  it('the root, a missing node and a missing target', () => {
    expect(rejected(doc(), ['root'], S, 0).reason?.code).toBe('cannot-move-root');
    expect(rejected(doc(), [X], S, 0).reason?.code).toBe('node-not-found');
    expect(rejected(doc(), [A], X, 0).reason?.code).toBe('target-not-found');
  });

  it('an index out of range', () => {
    expect(rejected(doc(), [A], S, 5).reason?.code).toBe('invalid-index');
    expect(rejected(doc(), [A], T, 2).reason?.code).toBe('invalid-index');
  });

  it('non-siblings', () => {
    expect(rejected(doc(), [A, E], S, 0).code).toBe('command.move-not-siblings');
  });

  it('a slot that would exceed its max, alone or with several nodes', () => {
    const P = ID(20);
    const d = buildDoc(
      [
        node(P, 'buildr/pair', [A]),
        node(S, 'buildr/section', [B, C, D]),
        text(A),
        text(B),
        text(C),
        text(D),
      ],
      [P, S],
    );
    expect(execute(d, move([B], P, 1), env).ok).toBe(true);
    expect(rejected(d, [B, C], P, 0).reason?.code).toBe('slot-max-exceeded');
    // reordering inside the full slot is fine
    const full = buildDoc([node(P, 'buildr/pair', [A, B]), text(A), text(B)], [P]);
    expect(execute(full, move([A], P, 2), env).ok).toBe(true);
  });

  it('a locked location and a locked destination', () => {
    const locked = buildDoc(
      [
        node(S, 'buildr/section', [A], { lock: { structure: true } }),
        node(T, 'buildr/section', []),
        text(A),
      ],
      [S, T],
    );
    expect(rejected(locked, [A], T, 0).reason?.code).toBe('locked-structure');
    expect(rejected(locked, [T], S, 0).reason?.code).toBe('locked-structure');
  });

  it('a malformed payload', () => {
    for (const payload of [
      null,
      {},
      { ids: [], parentId: S, slot: 'default', index: 0 },
      { ids: [A], parentId: S, slot: 'default', index: -1 },
      { ids: [A], parentId: S, slot: 'default', index: 0, extra: 1 },
    ]) {
      expect(execute(doc(), { type: 'node.move', payload }, env)).toMatchObject({
        ok: false,
        error: { code: 'command.invalid-payload' },
      });
    }
  });

  it('canExecute agrees', () => {
    expect(canExecute(doc(), move([A], T, 0), env).ok).toBe(true);
    expect(canExecute(doc(), move([S], S, 0), env).ok).toBe(false);
  });
});

describe('node.move keeps the document valid (property)', () => {
  it('any move leaves invariants intact, and undo restores the document', () => {
    const ids = [S, T, A, B, C, D, E];
    const parents = ['root', S, T];
    fc.assert(
      fc.property(
        fc.subarray(ids, { minLength: 1, maxLength: 3 }),
        fc.constantFrom(...parents),
        fc.integer({ min: 0, max: 6 }),
        (subset, parentId, index) => {
          const before = doc();
          const result = execute(before, move(subset, parentId, index), env);
          if (!result.ok) return;
          expect(checkInvariants(result.value.doc)).toEqual([]);
          const undone = applyDocumentPatches(result.value.doc, result.value.inverse);
          expect(undone.ok && undone.value).toEqual(before);
        },
      ),
      { numRuns: 300 },
    );
  });
});
