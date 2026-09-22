import { describe, expect, it } from 'vitest';
import type { MigrationStep } from './runner.ts';
import { runMigrationChain } from './runner.ts';

interface TestDoc {
  readonly schemaVersion: number;
  readonly value: readonly string[];
}

function step(from: number, to: number, tag: string): MigrationStep<TestDoc> {
  return {
    from,
    to,
    migrate: (input) => ({ schemaVersion: to, value: [...input.value, tag] }),
  };
}

describe('runMigrationChain', () => {
  it('walks a v1 -> v3 chain, applying each step in order', () => {
    const steps = [step(1, 2, 'v1->v2'), step(2, 3, 'v2->v3')];
    const input: TestDoc = { schemaVersion: 1, value: [] };

    const result = runMigrationChain(input, 1, 3, steps);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.value).toEqual({ schemaVersion: 3, value: ['v1->v2', 'v2->v3'] });
    expect(result.value.applied).toEqual(steps);
  });

  it('is a no-op when fromVersion already equals toVersion (idempotency)', () => {
    const steps = [step(1, 2, 'v1->v2')];
    const input: TestDoc = { schemaVersion: 2, value: ['already-here'] };

    const result = runMigrationChain(input, 2, 2, steps);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.value).toBe(input);
    expect(result.value.applied).toEqual([]);
  });

  it('produces the same result on a repeated run over the same input (idempotency)', () => {
    const steps = [step(1, 2, 'v1->v2'), step(2, 3, 'v2->v3')];
    const input: TestDoc = { schemaVersion: 1, value: [] };

    const first = runMigrationChain(input, 1, 3, steps);
    const second = runMigrationChain(input, 1, 3, steps);

    expect(first).toEqual(second);
  });

  it('never mutates the input value', () => {
    const steps = [step(1, 2, 'v1->v2'), step(2, 3, 'v2->v3')];
    const input: TestDoc = Object.freeze({ schemaVersion: 1, value: Object.freeze([]) });

    expect(() => runMigrationChain(input, 1, 3, steps)).not.toThrow();
    expect(input).toEqual({ schemaVersion: 1, value: [] });
  });

  it('rejects a fromVersion newer than the target', () => {
    const result = runMigrationChain({ schemaVersion: 5, value: [] }, 5, 3, []);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('migration.newer-than-target');
  });

  it('rejects a chain with a missing hop', () => {
    const steps = [step(1, 2, 'v1->v2')];
    const result = runMigrationChain({ schemaVersion: 1, value: [] }, 1, 3, steps);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('migration.no-path');
    expect(result.error.details).toEqual({ from: 2, to: 3 });
  });

  it('rejects a step that does not move the version forward', () => {
    const steps = [step(1, 1, 'no-op')];
    const result = runMigrationChain({ schemaVersion: 1, value: [] }, 1, 2, steps);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('migration.invalid-step');
  });

  it('rejects a chain that overshoots the target version', () => {
    const steps = [step(1, 4, 'v1->v4')];
    const result = runMigrationChain({ schemaVersion: 1, value: [] }, 1, 3, steps);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('migration.overshoots-target');
  });
});
