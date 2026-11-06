import { isSafePreviewUrl } from '../preview/index.ts';

/** The version history link of the host: a callback as it is, a URL only when it is a safe one. */
export function safeHistory<T extends string | (() => void) | undefined>(
  history: T,
): T | undefined {
  return typeof history === 'string' && !isSafePreviewUrl(history) ? undefined : history;
}
