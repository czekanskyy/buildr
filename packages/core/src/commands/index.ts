// @buildr/core/commands: the only way to change a document (ADR-013).
export { applyDocumentPatches } from './apply-patches.ts';
export type { CommandError, CommandErrorCode } from './errors.ts';
export { atIndex, commandError, fromReason } from './errors.ts';
export { canExecute, execute, executeBatch } from './execute.ts';
export type {
  DuplicateCommand,
  DuplicatePayload,
  InsertCommand,
  InsertPayload,
  MoveCommand,
  MovePayload,
  RemoveCommand,
  RemovePayload,
  ResetStylesCommand,
  ResetStylesPayload,
  SetPropCommand,
  SetPropPayload,
  SetStyleCommand,
  SetStylePayload,
  StyleLayer,
  UnsetPropCommand,
  UnsetPropPayload,
  UnsetStyleCommand,
  UnsetStylePayload,
  UnwrapCommand,
  UnwrapPayload,
  WrapCommand,
  WrapPayload,
} from './handlers/index.ts';
export {
  coreCommandHandlers,
  duplicateHandler,
  insertHandler,
  moveHandler,
  removeHandler,
  unwrapHandler,
  wrapHandler,
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
