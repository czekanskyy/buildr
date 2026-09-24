import type { BuilderDocument } from '../document/types.ts';
import { err, ok, type Result } from '../result/result.ts';
import { atIndex, type CommandError } from './errors.ts';
import { execute } from './execute.ts';
import type { Command, CommandEnv, CommandResult } from './types.ts';

export interface ReplayResult {
  readonly doc: BuilderDocument;
  /** One result per command, in order. */
  readonly steps: readonly CommandResult[];
}

/**
 * Re-runs a command log against `doc` (bug reports, golden tests, property tests). Stops at the
 * first command that fails, reporting its position in `commandIndex`. With a seeded
 * `generateId` the result is identical every time.
 */
export function replay(
  doc: BuilderDocument,
  commands: readonly Command[],
  env: CommandEnv,
): Result<ReplayResult, CommandError> {
  let current = doc;
  const steps: CommandResult[] = [];
  for (const [i, cmd] of commands.entries()) {
    const result = execute(current, cmd, env);
    if (!result.ok) return err(atIndex(result.error, i));
    current = result.value.doc;
    steps.push(result.value);
  }
  return ok({ doc: current, steps });
}
