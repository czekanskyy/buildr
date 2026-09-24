// @buildr/core/commands: the only way to change a document (ADR-013).
export { applyDocumentPatches } from './apply-patches.ts';
export type { CommandError, CommandErrorCode } from './errors.ts';
export { atIndex, commandError, fromReason } from './errors.ts';
export { canExecute, execute, executeBatch } from './execute.ts';
export type {
  InsertCommand,
  InsertPayload,
  MoveCommand,
  MovePayload,
  RemoveCommand,
  RemovePayload,
  SetPropCommand,
  SetPropPayload,
  UnsetPropCommand,
  UnsetPropPayload,
} from './handlers/index.ts';
export {
  coreCommandHandlers,
  insertHandler,
  moveHandler,
  removeHandler,
} from './handlers/index.ts';
export { checkPayload, commandSchema, createCommandRegistry, parseCommand } from './registry.ts';
export type { ReplayResult } from './replay.ts';
export { replay } from './replay.ts';
export type {
  ApplyOutcome,
  Command,
  CommandEnv,
  CommandHandler,
  CommandRegistry,
  CommandResult,
  DocumentPatch,
  HandlerEnv,
} from './types.ts';
