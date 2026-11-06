import { type BuilderDocument, parseDocument } from '@next-buildr/core';
import type { DocumentRef } from '@next-buildr/editor';

/** Preview references are bounded identifiers; invalid or missing values never seed a page. */
export function parsePreviewRoute(search: string): DocumentRef | undefined {
  const params = new URLSearchParams(search);
  const id = params.get('ref');
  const collection = params.get('collection');
  const valid = (value: string | null): value is string =>
    value !== null && /^[\w-]{1,128}$/.test(value);
  return valid(id) && valid(collection) ? { id, collection } : undefined;
}

export const previewStorageKey = (ref: DocumentRef): string =>
  `buildr:playground:preview:${ref.collection}:${ref.id}`;

export function previewHref(ref: DocumentRef): string {
  return `/preview?${new URLSearchParams({ ref: String(ref.id), collection: ref.collection })}`;
}

/** sessionStorage is shared by same-origin frames in this tab; validate its untrusted JSON. */
export function readPreviewDocument(
  ref: DocumentRef,
  storage: Pick<Storage, 'getItem'>,
): BuilderDocument | undefined {
  try {
    const raw = storage.getItem(previewStorageKey(ref));
    if (raw === null) return undefined;
    const parsed = parseDocument(JSON.parse(raw));
    return parsed.ok ? parsed.value : undefined;
  } catch {
    return undefined;
  }
}
