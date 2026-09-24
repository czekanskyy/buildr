import { applyPatches, enablePatches } from 'immer';
import { z } from 'zod';
import type { BuilderDocument } from '../document/types.ts';
import { err, ok, type Result } from '../result/result.ts';
import { type CommandError, commandError } from './errors.ts';
import type { DocumentPatch } from './types.ts';

enablePatches();

const FORBIDDEN_SEGMENTS = new Set(['__proto__', 'constructor', 'prototype']);
const MAX_PATCHES = 10_000;

const patchSchema = z.strictObject({
  op: z.enum(['add', 'remove', 'replace']),
  path: z
    .array(z.union([z.string(), z.number().int().nonnegative()]))
    .max(32)
    .refine((path) => !path.some((s) => typeof s === 'string' && FORBIDDEN_SEGMENTS.has(s)), {
      message: 'path contains a forbidden segment',
    }),
  value: z.unknown().optional(),
});

/**
 * Applies patches produced by `execute` to a document — how the canvas keeps its copy in sync
 * without re-sending the whole document. Patches arrive over `postMessage`, so they are
 * validated first (operations, path shape, no `__proto__`-style segments, a size cap) and a
 * patch that does not fit the document is an `Err` rather than an exception.
 */
export function applyDocumentPatches(
  doc: BuilderDocument,
  patches: readonly unknown[],
): Result<BuilderDocument, CommandError> {
  const parsed = z.array(patchSchema).max(MAX_PATCHES).safeParse(patches);
  if (!parsed.success) {
    return err(commandError('command.invalid-patches', 'the patches are not valid'));
  }
  try {
    return ok(applyPatches(doc, parsed.data as DocumentPatch[]));
  } catch {
    return err(
      commandError('command.invalid-patches', 'the patches do not apply to this document'),
    );
  }
}
