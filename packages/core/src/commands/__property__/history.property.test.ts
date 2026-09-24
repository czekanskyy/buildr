import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { BuilderDocument } from '../../document/types.ts';
import { applyDocumentPatches } from '../apply-patches.ts';
import { execute } from '../execute.ts';
import { createHistory } from '../history.ts';
import { commandMergeKey } from '../registry.ts';
import {
  type Choice,
  choiceArb,
  commandFor,
  idCounter,
  NUM_RUNS,
  propertyEnv,
  startDoc,
} from './arbitraries.test-kit.ts';

/** JSON with sorted keys: patches may re-add a key at the end, which is not a difference. */
const canonical = (value: unknown): string =>
  JSON.stringify(value, (_key, v) =>
    v !== null && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)))
      : v,
  );

/** A random editing session: mostly commands, with undo, redo, transactions and time passing. */
type Op =
  | { readonly op: 'do'; readonly choice: Choice }
  | { readonly op: 'undo' }
  | { readonly op: 'redo' }
  | { readonly op: 'begin' }
  | { readonly op: 'commit' }
  | { readonly op: 'rollback' }
  | { readonly op: 'wait'; readonly ms: number };

const opArb: fc.Arbitrary<Op> = fc.oneof(
  { weight: 10, arbitrary: choiceArb.map((choice): Op => ({ op: 'do', choice })) },
  { weight: 2, arbitrary: fc.constant<Op>({ op: 'undo' }) },
  { weight: 2, arbitrary: fc.constant<Op>({ op: 'redo' }) },
  { weight: 1, arbitrary: fc.constant<Op>({ op: 'begin' }) },
  { weight: 1, arbitrary: fc.constant<Op>({ op: 'commit' }) },
  { weight: 1, arbitrary: fc.constant<Op>({ op: 'rollback' }) },
  { weight: 3, arbitrary: fc.integer({ min: 0, max: 1500 }).map((ms): Op => ({ op: 'wait', ms })) },
);

function session(ops: readonly Op[], seed: number, limit = 200) {
  const env = propertyEnv(seed);
  const ids = idCounter();
  let now = 0;
  const history = createHistory({ limit, clock: () => now });
  let doc: BuilderDocument = startDoc();
  const start = doc;
  /** The document at the moment each cursor id was observed: one id must mean one document. */
  const byCursor = new Map<string, string>([[history.cursorId, canonical(doc)]]);
  let txStart: BuilderDocument | undefined;

  const observe = () => {
    if (history.inTransaction) return;
    const seen = canonical(doc);
    const known = byCursor.get(history.cursorId);
    if (known === undefined) byCursor.set(history.cursorId, seen);
    else expect(seen, `cursor ${history.cursorId}`).toBe(known);
  };

  for (const op of ops) {
    if (op.op === 'wait') {
      now += op.ms;
    } else if (op.op === 'do') {
      const command = commandFor(doc, op.choice, ids);
      const result = execute(doc, command, env);
      if (result.ok) {
        history.record({
          label: command.type,
          commands: [command],
          patches: result.value.patches,
          inverse: result.value.inverse,
          selectionBefore: [],
          selectionAfter: result.value.select ?? [],
          mergeKey: commandMergeKey(env.commands, [command]),
        });
        doc = result.value.doc;
      }
    } else if (op.op === 'undo' || op.op === 'redo') {
      const step = op.op === 'undo' ? history.undo() : history.redo();
      if (step) {
        const next = applyDocumentPatches(doc, step.patches);
        if (!next.ok) throw new Error(`${op.op} did not apply: ${next.error.message}`);
        doc = next.value;
      }
    } else if (op.op === 'begin') {
      if (history.begin('tx').ok) txStart = doc;
    } else if (op.op === 'commit') {
      history.commit();
    } else if (op.op === 'rollback') {
      const rolled = history.rollback();
      if (rolled.ok) {
        const back = applyDocumentPatches(doc, rolled.value);
        if (!back.ok) throw new Error(`rollback did not apply: ${back.error.message}`);
        doc = back.value;
        expect(doc).toEqual(txStart);
      }
    }
    observe();
  }
  if (history.inTransaction) {
    const rolled = history.rollback();
    if (rolled.ok) {
      const back = applyDocumentPatches(doc, rolled.value);
      if (back.ok) doc = back.value;
    }
  }
  return {
    history,
    doc,
    start,
    apply: (patches: readonly unknown[]) => applyDocumentPatches(doc, patches),
  };
}

type Session = ReturnType<typeof session>;

/** Applies every remaining redo step; returns the document at the top of the stack. */
function redoAll(s: Session, from: BuilderDocument): BuilderDocument {
  let doc = from;
  for (let step = s.history.redo(); step; step = s.history.redo()) {
    const next = applyDocumentPatches(doc, step.patches);
    if (!next.ok) throw new Error(next.error.message);
    doc = next.value;
  }
  return doc;
}

const opsArb = fc.array(opArb, { minLength: 1, maxLength: 25 });
const seedArb = fc.integer({ min: 1, max: 1_000_000 });

describe('history (property)', () => {
  it('a cursor id always identifies one document, so dirty tracking cannot lie', () => {
    fc.assert(
      fc.property(opsArb, seedArb, (ops, seed) => {
        session(ops, seed); // the assertion lives in `observe`
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('undoing every step restores the original document; redoing every step restores the final one', () => {
    fc.assert(
      fc.property(opsArb, seedArb, (ops, seed) => {
        const s = session(ops, seed);
        const final = redoAll(s, s.doc);
        let doc = final;
        for (let step = s.history.undo(); step; step = s.history.undo()) {
          const next = applyDocumentPatches(doc, step.patches);
          if (!next.ok) throw new Error(next.error.message);
          doc = next.value;
        }
        expect(doc).toEqual(s.start);
        expect(redoAll(s, doc)).toEqual(final);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('with a small limit the last `limit` steps still undo and redo cleanly', () => {
    fc.assert(
      fc.property(opsArb, seedArb, (ops, seed) => {
        const s = session(ops, seed, 3);
        expect(s.history.past.length).toBeLessThanOrEqual(3);
        const final = redoAll(s, s.doc);
        let doc = final;
        let undone = 0;
        for (let step = s.history.undo(); step; step = s.history.undo()) {
          const next = applyDocumentPatches(doc, step.patches);
          if (!next.ok) throw new Error(next.error.message);
          doc = next.value;
          undone++;
        }
        for (let i = 0; i < undone; i++) {
          const step = s.history.redo();
          const next = applyDocumentPatches(doc, step?.patches ?? []);
          if (!next.ok) throw new Error(next.error.message);
          doc = next.value;
        }
        expect(doc).toEqual(final);
      }),
      { numRuns: Math.ceil(NUM_RUNS / 2) },
    );
  });
});
