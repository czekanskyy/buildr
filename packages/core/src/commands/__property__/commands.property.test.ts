import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { checkInvariants } from '../../document/invariants.ts';
import type { BuilderDocument } from '../../document/types.ts';
import { applyDocumentPatches } from '../apply-patches.ts';
import { canExecute, execute, executeBatch } from '../execute.ts';
import { replay } from '../replay.ts';
import type { Command } from '../types.ts';
import {
  type Choice,
  choicesArb,
  commandFor,
  idCounter,
  NUM_RUNS,
  propertyEnv,
  startDoc,
} from './arbitraries.test-kit.ts';

/** Runs choices one at a time against the evolving document; rejected commands are skipped. */
function play(choices: readonly Choice[], seed: number) {
  const env = propertyEnv(seed);
  const ids = idCounter();
  let doc = startDoc();
  const accepted: Command[] = [];
  const steps: { before: BuilderDocument; command: Command; result: ReturnType<typeof execute> }[] =
    [];
  for (const choice of choices) {
    const command = commandFor(doc, choice, ids);
    const before = doc;
    const result = execute(doc, command, env);
    steps.push({ before, command, result });
    if (result.ok) {
      doc = result.value.doc;
      accepted.push(command);
    }
  }
  return { doc, accepted, steps, env };
}

const seedArb = fc.integer({ min: 1, max: 1_000_000 });

describe('command sequences (property)', () => {
  it('invariants always hold: no handler ever leaves the document invalid', () => {
    fc.assert(
      fc.property(choicesArb(), seedArb, (choices, seed) => {
        const { doc, steps } = play(choices, seed);
        for (const step of steps) {
          if (!step.result.ok) {
            // A rejection is fine; a rejection *because the handler broke the document* is a bug.
            expect(step.result.error.code, `${JSON.stringify(step.command)}`).not.toBe(
              'command.invariant-violated',
            );
          }
        }
        expect(checkInvariants(doc)).toEqual([]);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('a command never mutates its input document', () => {
    fc.assert(
      fc.property(choicesArb(), seedArb, (choices, seed) => {
        const { steps } = play(choices, seed);
        // Re-run each step from a serialized copy: the document a step saw must be unchanged after it.
        for (const step of steps) {
          const snapshot = JSON.stringify(step.before);
          execute(step.before, step.command, propertyEnv(seed));
          expect(JSON.stringify(step.before)).toBe(snapshot);
        }
      }),
      { numRuns: Math.ceil(NUM_RUNS / 4) },
    );
  });

  it('every accepted command is undone by its inverse and redone by its patches', () => {
    fc.assert(
      fc.property(choicesArb(), seedArb, (choices, seed) => {
        const { steps } = play(choices, seed);
        for (const { before, result } of steps) {
          if (!result.ok) continue;
          const undone = applyDocumentPatches(result.value.doc, result.value.inverse);
          expect(undone.ok && undone.value).toEqual(before);
          const redone = applyDocumentPatches(before, result.value.patches);
          expect(redone.ok && redone.value).toEqual(result.value.doc);
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('canExecute and execute agree', () => {
    fc.assert(
      fc.property(choicesArb(), seedArb, (choices, seed) => {
        const { steps } = play(choices, seed);
        for (const { before, command, result } of steps) {
          expect(canExecute(before, command, propertyEnv(seed)).ok).toBe(result.ok);
        }
      }),
      { numRuns: Math.ceil(NUM_RUNS / 2) },
    );
  });

  it('replaying the accepted log with the same id generator reproduces the document', () => {
    fc.assert(
      fc.property(choicesArb(), seedArb, (choices, seed) => {
        const { doc, accepted } = play(choices, seed);
        const replayed = replay(startDoc(), accepted, propertyEnv(seed));
        expect(replayed.ok && replayed.value.doc).toEqual(doc);
      }),
      { numRuns: Math.ceil(NUM_RUNS / 2) },
    );
  });
});

describe('batches (property)', () => {
  it('are atomic: a failing batch is an Err that leaves the input untouched', () => {
    fc.assert(
      fc.property(choicesArb(6), seedArb, (choices, seed) => {
        const ids = idCounter();
        const env = propertyEnv(seed);
        // Build a batch from the *starting* document, so later commands may well be invalid.
        const doc = startDoc();
        const batch = choices.map((choice) => commandFor(doc, choice, ids));
        const snapshot = JSON.stringify(doc);
        const result = executeBatch(doc, batch, env);
        expect(JSON.stringify(doc)).toBe(snapshot);
        if (!result.ok) {
          expect(result.error.commandIndex).toBeGreaterThanOrEqual(0);
          expect(result.error.commandIndex).toBeLessThan(batch.length);
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('an accepted batch equals running its commands one by one, and one inverse undoes it all', () => {
    fc.assert(
      fc.property(choicesArb(6), seedArb, (choices, seed) => {
        const ids = idCounter();
        const doc = startDoc();
        const batch = choices.map((choice) => commandFor(doc, choice, ids));
        const batched = executeBatch(doc, batch, propertyEnv(seed));
        const sequential = replay(doc, batch, propertyEnv(seed));
        expect(batched.ok).toBe(sequential.ok);
        if (!batched.ok || !sequential.ok) return;
        expect(batched.value.doc).toEqual(sequential.value.doc);
        const undone = applyDocumentPatches(batched.value.doc, batched.value.inverse);
        expect(undone.ok && undone.value).toEqual(doc);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('a failing command reports the index of the first command that cannot run', () => {
    fc.assert(
      fc.property(choicesArb(6), seedArb, (choices, seed) => {
        const ids = idCounter();
        const doc = startDoc();
        const batch = choices.map((choice) => commandFor(doc, choice, ids));
        const batched = executeBatch(doc, batch, propertyEnv(seed));
        if (batched.ok) return;
        const env = propertyEnv(seed);
        const failedAt = batched.error.commandIndex as number;
        const prefix = replay(doc, batch.slice(0, failedAt), env);
        expect(prefix.ok).toBe(true);
        if (prefix.ok) {
          expect(execute(prefix.value.doc, batch[failedAt] as Command, env).ok).toBe(false);
        }
      }),
      { numRuns: Math.ceil(NUM_RUNS / 2) },
    );
  });
});

describe('the generators exercise the commands (sanity)', () => {
  it('accept a healthy share of every command type', () => {
    const accepted = new Map<string, number>();
    const seen = new Map<string, number>();
    fc.assert(
      fc.property(choicesArb(), seedArb, (choices, seed) => {
        const { steps } = play(choices, seed);
        for (const { command, result } of steps) {
          seen.set(command.type, (seen.get(command.type) ?? 0) + 1);
          if (result.ok) accepted.set(command.type, (accepted.get(command.type) ?? 0) + 1);
        }
      }),
      { numRuns: 300 },
    );
    for (const type of [
      'node.insert',
      'node.remove',
      'node.move',
      'node.duplicate',
      'node.wrap',
      'node.unwrap',
      'node.setProp',
      'node.unsetProp',
      'node.setStyle',
      'node.unsetStyle',
      'node.resetStyles',
      'node.setAttr',
    ]) {
      expect(seen.get(type) ?? 0, `${type} generated`).toBeGreaterThan(20);
      expect(accepted.get(type) ?? 0, `${type} accepted`).toBeGreaterThan(0);
    }
  });
});
