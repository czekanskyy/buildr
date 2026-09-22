import type { z } from 'zod';
import type { Diagnostic } from '../result/diagnostic.ts';
import { err, ok, type Result } from '../result/result.ts';
import { DEFAULT_DOCUMENT_LIMITS, type DocumentLimits } from './limits.ts';
import { documentSchema } from './schema.ts';
import type { BuilderDocument } from './types.ts';

interface WebTextEncoder {
  encode(input: string): Uint8Array;
}

// Typed narrowly instead of pulling in the DOM lib (forbidden for `@buildr/core` — see
// docs/ai/architecture-rules.md #8); TextEncoder is a global in both Node and every modern browser.
function byteLength(text: string): number {
  const TextEncoderCtor = (globalThis as unknown as { TextEncoder: new () => WebTextEncoder })
    .TextEncoder;
  return new TextEncoderCtor().encode(text).length;
}

/**
 * Parses and validates an untrusted value into a `BuilderDocument`, enforcing shape (via
 * `documentSchema`), a byte-size limit, and the rest of `limits` (see docs/document-model.md).
 * Never throws for bad data — a thrown exception would mean a programmer error, not a data
 * problem (see docs/ai/coding-rules.md).
 */
export function parseDocument(
  input: unknown,
  limits: DocumentLimits = DEFAULT_DOCUMENT_LIMITS,
): Result<BuilderDocument, Diagnostic[]> {
  const sizeDiagnostic = checkByteSize(input, limits);
  if (sizeDiagnostic) return err([sizeDiagnostic]);

  const parsed = documentSchema.safeParse(input);
  if (!parsed.success) {
    return err(parsed.error.issues.map(issueToDiagnostic));
  }

  const doc = parsed.data as BuilderDocument;
  const structuralDiagnostics = checkStructuralLimits(doc, limits);
  if (structuralDiagnostics.length > 0) return err(structuralDiagnostics);

  return ok(doc);
}

function checkByteSize(input: unknown, limits: DocumentLimits): Diagnostic | undefined {
  let serialized: string;
  try {
    serialized = JSON.stringify(input) ?? 'null';
  } catch {
    return {
      code: 'document.not-serializable',
      message: 'the input cannot be serialized to JSON (it may contain a circular reference)',
      severity: 'error',
    };
  }
  const byteSize = byteLength(serialized);
  if (byteSize <= limits.maxDocumentBytes) return undefined;
  return {
    code: 'document.exceeds-max-bytes',
    message: `the document is ${byteSize} bytes, exceeding the ${limits.maxDocumentBytes}-byte limit`,
    severity: 'error',
    details: { byteSize, limit: limits.maxDocumentBytes },
  };
}

function checkStructuralLimits(doc: BuilderDocument, limits: DocumentLimits): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const nodeIds = Object.keys(doc.nodes);

  if (nodeIds.length > limits.maxNodes) {
    diagnostics.push({
      code: 'document.exceeds-max-nodes',
      message: `the document has ${nodeIds.length} nodes, exceeding the ${limits.maxNodes}-node limit`,
      severity: 'error',
      details: { count: nodeIds.length, limit: limits.maxNodes },
    });
  }

  for (const id of nodeIds) {
    const node = doc.nodes[id];
    if (!node) continue;

    for (const [slotName, children] of Object.entries(node.slots ?? {})) {
      if (children.length > limits.maxSlotChildren) {
        diagnostics.push({
          code: 'document.exceeds-max-slot-children',
          message: `slot "${slotName}" on node "${id}" has ${children.length} children, exceeding the ${limits.maxSlotChildren}-child limit`,
          severity: 'error',
          path: ['nodes', id, 'slots', slotName],
          details: { count: children.length, limit: limits.maxSlotChildren },
        });
      }
    }

    for (const field of ['name', 'anchor', 'region'] as const) {
      const value = node[field];
      if (value !== undefined && value.length > limits.maxStringLength) {
        diagnostics.push({
          code: 'document.exceeds-max-string-length',
          message: `"${field}" on node "${id}" is ${value.length} characters, exceeding the ${limits.maxStringLength}-character limit`,
          severity: 'error',
          path: ['nodes', id, field],
          details: { length: value.length, limit: limits.maxStringLength },
        });
      }
    }
  }

  const depth = maxDepth(doc);
  if (depth > limits.maxDepth) {
    diagnostics.push({
      code: 'document.exceeds-max-depth',
      message: `the document tree is ${depth} levels deep, exceeding the ${limits.maxDepth}-level limit`,
      severity: 'error',
      details: { depth, limit: limits.maxDepth },
    });
  }

  return diagnostics;
}

// A cycle-safe (visited-set bounded), non-recursive depth walk. `DocumentIndex.depthOf` (PB-008)
// is the reusable/memoized version of this; this is just enough to enforce the limit at parse time.
function maxDepth(doc: BuilderDocument): number {
  let frontier = ['root'];
  const visited = new Set(frontier);
  let depth = 0;
  for (;;) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const children of Object.values(doc.nodes[id]?.slots ?? {})) {
        for (const childId of children) {
          if (visited.has(childId)) continue;
          visited.add(childId);
          next.push(childId);
        }
      }
    }
    if (next.length === 0) return depth;
    depth += 1;
    frontier = next;
  }
}

function issueToDiagnostic(issue: z.ZodIssue): Diagnostic {
  const path = issue.path.filter(
    (segment): segment is string | number => typeof segment !== 'symbol',
  );
  return { code: diagnosticCode(issue, path), message: issue.message, severity: 'error', path };
}

function diagnosticCode(issue: z.ZodIssue, path: readonly (string | number)[]): string {
  if (issue.code === 'custom') {
    const { code: customCode } = issue.params ?? {};
    if (typeof customCode === 'string') return customCode;
  }
  if (issue.code === 'invalid_key') return codeForInvalidKey(path);
  return codeForPath(path);
}

// `invalid_key` issues stop at the offending record key itself, e.g. `['nodes', '<badId>']` —
// map the *container* shape (everything but the key) to a code.
function codeForInvalidKey(path: readonly (string | number)[]): string {
  if (path.length === 2 && path[0] === 'nodes') return 'document.invalid-node-id';
  if (path.length === 2 && path[0] === 'components') return 'document.invalid-component-type';
  if (path.length === 4 && path[0] === 'nodes' && path[2] === 'slots') {
    return 'document.invalid-slot-name';
  }
  return 'document.invalid-shape';
}

function codeForPath(path: readonly (string | number)[]): string {
  const [a, , field] = path;
  if (path.length === 0) return 'document.invalid-shape';
  if (a === 'schemaVersion') return 'document.invalid-schema-version';
  if (a === 'root') return 'document.invalid-root';
  if (a === 'meta') return 'document.invalid-meta';
  if (a === 'components') return 'document.invalid-components';
  if (a !== 'nodes') return 'document.invalid-shape';
  if (path.length === 1) return 'document.invalid-nodes';
  switch (field) {
    case undefined:
      return 'document.invalid-node';
    case 'id':
      return 'document.invalid-node-id';
    case 'type':
      return 'document.invalid-component-type';
    case 'slots':
      return path.length > 4 ? 'document.invalid-node-id' : 'document.invalid-slots';
    case 'anchor':
      return 'document.invalid-anchor';
    case 'name':
      return 'document.invalid-node-name';
    case 'region':
      return 'document.invalid-region';
    case 'lock':
      return 'document.invalid-lock';
    case 'source':
      return 'document.invalid-source';
    case 'ext':
      return 'document.invalid-ext';
    default:
      return 'document.invalid-node';
  }
}
