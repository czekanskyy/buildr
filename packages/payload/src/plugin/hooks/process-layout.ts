import type { LocaleConfig } from '@next-buildr/core';
import {
  type BuilderDocument,
  checkAuthorCode,
  createEmptyDocument,
  DEFAULT_DOCUMENT_LIMITS,
  type Diagnostic,
  type DocumentLimits,
  htmlPropNames,
  migrateComponents,
  migrateDocument,
  type PageNode,
  parseDocument,
  type RawDocument,
  type RegistryMeta,
  validateDocument,
} from '@next-buildr/core';
import type { BuildrRegistry } from '../options.ts';

export interface ProcessLayoutOptions {
  readonly registry?: BuildrRegistry | undefined;
  readonly limits: { readonly maxNodes: number; readonly maxBytes: number };
  /** The languages of the site: an `l10n` key outside them is reported (a warning, kept). */
  readonly locales?: LocaleConfig | undefined;
  /**
   * Whether this request may write author code (ADR-026), as `authorCodePermitted` resolved it (not the `authorCode` option itself).
   * Absent means no.
   */
  readonly allowAuthorCode?: boolean | undefined;
  /**
   * The layout as it is stored now. Without `allowAuthorCode`, author code on a node is accepted only
   * when this document's node with the same id carries exactly the same.
   */
  readonly previous?: unknown;
}

export type ProcessedLayout =
  | { readonly ok: true; readonly doc: BuilderDocument; readonly warnings: readonly Diagnostic[] }
  | { readonly ok: false; readonly diagnostics: readonly Diagnostic[] };

/** The limits of the plugin can only tighten the defaults of the model. */
export const documentLimits = (limits: ProcessLayoutOptions['limits']): DocumentLimits => ({
  ...DEFAULT_DOCUMENT_LIMITS,
  maxNodes: Math.min(limits.maxNodes, DEFAULT_DOCUMENT_LIMITS.maxNodes),
  maxDocumentBytes: Math.min(limits.maxBytes, DEFAULT_DOCUMENT_LIMITS.maxDocumentBytes),
});

const failure = (code: string, message: string): ProcessedLayout => ({
  ok: false,
  diagnostics: [{ code, message, severity: 'error' }],
});

/**
 * What every write of `layout` goes through, whatever its path (Local API, REST, the builder
 * endpoints): a missing document becomes an empty one; anything else is migrated to the current
 * document schema, parsed against the limits, migrated to the current component versions and, when
 * a registry is configured, validated. Errors reject the write; warnings are handed back to be logged.
 */
export function processLayout(value: unknown, options: ProcessLayoutOptions): ProcessedLayout {
  if (value === undefined || value === null) {
    return { ok: true, doc: createEmptyDocument(), warnings: [] };
  }
  if (typeof value !== 'object' || Array.isArray(value)) {
    return failure('layout.not-an-object', 'the layout must be a document object');
  }
  const raw = value as { schemaVersion?: unknown };
  if (typeof raw.schemaVersion !== 'number') {
    return failure('layout.no-schema-version', 'the layout has no numeric "schemaVersion"');
  }
  const limits = documentLimits(options.limits);

  const migratedShape = migrateDocument(value as RawDocument);
  if (!migratedShape.ok) return { ok: false, diagnostics: [migratedShape.error] };

  const parsed = parseDocument(migratedShape.value.doc, limits);
  if (!parsed.ok) return { ok: false, diagnostics: parsed.error };

  let doc = parsed.value;
  const warnings: Diagnostic[] = [];
  const registry = options.registry;
  if (registry?.migrations !== undefined) {
    const migrated = migrateComponents(doc, registry.migrations);
    if (migrated.readOnlyReasons.length > 0) {
      return { ok: false, diagnostics: migrated.readOnlyReasons };
    }
    warnings.push(...migrated.diagnostics);
    doc = migrated.doc;
  }
  if (registry !== undefined) {
    const result = validateDocument(doc, {
      registry: registry.meta,
      limits,
      locales: options.locales,
    });
    const errors = result.issues.filter((issue) => issue.severity === 'error');
    if (!result.ok || errors.length > 0) return { ok: false, diagnostics: errors };
    warnings.push(...result.issues);
  }

  // Author code (ADR-026) is checked on every write, with the capability the host resolved for
  // this request. Without it, a node may carry only the author code it already carried in the
  // stored document: adding or changing any is rejected, so data written while the capability was
  // on can still be saved unchanged (and removed), but nothing new gets in.
  const author = checkAuthorCode(
    doc,
    { authorCode: options.allowAuthorCode === true },
    registry?.meta,
  );
  const before = previousNodes(options.previous);
  const authorErrors: Diagnostic[] = author.filter(
    (issue) =>
      issue.severity === 'error' &&
      !(
        issue.code === 'author.not-permitted' &&
        unchangedAuthorCode(doc, before, issue.details?.['nodeId'], registry?.meta)
      ),
  );
  // Without a registry the html props of a component are unknown, so `checkAuthorCode` cannot see
  // them. Fail closed on the names Text uses: an `html` prop, or `mode: 'html'`, may not be added or
  // changed by a request that may not write author code.
  if (registry === undefined && options.allowAuthorCode !== true) {
    authorErrors.push(...unregisteredHtmlErrors(doc, before));
  }
  if (authorErrors.length > 0) return { ok: false, diagnostics: authorErrors };
  warnings.push(...author.filter((issue) => issue.severity !== 'error'));
  return { ok: true, doc, warnings };
}

type Nodes = Readonly<Record<string, PageNode>>;

/** The nodes of a stored layout, or none when it is absent or not shaped like a document. */
function previousNodes(previous: unknown): Nodes {
  if (typeof previous !== 'object' || previous === null) return {};
  const nodes = (previous as { nodes?: unknown }).nodes;
  return typeof nodes === 'object' && nodes !== null && !Array.isArray(nodes)
    ? (nodes as Nodes)
    : {};
}

/** Key-order independent text form of a JSON value, for comparing. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (typeof value === 'object' && value !== null) {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

/** A node's author code only: its three node fields and the values of its HTML props. */
function authorPart(node: PageNode, meta: RegistryMeta | undefined): string {
  const props = Object.fromEntries(
    htmlPropNames(meta?.get(node.type))
      .filter((name) => node.props !== undefined && Object.hasOwn(node.props, name))
      .map((name) => [name, node.props?.[name]]),
  );
  return canonical({
    customCss: node.customCss,
    classes: node.classes,
    attributes: node.attributes,
    props,
  });
}

/** The props that could carry author HTML when no registry says which ones do: `html`, and `mode` when it is `'html'`. */
function unregisteredHtmlPart(node: PageNode): string | undefined {
  const props = node.props;
  if (props === undefined) return undefined;
  const html = Object.hasOwn(props, 'html') ? props['html'] : undefined;
  const mode = Object.hasOwn(props, 'mode') ? props['mode'] : undefined;
  const htmlMode = mode !== undefined && canonical(mode).includes('"html"');
  if (html === undefined && !htmlMode) return undefined;
  return canonical({ html, mode: htmlMode ? mode : undefined });
}

/** One `author.not-permitted` error per node whose possible HTML differs from the stored node of the same id and type. */
function unregisteredHtmlErrors(doc: BuilderDocument, before: Nodes): Diagnostic[] {
  const out: Diagnostic[] = [];
  for (const [id, node] of Object.entries(doc.nodes)) {
    const now = unregisteredHtmlPart(node);
    if (now === undefined) continue;
    const was = Object.hasOwn(before, id) ? before[id] : undefined;
    if (was !== undefined && was.type === node.type && unregisteredHtmlPart(was) === now) continue;
    out.push({
      code: 'author.not-permitted',
      message: `Node "${id}" carries HTML (an "html" prop or mode "html"), which this host does not allow.`,
      severity: 'error',
      path: ['nodes', id],
      details: { nodeId: id },
    });
  }
  return out;
}

/** Whether `nodeId` carries exactly the author code it carried in the stored document. */
function unchangedAuthorCode(
  doc: BuilderDocument,
  before: Nodes,
  nodeId: unknown,
  meta: RegistryMeta | undefined,
): boolean {
  if (typeof nodeId !== 'string') return false;
  const now = Object.hasOwn(doc.nodes, nodeId) ? doc.nodes[nodeId] : undefined;
  const was = Object.hasOwn(before, nodeId) ? before[nodeId] : undefined;
  if (now === undefined || was === undefined || was.type !== now.type) return false;
  return authorPart(now, meta) === authorPart(was, meta);
}

/** A readable one-line-per-problem message for the admin UI (`code` and, when known, where). */
export function describeDiagnostics(diagnostics: readonly Diagnostic[]): string {
  return diagnostics
    .map((diagnostic) => {
      const where = diagnostic.path === undefined ? '' : ` (${diagnostic.path.join('.')})`;
      return `${diagnostic.message}${where}`;
    })
    .join('; ');
}
