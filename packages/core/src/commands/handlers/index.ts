import type { CommandHandler } from '../types.ts';
import { duplicateHandler } from './duplicate.ts';
import { insertHandler } from './insert.ts';
import { moveHandler } from './move.ts';
import { setPropHandler, unsetPropHandler } from './props.ts';
import { removeHandler } from './remove.ts';
import { resetStylesHandler, setStyleHandler, unsetStyleHandler } from './styles.ts';
import { unwrapHandler } from './unwrap.ts';
import { wrapHandler } from './wrap.ts';

export type { DuplicateCommand, DuplicatePayload } from './duplicate.ts';
export { duplicateHandler } from './duplicate.ts';
export type { InsertCommand, InsertPayload } from './insert.ts';
export { insertHandler } from './insert.ts';
export type { MoveCommand, MovePayload } from './move.ts';
export { moveHandler } from './move.ts';
export type {
  SetPropCommand,
  SetPropPayload,
  UnsetPropCommand,
  UnsetPropPayload,
} from './props.ts';
export { setPropHandler, unsetPropHandler } from './props.ts';
export type { RemoveCommand, RemovePayload } from './remove.ts';
export { removeHandler } from './remove.ts';
export type {
  ResetStylesCommand,
  ResetStylesPayload,
  SetStyleCommand,
  SetStylePayload,
  StyleLayer,
  UnsetStyleCommand,
  UnsetStylePayload,
} from './styles.ts';
export { resetStylesHandler, setStyleHandler, unsetStyleHandler } from './styles.ts';
export type { UnwrapCommand, UnwrapPayload } from './unwrap.ts';
export { unwrapHandler } from './unwrap.ts';
export type { WrapCommand, WrapPayload } from './wrap.ts';
export { wrapHandler } from './wrap.ts';

/** Every built-in handler; `createCommandRegistry(coreCommandHandlers)` gives the editor's command set. */
export const coreCommandHandlers: readonly CommandHandler[] = [
  insertHandler as CommandHandler,
  moveHandler as CommandHandler,
  removeHandler as CommandHandler,
  setPropHandler as CommandHandler,
  unsetPropHandler as CommandHandler,
  setStyleHandler as CommandHandler,
  unsetStyleHandler as CommandHandler,
  resetStylesHandler as CommandHandler,
  duplicateHandler as CommandHandler,
  wrapHandler as CommandHandler,
  unwrapHandler as CommandHandler,
];
