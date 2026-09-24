import { z } from 'zod';
import { err, ok, type Result } from '../result/result.ts';
import { type CommandError, commandError } from './errors.ts';
import type { Command, CommandHandler, CommandRegistry } from './types.ts';

/**
 * Builds a registry from handlers. A duplicate type is an authoring mistake (two handlers for one
 * command), so this throws with the type named, like `defineTheme`. The registry is a plain value
 * passed in `CommandEnv` — there is no global registry.
 */
export function createCommandRegistry(handlers: readonly CommandHandler[]): CommandRegistry {
  const byType = new Map<string, CommandHandler>();
  for (const handler of handlers) {
    if (byType.has(handler.type)) {
      throw new Error(`createCommandRegistry: duplicate handler for "${handler.type}"`);
    }
    byType.set(handler.type, handler);
  }
  const types = Object.freeze([...byType.keys()].sort());
  return { get: (type) => byType.get(type), types };
}

/** The shape every command has, whatever its type. */
export const commandSchema = z.strictObject({
  type: z.string().min(1).max(64),
  payload: z.unknown(),
});

/**
 * Validates untrusted input (a clipboard, a postMessage, a replayed log) into a `Command`: the
 * envelope, then a known type, then that handler's payload schema. Never throws.
 */
export function parseCommand(
  commands: CommandRegistry,
  input: unknown,
): Result<Command, CommandError> {
  const envelope = commandSchema.safeParse(input);
  if (!envelope.success) {
    return err(commandError('command.invalid-command', 'a command is { type, payload }'));
  }
  const { type, payload } = envelope.data;
  return checkPayload(commands, { type, payload });
}

/** Known type and valid payload; `execute` runs it too, so a hand-built command gets the same check. */
export function checkPayload(
  commands: CommandRegistry,
  cmd: Command,
): Result<Command, CommandError> {
  const handler = commands.get(cmd.type);
  if (handler === undefined) {
    return err(commandError('command.unknown-type', `unknown command "${cmd.type}"`));
  }
  if (handler.schema !== undefined) {
    const parsed = handler.schema.safeParse(cmd.payload);
    if (!parsed.success) {
      return err(
        commandError('command.invalid-payload', `invalid payload for "${cmd.type}"`, {
          diagnostics: parsed.error.issues.map((issue) => ({
            code: 'command.invalid-payload',
            message: issue.message,
            severity: 'error' as const,
            path: issue.path.filter((p): p is string | number => typeof p !== 'symbol'),
          })),
        }),
      );
    }
  }
  return ok(cmd);
}
