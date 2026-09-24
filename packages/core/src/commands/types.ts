import type { Draft, Patch } from 'immer';
import type { z } from 'zod';
import type { DocumentIndex } from '../document/document-index.ts';
import type { BuilderDocument, NodeId } from '../document/types.ts';
import type { IdGenerator } from '../ids/generate-id.ts';
import type { RegistryMeta } from '../registry/registry.ts';
import type { Result } from '../result/result.ts';
import type { CommandError } from './errors.ts';

/** A change to the document as plain JSON — loggable, replayable, testable (ADR-013). */
export interface Command<T extends string = string, P = unknown> {
  readonly type: T;
  readonly payload: P;
}

/** A JSON-patch-shaped change (Immer's format); `patches` redo a command, `inverse` undoes it. */
export type DocumentPatch = Patch;

/** What a handler sees: the registry, the injected id generator and the index of the *current* document. */
export interface HandlerEnv {
  /** The document before this command — `apply` reads it instead of walking the draft. */
  readonly doc: BuilderDocument;
  readonly registry: RegistryMeta;
  readonly generateId: IdGenerator;
  /** Built on first access (memoized per document), so a handler that does not read it pays nothing. */
  readonly index: DocumentIndex;
}

/** What `apply` reports about its change. */
export interface ApplyOutcome {
  /** Nodes whose own data or child lists changed (for canvas invalidation and selection repair). */
  readonly affected: readonly NodeId[];
  /** Nodes to select afterwards, when the command has an opinion. */
  readonly select?: readonly NodeId[] | undefined;
}

export interface CommandHandler<C extends Command = Command> {
  readonly type: C['type'];
  /** Zod schema for the payload; checked before `validate` so a handler can trust its shape. */
  readonly schema?: z.ZodType<unknown> | undefined;
  /** Rules and locks — everything that can reject the command, without touching the document. */
  validate(doc: BuilderDocument, cmd: C, env: HandlerEnv): Result<void, CommandError>;
  /** Mutates the Immer draft. Only called after `validate` succeeded. */
  apply(draft: Draft<BuilderDocument>, cmd: C, env: HandlerEnv): ApplyOutcome;
}

/** The handlers a caller can execute, built once with `createCommandRegistry` (no global state). */
export interface CommandRegistry {
  get(type: string): CommandHandler | undefined;
  readonly types: readonly string[];
}

export interface CommandEnv {
  readonly registry: RegistryMeta;
  readonly commands: CommandRegistry;
  readonly generateId: IdGenerator;
  /**
   * Run `checkInvariants` on the result of every command and reject (`command.invariant-violated`)
   * when it reports an error — catches a buggy handler before it corrupts the document. On by
   * default; the editor turns it off in production builds.
   */
  readonly checkInvariants?: boolean | undefined;
}

export interface CommandResult {
  readonly doc: BuilderDocument;
  readonly patches: readonly DocumentPatch[];
  readonly inverse: readonly DocumentPatch[];
  readonly affected: readonly NodeId[];
  readonly select: readonly NodeId[] | undefined;
}
