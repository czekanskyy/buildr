import type { LocaleCode } from '../document/types.ts';
import type { JsonValue } from '../json/json-value.ts';

/** `production` renders for real visitors; `preview`/`canvas` may show draft data (docs/dynamic-bindings.md#data-context-runtime). */
export type DataContextMode = 'production' | 'preview' | 'canvas';

/**
 * The runtime data available while resolving a document's bindings/expressions
 * (docs/dynamic-bindings.md#data-context-runtime). `scopes` is JSON-only by construction — dates
 * are ISO strings, never class instances — so it can cross the postMessage/HTTP boundaries
 * untouched and so `getPath` never has to special-case a host type.
 */
export interface DataContext {
  readonly scopes: Readonly<Record<string, JsonValue>>;
  readonly locale: LocaleCode;
  readonly locales: {
    readonly default: LocaleCode;
    readonly fallback: boolean;
    readonly intl: Readonly<Record<LocaleCode, string>>;
  };
  readonly timeZone: string;
  readonly mode: DataContextMode;
}

/**
 * Returns a new context with `scopes` layered on top of `ctx.scopes`, replacing any scope of the
 * same name. This is how a Loop introduces `item`/`index`/`loop` (and an optional `as` alias) for
 * its children (docs/dynamic-bindings.md#lists-and-queries-loop-query): a nested Loop's `item`
 * shadows its parent's rather than needing a real stack, since `DataContext.scopes` is flat and a
 * child only ever needs the nearest binding for a given scope name.
 */
export function pushScope(
  ctx: DataContext,
  scopes: Readonly<Record<string, JsonValue>>,
): DataContext {
  return { ...ctx, scopes: { ...ctx.scopes, ...scopes } };
}
