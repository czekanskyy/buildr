import { type BuilderDocument, parseDocument } from '@next-buildr/core';
import { z } from 'zod';
import type { DocumentAdapter, DocumentRef, LoadedDocument, SaveResult } from './types.ts';

const diagnosticSchema = z.object({
  code: z.string(),
  message: z.string(),
  severity: z.enum(['error', 'warning']),
});

/** The reply of a save, checked where it enters the editor. */
export const saveResultSchema = z.union([
  z.object({ ok: z.literal(true), revision: z.number().int(), updatedAt: z.string() }),
  z.object({
    ok: z.literal(false),
    kind: z.literal('conflict'),
    currentRevision: z.number().int(),
  }),
  z.object({
    ok: z.literal(false),
    kind: z.literal('invalid'),
    diagnostics: z.array(diagnosticSchema),
  }),
]);

const loadedSchema = z.object({
  title: z.string(),
  slug: z.string().optional(),
  status: z.enum(['draft', 'published']),
  updatedAt: z.string(),
  revision: z.number().int(),
  document: z.unknown(),
  readOnly: z.boolean().optional(),
  contextRef: z.string().optional(),
});

export class LoadError extends Error {
  override readonly name = 'LoadError';
}

/** Checks a `SaveResult` an adapter returned; a malformed one is a failed (retryable) save. */
export function checkSaveResult(value: unknown): SaveResult {
  const parsed = saveResultSchema.safeParse(value);
  if (!parsed.success) throw new Error('the adapter returned a malformed save result');
  return parsed.data as SaveResult;
}

/**
 * Loads the document of `ref` and its session, and validates what the backend sent. A viewer
 * without edit rights gets a read-only document. Throws `LoadError` for a reply the editor cannot
 * open (the caller shows an error screen); a rejection of the adapter itself passes through.
 */
export async function loadDocument(
  adapter: DocumentAdapter,
  ref: DocumentRef,
): Promise<LoadedDocument> {
  const [session, raw] = await Promise.all([adapter.getSession(ref), adapter.load(ref)]);
  const shape = loadedSchema.safeParse(raw);
  if (!shape.success) throw new LoadError('the backend sent a malformed document reply');
  const parsed = parseDocument(shape.data.document);
  if (!parsed.ok) {
    throw new LoadError(`the document is invalid: ${parsed.error[0]?.message ?? 'unknown'}`);
  }
  const document: BuilderDocument = parsed.value;
  return {
    title: shape.data.title,
    slug: shape.data.slug,
    status: shape.data.status,
    updatedAt: shape.data.updatedAt,
    revision: shape.data.revision,
    document,
    readOnly: shape.data.readOnly === true || !session.canEdit,
    contextRef: shape.data.contextRef,
  };
}
