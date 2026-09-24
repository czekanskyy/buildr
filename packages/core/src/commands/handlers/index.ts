import type { CommandHandler } from '../types.ts';
import { insertHandler } from './insert.ts';

export type { InsertCommand, InsertPayload } from './insert.ts';
export { insertHandler } from './insert.ts';

/** Every built-in handler; `createCommandRegistry(coreCommandHandlers)` gives the editor's command set. */
export const coreCommandHandlers: readonly CommandHandler[] = [insertHandler as CommandHandler];
