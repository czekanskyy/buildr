import { describe, expect, it } from 'vitest';
import { initialDocument } from './memory-adapter.ts';
import { parsePreviewRoute, previewHref, readPreviewDocument } from './preview-route.ts';

describe('preview route', () => {
  const ref = { collection: 'pages', id: 'playground' };
  it('round trips a document reference', () => {
    expect(parsePreviewRoute(previewHref(ref).split('?')[1] ?? '')).toEqual(ref);
  });
  it('rejects missing, empty, oversized and unsafe references', () => {
    for (const search of [
      '',
      '?ref=p',
      '?collection=pages&ref=',
      '?collection=pages&ref=%3Cscript%3E',
      `?collection=pages&ref=${'a'.repeat(129)}`,
    ]) {
      expect(parsePreviewRoute(search)).toBeUndefined();
    }
  });
  it('validates stored documents and handles unavailable storage', () => {
    const document = initialDocument();
    expect(readPreviewDocument(ref, { getItem: () => JSON.stringify(document) })).toEqual(document);
    for (const raw of [null, '{', '{}']) {
      expect(readPreviewDocument(ref, { getItem: () => raw })).toBeUndefined();
    }
    expect(
      readPreviewDocument(ref, {
        getItem: () => {
          throw new Error('blocked');
        },
      }),
    ).toBeUndefined();
  });
});
