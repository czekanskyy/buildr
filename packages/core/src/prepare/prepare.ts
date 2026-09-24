import type { DataContext } from '../data/context.ts';
import { type QuerySpec, querySpecSchema, type ResolvedQuerySpec } from '../data/query-spec.ts';
import {
  type DataSource,
  type DataSourceContext,
  type MediaAsset,
  mediaAssetSchema,
  mediaRefSchema,
  type QueryResult,
  queryResultSchema,
} from '../data/source.ts';
import type { BuilderDocument, NodeId, PageNode, Value } from '../document/types.ts';
import type { CompileCache } from '../expressions/compile.ts';
import { parseExpression } from '../expressions/parser.ts';
import { collectPathRoots } from '../expressions/roots.ts';
import { parseTemplate } from '../expressions/template.ts';
import type { RegistryMeta } from '../registry/registry.ts';
import type { Diagnostic } from '../result/diagnostic.ts';
import { resolveQuerySpec } from './resolve-query.ts';

/** Max `DataSource.query` calls in flight at once. */
export const MAX_QUERY_CONCURRENCY = 4;

/** The scopes a Loop introduces for its children; a query that reads one depends on the enclosing item. */
const LOOP_SCOPES: readonly string[] = ['item', 'index', 'loop'];

/**
 * Everything the synchronous render needs from the outside world (docs/renderer.md). Fully
 * serializable, so the canvas can receive it as JSON.
 */
export interface PreparedData {
  /** Static `MediaRef`s resolved to assets, by media id. */
  readonly media: Readonly<Record<string, MediaAsset>>;
  /** Query results by `queryKey(nodeId, prop)`. A failed query has no entry. */
  readonly queries: Readonly<Record<string, QueryResult>>;
  /** The collections that were read, sorted — the cache tags for revalidation. */
  readonly collectionsUsed: readonly string[];
  readonly diagnostics: readonly Diagnostic[];
}

export interface PrepareOptions {
  /** The `id` of the document being rendered, for `excludeCurrent`. */
  readonly currentId?: string | number;
  /** Queries in flight at once, 1..`MAX_QUERY_CONCURRENCY` (the default). */
  readonly concurrency?: number;
  readonly cache?: CompileCache;
}

export type PrepareRegistry = Pick<RegistryMeta, 'get'>;

/** The key of a node's query in `PreparedData.queries`. */
export function queryKey(nodeId: NodeId, prop: string): string {
  return `${nodeId}:${prop}`;
}

interface MediaUse {
  readonly nodeId: NodeId;
  readonly prop: string;
  readonly collection: string;
}

interface QueryUse {
  readonly nodeId: NodeId;
  readonly prop: string;
  readonly spec: QuerySpec;
}

function tag(d: Diagnostic, nodeId: NodeId, prop: string): Diagnostic {
  return { ...d, details: { ...d.details, nodeId, prop } };
}

function rootOfPath(path: string): string {
  return path.split(/[.[]/, 1)[0] ?? '';
}

/** The root data names one `Value` reads. */
function rootsOf(value: Value): ReadonlySet<string> {
  if (value.kind === 'static') return new Set();
  if (value.kind === 'binding') return new Set([rootOfPath(value.path)]);
  const parsed =
    value.mode === 'template' ? parseTemplate(value.expr) : parseExpression(value.expr);
  return parsed.ok ? collectPathRoots(parsed.value) : new Set();
}

function specRoots(spec: QuerySpec): Set<string> {
  const roots = new Set<string>();
  const add = (value: Value) => {
    for (const root of rootsOf(value)) roots.add(root);
  };
  const walk = (filter: NonNullable<QuerySpec['where']>): void => {
    if ('and' in filter) filter.and.forEach(walk);
    else if ('or' in filter) filter.or.forEach(walk);
    else add(filter.value);
  };
  if (spec.where !== undefined) walk(spec.where);
  if (spec.page !== undefined) add(spec.page);
  return roots;
}

async function mapLimit<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async (): Promise<void> => {
    for (let i = next++; i < items.length; i = next++) {
      results[i] = await fn(items[i] as T);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Walks the document once before rendering (docs/dynamic-bindings.md, ADR-018), gathers every
 * static `MediaRef` and every Loop `QuerySpec`, and fetches them: all media in **one**
 * `getMedia` call, queries with at most `MAX_QUERY_CONCURRENCY` in flight (identical resolved
 * queries are issued once). Never throws — a failing `DataSource`, an invalid spec or an invalid
 * response becomes a diagnostic tagged with `nodeId`/`prop` and the affected entry is left out.
 * A query that reads the enclosing Loop's `item`/`index`/`loop` scope (or its `as` alias) is an
 * error and is not issued (ADR-018: no nested dependent queries in the MVP).
 *
 * Only top-level props are inspected; a `MediaRef` or query nested inside a `list`/`object` prop
 * is not prepared.
 */
export async function prepareRender(
  doc: BuilderDocument,
  registry: PrepareRegistry,
  ctx: DataContext,
  dataSource: DataSource,
  options?: PrepareOptions,
): Promise<PreparedData> {
  const walkDiagnostics: Diagnostic[] = [];
  const mediaUses = new Map<string, MediaUse[]>();
  const queryUses: QueryUse[] = [];

  const visited = new Set<NodeId>();
  const visit = (id: NodeId, aliases: readonly string[]): void => {
    const node: PageNode | undefined = doc.nodes[id];
    if (node === undefined || visited.has(id)) return;
    visited.add(id);

    const meta = registry.get(node.type);
    let childAliases = aliases;
    if (meta !== undefined) {
      let isLoop = false;
      for (const [prop, def] of Object.entries(meta.props)) {
        if (def.kind === 'listSource') isLoop = true;
        const raw = node.props?.[prop];
        if (raw === undefined || raw.kind !== 'static') continue;

        if (def.kind === 'media') {
          const ref = mediaRefSchema.safeParse(raw.value);
          if (!ref.success) continue;
          const uses = mediaUses.get(ref.data.id) ?? [];
          uses.push({ nodeId: id, prop, collection: ref.data.collection });
          mediaUses.set(ref.data.id, uses);
        } else if (def.kind === 'listSource') {
          const source = raw.value as { type?: unknown; spec?: unknown } | null;
          if (source === null || typeof source !== 'object' || source.type !== 'query') continue;
          const spec = querySpecSchema.safeParse(source.spec);
          if (!spec.success) {
            walkDiagnostics.push(
              tag(
                {
                  code: 'query.invalid',
                  message: spec.error.issues[0]?.message ?? 'invalid query',
                  severity: 'error',
                },
                id,
                prop,
              ),
            );
            continue;
          }
          const forbidden = [...LOOP_SCOPES, ...aliases];
          const dependent = [...specRoots(spec.data)].filter((root) => forbidden.includes(root));
          if (dependent.length > 0) {
            walkDiagnostics.push(
              tag(
                {
                  code: 'query.depends-on-item',
                  message: `a query cannot depend on the enclosing loop item (reads ${dependent.join(', ')})`,
                  severity: 'error',
                },
                id,
                prop,
              ),
            );
            continue;
          }
          queryUses.push({ nodeId: id, prop, spec: spec.data });
        }
      }
      if (isLoop) {
        const alias = node.props?.['as'];
        if (alias?.kind === 'static' && typeof alias.value === 'string' && alias.value !== '') {
          childAliases = [...aliases, alias.value];
        }
      }
    }

    for (const children of Object.values(node.slots ?? {})) {
      for (const child of children) visit(child, childAliases);
    }
  };
  visit(doc.root, []);

  const dsCtx: DataSourceContext = { locale: ctx.locale, mode: ctx.mode };
  const concurrency = Math.max(
    1,
    Math.min(MAX_QUERY_CONCURRENCY, Math.floor(options?.concurrency ?? MAX_QUERY_CONCURRENCY)),
  );

  const mediaDiagnostics: Diagnostic[] = [];
  const media: Record<string, MediaAsset> = {};
  const collections = new Set<string>();

  const loadMedia = async (): Promise<void> => {
    const ids = [...mediaUses.keys()];
    if (ids.length === 0) return;
    for (const uses of mediaUses.values()) for (const use of uses) collections.add(use.collection);
    let response: Readonly<Record<string, unknown>>;
    try {
      response = (await dataSource.getMedia(ids, dsCtx)) ?? {};
    } catch (error) {
      mediaDiagnostics.push({
        code: 'data.source-error',
        message: `loading media failed: ${errorMessage(error)}`,
        severity: 'error',
        details: { operation: 'getMedia' },
      });
      return;
    }
    for (const id of ids) {
      const first = mediaUses.get(id)?.[0];
      const raw = Object.hasOwn(response, id) ? response[id] : undefined;
      const parsed = raw === undefined ? undefined : mediaAssetSchema.safeParse(raw);
      if (parsed?.success) {
        media[id] = parsed.data;
        continue;
      }
      if (first === undefined) continue;
      mediaDiagnostics.push(
        tag(
          {
            code: parsed === undefined ? 'media.missing' : 'media.invalid',
            message:
              parsed === undefined
                ? `media "${id}" was not found`
                : `media "${id}" came back in an unexpected shape`,
            severity: 'warning',
            details: { mediaId: id },
          },
          first.nodeId,
          first.prop,
        ),
      );
    }
  };

  // Resolve every spec first (synchronous), then fetch each distinct resolved query once.
  const resolveDiagnostics: Diagnostic[] = [];
  const distinct = new Map<string, { spec: ResolvedQuerySpec; uses: QueryUse[] }>();
  for (const use of queryUses) {
    const resolved = resolveQuerySpec(use.spec, ctx, {
      ...(options?.cache === undefined ? {} : { cache: options.cache }),
      ...(options?.currentId === undefined ? {} : { currentId: options.currentId }),
    });
    if (!resolved.ok) {
      for (const d of resolved.error) resolveDiagnostics.push(tag(d, use.nodeId, use.prop));
      continue;
    }
    for (const d of resolved.value.diagnostics) {
      resolveDiagnostics.push(tag(d, use.nodeId, use.prop));
    }
    const key = JSON.stringify(resolved.value.spec);
    const entry = distinct.get(key);
    if (entry === undefined) distinct.set(key, { spec: resolved.value.spec, uses: [use] });
    else entry.uses.push(use);
  }

  const queries: Record<string, QueryResult> = {};
  const queryDiagnostics: Diagnostic[][] = [];
  const runQueries = async (): Promise<void> => {
    const entries = [...distinct.values()];
    for (const { spec } of entries) collections.add(spec.source);
    const outcomes = await mapLimit(entries, concurrency, async ({ spec }) => {
      try {
        const raw = await dataSource.query(spec, dsCtx);
        const parsed = queryResultSchema.safeParse(raw);
        return parsed.success
          ? ({ result: parsed.data } as const)
          : ({
              failure: 'query.invalid-result',
              message: 'the data source returned an invalid result',
            } as const);
      } catch (error) {
        return { failure: 'data.source-error', message: errorMessage(error) } as const;
      }
    });
    entries.forEach((entry, i) => {
      const outcome = outcomes[i];
      const found: Diagnostic[] = [];
      for (const use of entry.uses) {
        if (outcome !== undefined && 'result' in outcome) {
          queries[queryKey(use.nodeId, use.prop)] = outcome.result;
        } else if (outcome !== undefined) {
          found.push(
            tag(
              {
                code: outcome.failure,
                message: `query on "${entry.spec.source}" failed: ${outcome.message}`,
                severity: 'error',
                details: { source: entry.spec.source },
              },
              use.nodeId,
              use.prop,
            ),
          );
        }
      }
      queryDiagnostics.push(found);
    });
  };

  await Promise.all([loadMedia(), runQueries()]);

  return {
    media,
    queries,
    collectionsUsed: [...collections].sort(),
    diagnostics: [
      ...walkDiagnostics,
      ...resolveDiagnostics,
      ...mediaDiagnostics,
      ...queryDiagnostics.flat(),
    ],
  };
}
