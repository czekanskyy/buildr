import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { checkInvariants } from '../../document/invariants.ts';
import { s } from '../../values/helpers.ts';
import { applyDocumentPatches } from '../apply-patches.ts';
import { canExecute, execute } from '../execute.ts';
import { buildDoc, cmd, createEnv, env, ID, node, snapshot } from './handlers.test-kit.ts';

const [S, A, B, C, D, E, X] = [ID(1), ID(2), ID(3), ID(4), ID(5), ID(6), ID(7)];

const text = (id: string, extra = {}) => node(id, 'buildr/text', undefined, extra);
const duplicate = (...ids: string[]) => cmd('node.duplicate', { ids });
const wrap = (ids: string[], wrapper: { type: string; props?: Record<string, unknown> }) =>
  cmd('node.wrap', { ids, wrapper });
const unwrap = (id: string) => cmd('node.unwrap', { id });

type Doc = ReturnType<typeof buildDoc>;
type Command = Parameters<typeof execute>[1];

function run(d: Doc, command: Command) {
  const result = execute(d, command, env);
  if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`);
  return result.value;
}

function rejected(d: Doc, command: Command) {
  const before = snapshot(d);
  const result = execute(d, command, env);
  expect(snapshot(d)).toBe(before);
  if (result.ok) throw new Error('expected a rejection');
  return result.error;
}

function undoable(before: Doc, command: Command) {
  const result = run(before, command);
  const undone = applyDocumentPatches(result.doc, result.inverse);
  expect(undone.ok && undone.value).toEqual(before);
  const redone = applyDocumentPatches(before, result.patches);
  expect(redone.ok && redone.value).toEqual(result.doc);
  expect(checkInvariants(result.doc)).toEqual([]);
  return result;
}

const slotOf = (d: Doc, id: string) => d.nodes[id]?.slots?.default;

// root -> S -> [A, B(section -> [C, D]), E]
const doc = () =>
  buildDoc(
    [
      node(S, 'buildr/section', [A, B, E]),
      text(A, { anchor: 'intro', name: 'Intro' }),
      node(B, 'buildr/section', [C, D]),
      text(C),
      text(D),
      text(E),
    ],
    [S],
  );

describe('node.duplicate', () => {
  it('copies a leaf right after the original, with a fresh id, and selects the copy', () => {
    const result = undoable(doc(), duplicate(C));
    const [c, copy, d] = slotOf(result.doc, B) ?? [];
    expect([c, d]).toEqual([C, D]);
    expect(copy).not.toBe(C);
    expect(result.select).toEqual([copy]);
    expect(result.doc.nodes[copy as string]?.type).toBe('buildr/text');
  });

  it('copies a whole subtree with new ids for every node, leaving the original untouched', () => {
    const before = doc();
    const result = undoable(before, duplicate(B));
    const [b, copy] = slotOf(result.doc, S)?.slice(1, 3) ?? [];
    expect(b).toBe(B);
    expect(copy).not.toBe(B);
    const inner = slotOf(result.doc, copy as string) ?? [];
    expect(inner).toHaveLength(2);
    expect(inner).not.toContain(C);
    expect(result.doc.nodes[B]).toBe(before.nodes[B]);
    expect(Object.keys(result.doc.nodes)).toHaveLength(Object.keys(before.nodes).length + 3);
  });

  it('drops the anchor of the copy (anchors are unique) but keeps the rest', () => {
    const result = run(doc(), duplicate(A));
    const copy = result.select?.[0] as string;
    expect(result.doc.nodes[copy]).not.toHaveProperty('anchor');
    expect(result.doc.nodes[copy]?.name).toBe('Intro');
    expect(result.doc.nodes[A]?.anchor).toBe('intro');
  });

  it('duplicates several nodes, each after its own original, treating descendants as redundant', () => {
    const result = undoable(doc(), duplicate(A, C, B));
    expect(result.select).toHaveLength(2);
    expect(slotOf(result.doc, S)).toHaveLength(5);
    expect(slotOf(result.doc, B)).toEqual([C, D]);
  });

  it('is deterministic with the seeded generator', () => {
    const once = (e: ReturnType<typeof createEnv>) => {
      const result = execute(doc(), duplicate(A), e);
      return result.ok ? result.value.select : undefined;
    };
    const first = once(createEnv());
    const second = once(createEnv());
    expect(first).toBeDefined();
    expect(first).toEqual(second);
  });

  it('rejects the root, a missing node, a full slot, a locked parent', () => {
    expect(rejected(doc(), duplicate('root')).code).toBe('command.cannot-duplicate-root');
    expect(rejected(doc(), duplicate(X)).reason?.code).toBe('node-not-found');
    const P = ID(20);
    const full = buildDoc([node(P, 'buildr/pair', [A, B]), text(A), text(B)], [P]);
    expect(rejected(full, duplicate(A)).reason?.code).toBe('slot-max-exceeded');
    const roomy = buildDoc([node(P, 'buildr/pair', [A]), text(A)], [P]);
    expect(
      rejected(buildDoc([node(P, 'buildr/pair', [A, B]), text(A), text(B)], [P]), duplicate(A, B))
        .reason?.code,
    ).toBe('slot-max-exceeded');
    expect(execute(roomy, duplicate(A), env).ok).toBe(true);
    const locked = buildDoc(
      [node(S, 'buildr/section', [A], { lock: { structure: true } }), text(A)],
      [S],
    );
    expect(rejected(locked, duplicate(A)).reason?.code).toBe('locked-structure');
  });

  it('rejects a duplicate that would exceed the document limits', () => {
    const many = Array.from({ length: 2600 }, (_, i) => ID(10_000 + i));
    const big = buildDoc([node(S, 'buildr/section', many), ...many.map((id) => text(id))], [S]);
    expect(rejected(big, duplicate(S)).code).toBe('command.limit-exceeded');
  });

  it('a malformed payload', () => {
    for (const payload of [null, {}, { ids: [] }, { ids: [1] }, { ids: [A], extra: 1 }]) {
      expect(rejected(doc(), { type: 'node.duplicate', payload }).code).toBe(
        'command.invalid-payload',
      );
    }
  });
});

describe('node.wrap', () => {
  it('wraps one node, in its place, and selects the wrapper', () => {
    const result = undoable(doc(), wrap([A], { type: 'buildr/section' }));
    const wrapperId = result.select?.[0] as string;
    expect(slotOf(result.doc, S)).toEqual([wrapperId, B, E]);
    expect(slotOf(result.doc, wrapperId)).toEqual([A]);
    expect(result.doc.nodes[wrapperId]?.type).toBe('buildr/section');
    expect(result.doc.components['buildr/section']).toBe(1);
  });

  it('wraps several contiguous siblings in any order, keeping their order', () => {
    const result = undoable(doc(), wrap([B, A], { type: 'buildr/section' }));
    const wrapperId = result.select?.[0] as string;
    expect(slotOf(result.doc, S)).toEqual([wrapperId, E]);
    expect(slotOf(result.doc, wrapperId)).toEqual([A, B]);
  });

  it('sets the wrapper props, and records a new component version', () => {
    const result = run(doc(), wrap([A], { type: 'buildr/card', props: { title: s('Hi') } }));
    const wrapperId = result.select?.[0] as string;
    expect(result.doc.nodes[wrapperId]?.props).toEqual({ title: s('Hi') });
    expect(result.doc.components['buildr/card']).toBe(1);
    expect(result.doc.nodes[wrapperId]).not.toHaveProperty('styles');
  });

  it('wrapping inside a full slot is fine (the siblings leave it)', () => {
    const P = ID(20);
    const full = buildDoc([node(P, 'buildr/pair', [A, B]), text(A), text(B)], [P]);
    undoable(full, wrap([A, B], { type: 'buildr/section' }));
  });

  it('rejects non-siblings, non-contiguous siblings, the root and missing nodes', () => {
    expect(rejected(doc(), wrap([A, C], { type: 'buildr/section' })).code).toBe(
      'command.wrap-not-siblings',
    );
    expect(rejected(doc(), wrap([A, E], { type: 'buildr/section' })).code).toBe(
      'command.wrap-not-contiguous',
    );
    expect(rejected(doc(), wrap(['root'], { type: 'buildr/section' })).code).toBe(
      'command.cannot-wrap-root',
    );
    expect(rejected(doc(), wrap([X], { type: 'buildr/section' })).reason?.code).toBe(
      'node-not-found',
    );
  });

  it('rejects an unknown wrapper, one without a default slot, and bad props', () => {
    expect(rejected(doc(), wrap([A], { type: 'acme/none' })).reason?.code).toBe(
      'unknown-component-type',
    );
    expect(rejected(doc(), wrap([A], { type: 'buildr/text' })).reason?.code).toBe('slot-not-found');
    expect(rejected(doc(), wrap([A], { type: 'buildr/card', props: { nope: s('x') } })).code).toBe(
      'command.unknown-prop',
    );
    expect(rejected(doc(), wrap([A], { type: 'buildr/card', props: { title: s(5) } })).code).toBe(
      'command.invalid-value',
    );
  });

  it('rejects children the wrapper does not accept, and too many for its slot', () => {
    expect(rejected(doc(), wrap([B], { type: 'buildr/textbox' })).reason?.code).toBe(
      'slot-not-allowed',
    );
    expect(execute(doc(), wrap([A], { type: 'buildr/textbox' }), env).ok).toBe(true);
    const P = ID(20);
    const three = buildDoc([node(P, 'buildr/section', [A, B, C]), text(A), text(B), text(C)], [P]);
    expect(rejected(three, wrap([A, B, C], { type: 'buildr/pair' })).reason?.code).toBe(
      'slot-max-exceeded',
    );
  });

  it('rejects a wrapper the location does not accept, and a locked location', () => {
    const inBox = buildDoc([node(P_(), 'buildr/textbox', [A]), text(A)], [P_()]);
    expect(rejected(inBox, wrap([A], { type: 'buildr/section' })).reason?.code).toBe(
      'slot-not-allowed',
    );
    const locked = buildDoc(
      [node(S, 'buildr/section', [A], { lock: { structure: true } }), text(A)],
      [S],
    );
    expect(rejected(locked, wrap([A], { type: 'buildr/section' })).reason?.code).toBe(
      'locked-structure',
    );
  });

  it('a malformed payload', () => {
    for (const payload of [
      null,
      {},
      { ids: [A] },
      { ids: [A], wrapper: {} },
      { ids: [A], wrapper: { type: 'buildr/section', extra: 1 } },
    ]) {
      expect(rejected(doc(), { type: 'node.wrap', payload }).code).toBe('command.invalid-payload');
    }
  });

  it('canExecute agrees', () => {
    expect(canExecute(doc(), wrap([A], { type: 'buildr/section' }), env).ok).toBe(true);
    expect(canExecute(doc(), wrap([A, E], { type: 'buildr/section' }), env).ok).toBe(false);
  });
});

function P_() {
  return ID(30);
}

describe('node.unwrap', () => {
  it('puts the children where the node was and selects them', () => {
    const result = undoable(doc(), unwrap(B));
    expect(slotOf(result.doc, S)).toEqual([A, C, D, E]);
    expect(result.doc.nodes[B]).toBeUndefined();
    expect(result.select).toEqual([C, D]);
  });

  it('unwrapping an empty node just removes it and selects the parent', () => {
    const d = buildDoc([node(S, 'buildr/section', [A]), node(A, 'buildr/section', [])], [S]);
    const result = undoable(d, unwrap(A));
    expect(slotOf(result.doc, S)).toEqual([]);
    expect(result.select).toEqual([S]);
  });

  it('wrap then unwrap gives back the original tree', () => {
    const before = doc();
    const wrapped = run(before, wrap([A, B], { type: 'buildr/section' }));
    const wrapperId = wrapped.select?.[0] as string;
    const unwrapped = run(wrapped.doc, unwrap(wrapperId));
    expect(unwrapped.doc).toEqual(before);
  });

  it('rejects the root, a missing node, content in another slot, a locked node, not removable', () => {
    expect(rejected(doc(), unwrap('root')).code).toBe('command.cannot-unwrap-root');
    expect(rejected(doc(), unwrap(X)).reason?.code).toBe('node-not-found');
    const other = buildDoc(
      [{ id: A, type: 'buildr/section', slots: { default: [], side: [B] } }, text(B)],
      [A],
    );
    expect(rejected(other, unwrap(A)).code).toBe('command.unwrap-has-other-slots');
    const locked = buildDoc(
      [node(A, 'buildr/section', [B], { lock: { structure: true } }), text(B)],
      [A],
    );
    expect(rejected(locked, unwrap(A)).reason?.code).toBe('locked-structure');
    const sticky = buildDoc([node(A, 'buildr/sticky')], [A]);
    expect(rejected(sticky, unwrap(A)).reason?.code).toBe('not-removable');
  });

  it('rejects children the parent slot would not accept, and a slot max or min violation', () => {
    const box = buildDoc(
      [node(A, 'buildr/boxes', [B]), node(B, 'buildr/textbox', [C]), text(C)],
      [A],
    );
    expect(rejected(box, unwrap(B)).reason?.code).toBe('slot-not-allowed');
    const P = ID(20);
    const pair = buildDoc(
      [
        node(P, 'buildr/pair', [A, B]),
        node(A, 'buildr/section', [C, D]),
        text(B),
        text(C),
        text(D),
      ],
      [P],
    );
    expect(rejected(pair, unwrap(A)).reason?.code).toBe('slot-max-exceeded');
    const list = buildDoc([node(P, 'buildr/list', [A]), node(A, 'buildr/section', [])], [P]);
    expect(rejected(list, unwrap(A)).reason?.code).toBe('slot-min-violation');
  });

  it('a malformed payload', () => {
    for (const payload of [null, {}, { id: 1 }, { id: A, extra: 1 }]) {
      expect(rejected(doc(), { type: 'node.unwrap', payload }).code).toBe(
        'command.invalid-payload',
      );
    }
  });
});

describe('structural commands keep the document valid (property)', () => {
  it('any accepted duplicate / wrap / unwrap leaves invariants intact and is undoable', () => {
    const ids = [S, A, B, C, D, E];
    const commandArb = fc.oneof(
      fc.subarray(ids, { minLength: 1, maxLength: 3 }).map((subset) => duplicate(...subset)),
      fc
        .subarray(ids, { minLength: 1, maxLength: 3 })
        .map((subset) => wrap(subset, { type: 'buildr/section' })),
      fc.constantFrom(...ids).map((id) => unwrap(id)),
    );
    fc.assert(
      fc.property(commandArb, (command) => {
        const before = doc();
        const result = execute(before, command, env);
        if (!result.ok) return;
        expect(checkInvariants(result.value.doc)).toEqual([]);
        const undone = applyDocumentPatches(result.value.doc, result.value.inverse);
        expect(undone.ok && undone.value).toEqual(before);
      }),
      { numRuns: 300 },
    );
  });
});
