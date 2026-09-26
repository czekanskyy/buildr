// @next-buildr/core/commands: the only way to change a document (ADR-013).
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
  SetAttrCommand,
  SetAttrPayload,
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
  MAX_NAME_LENGTH,
  moveHandler,
  removeHandler,
  setAttrHandler,
  unwrapHandler,
  wrapHandler,
} from './handlers/index.ts';
export type {
  HistoryEntry,
  HistoryManager,
  HistoryOptions,
  HistoryRecord,
  HistoryStep,
} from './history.ts';
export { createHistory, DEFAULT_HISTORY_LIMIT, DEFAULT_MERGE_WINDOW_MS } from './history.ts';
export {
  checkPayload,
  commandMergeKey,
  commandSchema,
  createCommandRegistry,
  parseCommand,
} from './registry.ts';
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
  UnlockRequest,
} from './types.ts';
