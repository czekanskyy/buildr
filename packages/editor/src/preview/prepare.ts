import type { DocumentAdapter, DocumentRef, PersistenceController } from '../persistence/index.ts';

export type PreviewResult =
  | { readonly ok: true; readonly url: string }
  | { readonly ok: false; readonly reason: 'unsaved' | 'unsafe-url' };

/** Only pages of the site itself or of another web address; never a `javascript:` or `data:` URL. */
export function isSafePreviewUrl(url: string): boolean {
  try {
    const parsed = new URL(url, 'http://localhost');
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Makes the preview show the latest changes: saves what is unsaved first, and only then asks the
 * adapter for the draft URL. A preview of a document that could not be saved would show old work.
 */
export async function preparePreview(
  controller: Pick<PersistenceController, 'saveNow' | 'state'>,
  adapter: Pick<DocumentAdapter, 'previewUrl'>,
  ref: DocumentRef,
): Promise<PreviewResult> {
  await controller.saveNow();
  if (controller.state.getState().status !== 'clean') return { ok: false, reason: 'unsaved' };
  const url = adapter.previewUrl(ref, { draft: true });
  return isSafePreviewUrl(url) ? { ok: true, url } : { ok: false, reason: 'unsafe-url' };
}
