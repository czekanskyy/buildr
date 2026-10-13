import {
  type BuilderDocument,
  type ComponentMigrations,
  type Diagnostic,
  err,
  migrateComponents,
  migrateDocument,
  ok,
  parseDocument,
  type RegistryManifest,
  type Result,
} from '@next-buildr/core';
import { z } from 'zod';

/** Validate the stored envelope before running document-shape migrations and parsing the AST. */
export function parseStoredDocument(raw: unknown): Result<BuilderDocument, readonly Diagnostic[]> {
  const envelope = z.looseObject({ schemaVersion: z.int().min(1) }).safeParse(raw);
  if (!envelope.success) return parseDocument(raw);
  const migrated = migrateDocument(envelope.data);
  return migrated.ok ? parseDocument(migrated.value.doc) : err([migrated.error]);
}

/** Executable migrations are optional; manifest compatibility is always checked afterwards. */
export function loadStoredDocument(
  raw: unknown,
  manifest: RegistryManifest,
  migrations?: ComponentMigrations,
): Result<
  { readonly document: BuilderDocument; readonly readOnlyReasons: readonly Diagnostic[] },
  readonly Diagnostic[]
> {
  const parsed = parseStoredDocument(raw);
  if (!parsed.ok) return parsed;
  const migrated = migrations ? migrateComponents(parsed.value, migrations) : undefined;
  const document = migrated?.doc ?? parsed.value;
  const readOnlyReasons: Diagnostic[] = [...(migrated?.readOnlyReasons ?? [])];
  const types = new Set([
    ...Object.keys(document.components),
    ...Object.values(document.nodes).map((node) => node.type),
  ]);
  for (const type of types) {
    const meta = manifest.components[type];
    const storedVersion = document.components[type];
    if (!meta || storedVersion !== meta.version) {
      readOnlyReasons.push({
        code: !meta ? 'component.unknown-type' : 'component.version-mismatch',
        severity: 'warning',
        message: !meta
          ? `"${type}" is absent from the manifest; the document is read-only.`
          : `"${type}" is stored at version ${storedVersion ?? 'missing'}, but the manifest serves version ${meta.version}; the document is read-only.`,
        details: { type, ...(storedVersion === undefined ? {} : { storedVersion }) },
      });
    }
  }
  return ok({ document, readOnlyReasons });
}
