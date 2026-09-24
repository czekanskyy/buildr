import { enablePatches, produceWithPatches } from 'immer';
import { createIndex } from '../document/document-index.ts';
import { checkInvariants } from '../document/invariants.ts';
import type { BuilderDocument, NodeId } from '../document/types.ts';
import { err, ok, type Result } from '../result/result.ts';
import { atIndex, type CommandError, commandError } from './errors.ts';
import { checkPayload } from './registry.ts';
import type {
  ApplyOutcome,
  Command,
  CommandEnv,
  CommandResult,
  DocumentPatch,
  HandlerEnv,
} from './types.ts';

enablePatches();

function handlerEnv(doc: BuilderDocument, env: CommandEnv): HandlerEnv {
  // Lazy: most handlers never need the index, and building it is a full O(n) traversal.
  return {
    doc,
    registry: env.registry,
    generateId: env.generateId,
    get index() {
      return createIndex(doc);
    },
  };
}

/** Payload check + the handler's own `validate`. */
function validate(doc: BuilderDocument, cmd: Command, env: CommandEnv): Result<void, CommandError> {
  const checked = checkPayload(env.commands, cmd);
  if (!checked.ok) return checked;
  const handler = env.commands.get(cmd.type);
  if (handler === undefined) return err(commandError('command.unknown-type', cmd.type));
  return handler.validate(doc, cmd, handlerEnv(doc, env));
}

/** Whether `cmd` would be accepted, without running it — what the UI uses to enable a button. */
export function canExecute(
  doc: BuilderDocument,
  cmd: Command,
  env: CommandEnv,
): Result<void, CommandError> {
  return validate(doc, cmd, env);
}

function run(
  doc: BuilderDocument,
  cmd: Command,
  env: CommandEnv,
): Result<CommandResult, CommandError> {
  const valid = validate(doc, cmd, env);
  if (!valid.ok) return valid;
  const handler = env.commands.get(cmd.type);
  if (handler === undefined) return err(commandError('command.unknown-type', cmd.type));

  const henv = handlerEnv(doc, env);
  let outcome: ApplyOutcome = { affected: [] };
  const [next, patches, inverse] = produceWithPatches(doc, (draft) => {
    outcome = handler.apply(draft, cmd, henv);
  });

  if (env.checkInvariants !== false && next !== doc) {
    const violations = checkInvariants(next).filter((d) => d.severity === 'error');
    if (violations.length > 0) {
      return err(
        commandError(
          'command.invariant-violated',
          `"${cmd.type}" left the document invalid: ${violations.map((d) => d.code).join(', ')}`,
          { diagnostics: violations },
        ),
      );
    }
  }
  return ok({
    doc: next,
    patches,
    inverse,
    affected: [...new Set(outcome.affected)],
    select: outcome.select === undefined ? undefined : [...outcome.select],
  });
}

/**
 * Runs one command: payload schema, `validate`, then `apply` on an Immer draft. The returned
 * `doc` shares every untouched subtree with the input (which is never mutated); `patches` redo
 * the change and `inverse` undoes it. Never throws for bad input — a rejection is an `Err` and
 * the document is unchanged. This, `executeBatch` and `replay` are the only way to change a
 * document (ADR-013).
 */
export function execute(
  doc: BuilderDocument,
  cmd: Command,
  env: CommandEnv,
): Result<CommandResult, CommandError> {
  return run(doc, cmd, env);
}

/**
 * Runs commands in order, each against the result of the previous one, all-or-nothing: if any
 * fails the whole batch is an `Err` (with `commandIndex`) and the input document is untouched.
 * The result is one entry: patches in order, `inverse` in reverse order, so a single undo
 * reverts the batch.
 */
export function executeBatch(
  doc: BuilderDocument,
  cmds: readonly Command[],
  env: CommandEnv,
): Result<CommandResult, CommandError> {
  let current = doc;
  const patches: DocumentPatch[] = [];
  const inverses: (readonly DocumentPatch[])[] = [];
  const affected = new Set<NodeId>();
  let select: readonly NodeId[] | undefined;

  for (const [i, cmd] of cmds.entries()) {
    const result = run(current, cmd, env);
    if (!result.ok) return err(atIndex(result.error, i));
    current = result.value.doc;
    patches.push(...result.value.patches);
    inverses.push(result.value.inverse);
    for (const id of result.value.affected) affected.add(id);
    if (result.value.select !== undefined) select = result.value.select;
  }

  return ok({
    doc: current,
    patches,
    inverse: inverses.reverse().flat(),
    affected: [...affected],
    select,
  });
}
