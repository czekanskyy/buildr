/** Resource limits enforced on a document at every trust boundary (see docs/document-model.md#limits). */
export interface DocumentLimits {
  readonly maxNodes: number;
  readonly maxDepth: number;
  readonly maxSlotChildren: number;
  readonly maxStringLength: number;
  readonly maxRichTextBytes: number;
  readonly maxDocumentBytes: number;
}

/** The default limits from docs/document-model.md#limits. Callers may only tighten these. */
export const DEFAULT_DOCUMENT_LIMITS: DocumentLimits = {
  maxNodes: 5000,
  maxDepth: 48,
  maxSlotChildren: 500,
  maxStringLength: 50_000,
  maxRichTextBytes: 200_000,
  maxDocumentBytes: 2 * 1024 * 1024,
};
