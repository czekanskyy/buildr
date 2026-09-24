import { createIndex } from '../document/document-index.ts';
import { checkInvariants } from '../document/invariants.ts';
import { DEFAULT_DOCUMENT_LIMITS } from '../document/limits.ts';
import { parseDocument } from '../document/parse.ts';
import { compileStyles } from '../styles/compile.ts';
import { defaultTheme } from '../styles/theme.ts';
import { checkProps } from './props.ts';
import { checkNesting, checkVersions } from './structure.ts';
import type { ValidateDocumentOptions, ValidationIssue, ValidationResult } from './types.ts';

/**
 * Validates an untrusted or stored document against everything the model knows: the envelope and
 * limits, the structural invariants, component versions, nesting rules, every prop (values,
 * translations, bindings and expressions against the data schema when one is given) and styles.
 * Never throws. `ok` is false only for blocking issues (a document that cannot be trusted or
 * interpreted); the rest are reported so the editor can show them and rendering can fall back.
 */
export function validateDocument(
  input: unknown,
  options: ValidateDocumentOptions,
): ValidationResult {
  const parsed = parseDocument(input, options.limits ?? DEFAULT_DOCUMENT_LIMITS);
  if (!parsed.ok) {
    return {
      ok: false,
      doc: undefined,
      issues: parsed.error.map((d) => ({ ...d, blocking: true })),
    };
  }
  const doc = parsed.value;

  const invariants = checkInvariants(doc);
  if (invariants.length > 0) {
    return { ok: false, doc, issues: invariants.map((d) => ({ ...d, blocking: true })) };
  }

  const issues: ValidationIssue[] = [
    ...checkVersions(doc, options.registry),
    ...checkNesting(doc, options.registry, createIndex(doc)),
    ...checkProps(doc, {
      registry: options.registry,
      locales: options.locales,
      dataSchema: options.dataSchema,
    }),
    ...compileStyles(doc, options.theme ?? defaultTheme).diagnostics.map((d) => ({
      ...d,
      blocking: false,
    })),
  ];
  return { ok: !issues.some((i) => i.blocking), doc, issues };
}
