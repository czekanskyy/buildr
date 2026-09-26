import { type BuilderFragment, fragmentSchema } from '@next-buildr/core';

/** The first line of what the editor puts on the clipboard; it says which format follows. */
export const CLIPBOARD_MARKER = 'buildr-fragment/1';
const MARKER_PREFIX = 'buildr-fragment/';

/** More than this is not a copied selection but something else (or an attack); it is not parsed. */
export const MAX_CLIPBOARD_BYTES = 1_000_000;

export type ClipboardErrorCode =
  | 'empty'
  | 'readOnly'
  | 'notFragment'
  | 'tooLarge'
  | 'unsupported'
  | 'invalid'
  | 'rejected';

export interface ClipboardError {
  readonly code: ClipboardErrorCode;
  /** The reason the editor's rules gave, for `rejected`; the text for the others is in the message catalog. */
  readonly detail?: string | undefined;
}

export type ParseResult =
  | { readonly ok: true; readonly fragment: BuilderFragment }
  | { readonly ok: false; readonly error: ClipboardError };

/** The clipboard text of a fragment: the marker, a line break, JSON. */
export function serializeFragment(fragment: BuilderFragment): string {
  return `${CLIPBOARD_MARKER}\n${JSON.stringify(fragment)}`;
}

const byteLength = (text: string) => new TextEncoder().encode(text).length;

/**
 * Reads clipboard text as a fragment. The text is untrusted: it is checked for the marker, its size
 * and version, parsed as JSON and validated with `fragmentSchema` before anything else sees it.
 * Never throws.
 */
export function parseClipboardText(text: string): ParseResult {
  if (!text.startsWith(MARKER_PREFIX)) return { ok: false, error: { code: 'notFragment' } };
  if (byteLength(text) > MAX_CLIPBOARD_BYTES) return { ok: false, error: { code: 'tooLarge' } };
  const lineEnd = text.indexOf('\n');
  const marker = lineEnd === -1 ? text : text.slice(0, lineEnd);
  if (marker !== CLIPBOARD_MARKER) return { ok: false, error: { code: 'unsupported' } };
  let raw: unknown;
  try {
    raw = JSON.parse(lineEnd === -1 ? '' : text.slice(lineEnd + 1));
  } catch {
    return { ok: false, error: { code: 'invalid' } };
  }
  const parsed = fragmentSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: { code: 'invalid' } };
  return { ok: true, fragment: parsed.data as BuilderFragment };
}
