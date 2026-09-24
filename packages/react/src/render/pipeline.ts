import {
  type BuilderDocument,
  checkInvariants,
  DEFAULT_DOCUMENT_LIMITS,
  type Diagnostic,
  type DocumentLimits,
  migrateComponents,
  migrateDocument,
  parseDocument,
  type RawDocument,
} from '@buildr/core';
import type { ReactRegistry } from '../define/registry.ts';

export interface LoadedDocument {
  /** The migrated, validated document; `undefined` when it cannot be rendered at all. */
  readonly doc: BuilderDocument | undefined;
  /** Everything worth reporting, blocking or not. */
  readonly diagnostics: readonly Diagnostic[];
  /** Why the document should not be edited (a component newer than this build knows). */
  readonly readOnlyReasons: readonly Diagnostic[];
}

function isRawDocument(input: unknown): input is RawDocument {
  return (
    typeof input === 'object' &&
    input !== null &&
    typeof (input as { schemaVersion?: unknown }).schemaVersion === 'number'
  );
}

/**
 * The synchronous first half of the pipeline (docs/renderer.md#pipeline), shared by the server and
 * client entry points: migrate the document's shape, validate the envelope and limits, migrate
 * every component's props to the registry's versions, and check the structural invariants.
 * Never throws; a document that fails comes back with `doc: undefined` and the reasons.
 */
export function loadDocument(
  input: unknown,
  registry: ReactRegistry,
  limits: DocumentLimits = DEFAULT_DOCUMENT_LIMITS,
): LoadedDocument {
  if (!isRawDocument(input)) {
    return {
      doc: undefined,
      readOnlyReasons: [],
      diagnostics: [
        {
          code: 'document.invalid',
          message: 'the document has no numeric schemaVersion',
          severity: 'error',
        },
      ],
    };
  }

  const migrated = migrateDocument(input);
  if (!migrated.ok) return { doc: undefined, diagnostics: [migrated.error], readOnlyReasons: [] };

  const parsed = parseDocument(migrated.value.doc, limits);
  if (!parsed.ok) return { doc: undefined, diagnostics: parsed.error, readOnlyReasons: [] };

  const components = migrateComponents(parsed.value, registry.migrations);
  const invariants = checkInvariants(components.doc);
  const diagnostics = [...components.readOnlyReasons, ...components.diagnostics, ...invariants];
  const blocked = invariants.some((d) => d.severity === 'error');
  return {
    doc: blocked ? undefined : components.doc,
    diagnostics,
    readOnlyReasons: components.readOnlyReasons,
  };
}
