import type { Diagnostic } from '../result/diagnostic.ts';
import type { Reason } from '../rules/reasons.ts';

/** Codes the framework itself reports; handlers may add their own (`command.<name>`). */
export type CommandErrorCode =
  | 'command.invalid-command'
  | 'command.unknown-type'
  | 'command.invalid-payload'
  | 'command.rejected'
  | 'command.invariant-violated'
  | 'command.invalid-patches';

/**
 * Why a command (or a batch) did not run. Nothing is thrown for bad input: a rejected command
 * leaves the document untouched and comes back as this. `commandIndex` is set by `executeBatch`
 * and `replay` (position of the failing command); `reason` carries the rule that rejected it
 * (`canInsert` and friends), whose `message` can be shown to the user as-is.
 */
export interface CommandError {
  readonly code: CommandErrorCode | (string & {});
  readonly message: string;
  readonly commandIndex?: number | undefined;
  readonly reason?: Reason | undefined;
  readonly diagnostics?: readonly Diagnostic[] | undefined;
}

export function commandError(
  code: CommandError['code'],
  message: string,
  extra: Pick<CommandError, 'reason' | 'diagnostics'> = {},
): CommandError {
  return { code, message, ...extra };
}

/** A rule's rejection as a command error, keeping the rule's user-facing message. */
export function fromReason(reason: Reason): CommandError {
  return { code: 'command.rejected', message: reason.message, reason };
}

export function atIndex(error: CommandError, commandIndex: number): CommandError {
  return { ...error, commandIndex };
}
