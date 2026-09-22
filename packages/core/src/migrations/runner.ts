import type { Diagnostic } from '../result/diagnostic.ts';
import { err, ok, type Result } from '../result/result.ts';

/** One forward-only hop in a migration chain. `migrate` must be pure — never mutate `input`. */
export interface MigrationStep<T> {
  readonly from: number;
  readonly to: number;
  readonly migrate: (input: T) => T;
}

export interface MigrationChainResult<T> {
  readonly value: T;
  /** The steps actually applied, in order — empty when `fromVersion` already equals `toVersion`. */
  readonly applied: readonly MigrationStep<T>[];
}

/**
 * Walks `steps` forward from `fromVersion` to `toVersion`, one `from -> to` hop at a time (see
 * ADR-014, docs/migrations.md). Generic over `T` so it backs both document-shape migrations
 * (`migrations/document`) and, later, per-component prop-schema migrations. Never mutates `input`
 * itself — every `migrate` is trusted to return a new value rather than editing its argument.
 */
export function runMigrationChain<T>(
  input: T,
  fromVersion: number,
  toVersion: number,
  steps: readonly MigrationStep<T>[],
): Result<MigrationChainResult<T>, Diagnostic> {
  if (fromVersion > toVersion) {
    return err({
      code: 'migration.newer-than-target',
      message: `version ${fromVersion} is newer than the target version ${toVersion}`,
      severity: 'error',
      details: { from: fromVersion, to: toVersion },
    });
  }

  let value = input;
  let version = fromVersion;
  const applied: MigrationStep<T>[] = [];

  while (version < toVersion) {
    const step = steps.find((candidate) => candidate.from === version);
    if (!step) {
      return err({
        code: 'migration.no-path',
        message: `no migration step starts at version ${version} (target: ${toVersion})`,
        severity: 'error',
        details: { from: version, to: toVersion },
      });
    }
    if (step.to <= version) {
      return err({
        code: 'migration.invalid-step',
        message: `migration step from ${step.from} to ${step.to} does not move forward`,
        severity: 'error',
        details: { from: step.from, to: step.to },
      });
    }

    value = step.migrate(value);
    applied.push(step);
    version = step.to;
  }

  if (version > toVersion) {
    return err({
      code: 'migration.overshoots-target',
      message: `a migration step landed on version ${version}, past the target version ${toVersion}`,
      severity: 'error',
      details: { landedOn: version, target: toVersion },
    });
  }

  return ok({ value, applied });
}
