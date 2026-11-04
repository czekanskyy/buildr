/** Remembered palette state: the recently used blocks and the collapsed groups (per browser). */
export const RECENT_KEY = 'buildr.editor.insert.recent';
export const COLLAPSED_KEY = 'buildr.editor.insert.collapsed';
/** The most blocks "Recently used" keeps. */
export const RECENT_LIMIT = 6;
const COLLAPSED_LIMIT = 64;

/** Reads a JSON array of strings; anything else (corrupt, blocked storage) is an empty list. */
function readStrings(key: string): string[] {
  try {
    const raw = globalThis.localStorage?.getItem(key);
    if (raw === null || raw === undefined) return [];
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    return value.filter((entry): entry is string => typeof entry === 'string');
  } catch {
    return [];
  }
}

function writeStrings(key: string, value: readonly string[]): void {
  try {
    globalThis.localStorage?.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be blocked; the choice then only lasts for this session.
  }
}

/** Component types, newest first, without repeats, at most `RECENT_LIMIT`. */
export function readRecent(): string[] {
  return [...new Set(readStrings(RECENT_KEY))].slice(0, RECENT_LIMIT);
}

/** The list after `type` was used: it moves to the front, the oldest falls off. */
export function withRecent(current: readonly string[], type: string): string[] {
  return [type, ...current.filter((entry) => entry !== type)].slice(0, RECENT_LIMIT);
}

export function writeRecent(value: readonly string[]): void {
  writeStrings(RECENT_KEY, value.slice(0, RECENT_LIMIT));
}

export function readCollapsed(): ReadonlySet<string> {
  return new Set(readStrings(COLLAPSED_KEY).slice(0, COLLAPSED_LIMIT));
}

export function writeCollapsed(value: ReadonlySet<string>): void {
  writeStrings(COLLAPSED_KEY, [...value].slice(0, COLLAPSED_LIMIT));
}
