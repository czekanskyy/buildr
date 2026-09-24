import type { CommandHandler } from '../types.ts';
import { insertHandler } from './insert.ts';
import { moveHandler } from './move.ts';
import { setPropHandler, unsetPropHandler } from './props.ts';
import { removeHandler } from './remove.ts';

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

/** Every built-in handler; `createCommandRegistry(coreCommandHandlers)` gives the editor's command set. */
export const coreCommandHandlers: readonly CommandHandler[] = [
  insertHandler as CommandHandler,
  moveHandler as CommandHandler,
  removeHandler as CommandHandler,
  setPropHandler as CommandHandler,
  unsetPropHandler as CommandHandler,
];
