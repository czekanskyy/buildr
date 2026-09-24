import { describe, expect, it } from 'vitest';
import { checkInvariants } from '../../document/invariants.ts';
import { applyDocumentPatches } from '../apply-patches.ts';
import { canExecute, execute } from '../execute.ts';
import { buildDoc, cmd, env, fragment, ID, node, snapshot } from './handlers.test-kit.ts';
import type { InsertPayload } from './insert.ts';

const A = ID(1);
const B = ID(2);
const C = ID(3);
const NEW = ID(10);
const NEW2 = ID(11);
const NEW_CHILD = ID(12);

const insert = (payload: Partial<InsertPayload> & Pick<InsertPayload, 'fragment'>) =>
  cmd('node.insert', { parentId: 'root', slot: 'default', index: 0, ...payload });

const text = (id: string) => node(id, 'buildr/text');
const one = fragment([text(NEW)], [NEW]);

function run(
  doc: ReturnType<typeof buildDoc>,
  payload: Parameters<typeof insert>[0],
  options = env,
) {
  const result = execute(doc, insert(payload), options);
  if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`);
  return result.value;
}

const baseDoc = () => buildDoc([node(A, 'buildr/section', [B, C]), text(B), text(C)], [A]);

describe('node.insert', () => {
  it('inserts into an empty slot', () => {
    const doc = buildDoc([], []);
    const { doc: next, select, affected } = run(doc, { fragment: one });
    expect(next.nodes.root?.slots?.default).toEqual([NEW]);
    expect(next.nodes[NEW]?.type).toBe('buildr/text');
    expect(select).toEqual([NEW]);
    expect(affected).toEqual(['root', NEW]);
    expect(checkInvariants(next)).toEqual([]);
  });

  it('inserts at the start, a specific index and the end of a slot', () => {
    const doc = baseDoc();
    const at = (index: number) =>
      run(doc, { parentId: A, index, fragment: one }).doc.nodes[A]?.slots?.default;
    expect(at(0)).toEqual([NEW, B, C]);
    expect(at(1)).toEqual([B, NEW, C]);
    expect(at(2)).toEqual([B, C, NEW]);
  });

  it('inserts several roots at once, in order, with their descendants', () => {
    const frag = fragment(
      [node(NEW, 'buildr/section', [NEW_CHILD]), text(NEW_CHILD), text(NEW2)],
      [NEW, NEW2],
    );
    const { doc: next, select } = run(baseDoc(), { parentId: A, index: 1, fragment: frag });
    expect(next.nodes[A]?.slots?.default).toEqual([B, NEW, NEW2, C]);
    expect(next.nodes[NEW]?.slots?.default).toEqual([NEW_CHILD]);
    expect(select).toEqual([NEW, NEW2]);
    expect(checkInvariants(next)).toEqual([]);
  });

  it('records the fragment component versions in the document', () => {
    const doc = buildDoc([], []);
    expect(run(doc, { fragment: one }).doc.components['buildr/text']).toBe(1);
  });

  it('gives fresh ids to a fragment that collides with the document (a second paste)', () => {
    const doc = baseDoc();
    const frag = fragment([text(B)], [B]);
    const { doc: next, select } = run(doc, { parentId: A, index: 0, fragment: frag });
    const [inserted] = select ?? [];
    expect(inserted).toBeDefined();
    expect(inserted).not.toBe(B);
    expect(next.nodes[A]?.slots?.default).toEqual([inserted, B, C]);
    expect(next.nodes[B]).toBe(doc.nodes[B]);
    expect(checkInvariants(next)).toEqual([]);
  });

  it('is deterministic with a seeded id generator', () => {
    const doc = baseDoc();
    const frag = fragment([text(B)], [B]);
    const first = run(doc, { parentId: A, index: 0, fragment: frag }, env);
    const second = run(
      doc,
      { parentId: A, index: 0, fragment: frag },
      {
        ...env,
        generateId: (() => {
          let i = 0;
          return () => `Seeded${String(i++).padStart(4, '0')}`;
        })(),
      },
    );
    expect(first.select).toHaveLength(1);
    expect(second.select).toEqual(['Seeded0000']);
  });

  it('undo restores the document exactly, and the patches redo it', () => {
    const doc = baseDoc();
    const result = run(doc, { parentId: A, index: 1, fragment: one });
    const undone = applyDocumentPatches(result.doc, result.inverse);
    expect(undone.ok && undone.value).toEqual(doc);
    const redone = applyDocumentPatches(doc, result.patches);
    expect(redone.ok && redone.value).toEqual(result.doc);
  });

  it('never mutates the document or the fragment it was given', () => {
    const doc = baseDoc();
    const frag = fragment([node(NEW, 'buildr/section', [NEW_CHILD]), text(NEW_CHILD)], [NEW]);
    const before = [snapshot(doc), JSON.stringify(frag)];
    run(doc, { parentId: A, index: 0, fragment: frag });
    run(doc, { parentId: A, index: 0, fragment: fragment([text(B)], [B]) });
    expect([snapshot(doc), JSON.stringify(frag)]).toEqual(before);
  });
});

describe('node.insert rejections carry a Reason message', () => {
  const rejected = (doc: ReturnType<typeof buildDoc>, payload: Parameters<typeof insert>[0]) => {
    const before = snapshot(doc);
    const result = execute(doc, insert(payload), env);
    expect(snapshot(doc)).toBe(before);
    if (result.ok) throw new Error('expected a rejection');
    return result.error;
  };

  it('a missing parent', () => {
    const error = rejected(baseDoc(), { parentId: 'nope', fragment: one });
    expect(error.reason?.code).toBe('target-not-found');
    expect(error.message).toMatch(/does not exist/);
  });

  it('an unknown slot', () => {
    const error = rejected(baseDoc(), { slot: 'footer', fragment: one });
    expect(error.reason?.code).toBe('slot-not-found');
  });

  it('an index past the end of the slot', () => {
    const error = rejected(baseDoc(), { parentId: A, index: 3, fragment: one });
    expect(error.reason?.code).toBe('invalid-index');
  });

  it('slot.max', () => {
    const P = ID(20);
    const doc = buildDoc([node(P, 'buildr/pair', [B, C]), text(B), text(C)], [P]);
    const error = rejected(doc, { parentId: P, index: 0, fragment: one });
    expect(error.reason?.code).toBe('slot-max-exceeded');
    expect(error.message).toMatch(/at most 2/);
  });

  it('a component that cannot be inserted, and the root component', () => {
    const hidden = fragment([node(NEW, 'buildr/hidden')], [NEW]);
    expect(rejected(baseDoc(), { fragment: hidden }).reason?.code).toBe('not-insertable');
    const page = fragment([node(NEW, 'buildr/page')], [NEW]);
    expect(rejected(baseDoc(), { fragment: page }).reason?.code).toBe('root-only');
  });

  it('a locked structure', () => {
    const doc = buildDoc(
      [node(A, 'buildr/section', [B], { lock: { structure: true } }), text(B)],
      [A],
    );
    expect(rejected(doc, { parentId: A, index: 0, fragment: one }).reason?.code).toBe(
      'locked-structure',
    );
  });

  it('an unregistered component type, and a slot the type does not have', () => {
    const unknown = fragment([node(NEW, 'acme/mystery')], [NEW]);
    expect(rejected(baseDoc(), { fragment: unknown }).reason?.code).toBe('unknown-component-type');
    const badSlot = fragment(
      [{ id: NEW, type: 'buildr/text', slots: { default: [NEW2] } }, text(NEW2)],
      [NEW],
    );
    expect(rejected(baseDoc(), { fragment: badSlot }).reason?.code).toBe('slot-not-found');
  });

  it('a fragment that is not a proper forest', () => {
    const cases = [
      // dangling child
      fragment([node(NEW, 'buildr/section', [NEW2])], [NEW]),
      // a node nobody reaches
      fragment([text(NEW), text(NEW2)], [NEW]),
      // a shared child
      fragment([node(NEW, 'buildr/section', [NEW_CHILD, NEW_CHILD]), text(NEW_CHILD)], [NEW]),
      // a cycle
      fragment([node(NEW, 'buildr/section', [NEW])], [NEW]),
    ];
    for (const frag of cases) {
      expect(rejected(baseDoc(), { fragment: frag }).code).toBe('command.invalid-fragment');
    }
  });

  it('a fragment whose component version disagrees with the document', () => {
    const frag = { ...one, components: { 'buildr/text': 2 } };
    const doc = baseDoc();
    expect(rejected(doc, { fragment: frag }).code).toBe('command.component-version-mismatch');
  });

  it('a fragment that would exceed the document limits', () => {
    const many = Array.from({ length: 501 }, (_, i) => ID(1000 + i));
    const frag = fragment(many.map(text), many);
    expect(rejected(baseDoc(), { fragment: frag }).code).toBe('command.limit-exceeded');

    let nested = fragment([text(ID(2000))], [ID(2000)]);
    const chain = [text(ID(2000))];
    for (let i = 1; i < 49; i++) chain.push(node(ID(2000 + i), 'buildr/section', [ID(1999 + i)]));
    nested = fragment(chain, [ID(2048)]);
    expect(rejected(baseDoc(), { fragment: nested }).code).toBe('command.limit-exceeded');
  });

  it('a malformed payload', () => {
    for (const payload of [
      null,
      {},
      { parentId: 'root', slot: 'default', index: -1, fragment: one },
      { parentId: 'root', slot: 'default', index: 1.5, fragment: one },
      { parentId: 'root', slot: 'default', index: 0, fragment: { format: 'other' } },
      { parentId: 'root', slot: 'default', index: 0, fragment: one, extra: 1 },
    ]) {
      const result = execute(baseDoc(), { type: 'node.insert', payload }, env);
      expect(result).toMatchObject({ ok: false, error: { code: 'command.invalid-payload' } });
    }
  });

  it('canExecute agrees with execute without touching the document', () => {
    const doc = baseDoc();
    expect(canExecute(doc, insert({ parentId: A, fragment: one }), env).ok).toBe(true);
    expect(canExecute(doc, insert({ parentId: A, index: 9, fragment: one }), env).ok).toBe(false);
  });
});
