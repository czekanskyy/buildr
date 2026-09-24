import {
  createMemoryDataSource,
  type DataSource,
  type DataSourceContext,
  type JsonValue,
  MAX_QUERY_LIMIT,
  type MediaAsset,
  type QueryResult,
  type ResolvedQuerySpec,
} from '@buildr/core';
import type { Payload, PayloadRequest, Where } from 'payload';
import { normalizeDoc, normalizeMedia } from './normalize.ts';
import { type CollectionLike, isExposedCollection } from './schema-from-fields.ts';
import {
  type Compiled,
  compileWhere,
  type IdType,
  QueryFieldError,
  queryFieldOf,
  type WhereContext,
} from './where.ts';

/** What a collection may be queried by: the fields (as query paths) and the sort keys. */
export interface QueryableCollection {
  readonly fields: readonly string[];
  readonly sort: readonly string[];
}

export interface PayloadDataSourceOptions {
  readonly payload: Payload;
  /** The request whose user's access applies; without one the source reads as an anonymous visitor. */
  readonly req?: PayloadRequest | undefined;
  /** The allowlist: only these collections, with only these fields and sort keys. */
  readonly queryable: Readonly<Record<string, QueryableCollection>>;
  /** The collection `getMedia` reads. */
  readonly mediaCollection?: string | undefined;
  /** The name each collection is bound under (`post`, ...), as in the data schema. */
  readonly contextNames?: Readonly<Record<string, string>> | undefined;
  /** How deep relations are populated in the items (default 1: `author.name` works). */
  readonly depth?: number | undefined;
  /** How many documents the in-memory pass may look at (default 1000). */
  readonly scanLimit?: number | undefined;
}

const DEFAULT_SCAN_LIMIT = 1000;

/** A query that cannot be answered: not allowlisted, malformed, or too broad. */
export class DataQueryError extends Error {}

/** The Payload collections as the mapping sees them. */
const collectionsOf = (payload: Payload): readonly CollectionLike[] =>
  payload.config.collections as unknown as readonly CollectionLike[];

/**
 * The server `DataSource` (ADR-018): queries and media served from Payload's Local API, held to
 * the same contract suite as `MemoryDataSource`. Every call runs with the access of the request's
 * user (`overrideAccess: false`); production reads published documents only.
 *
 * Conditions Payload evaluates like the contract (typed scalars, missing values) go to the
 * database, so paging and totals are the database's. What it cannot (a case-sensitive `contains`,
 * lists, an optional sort key: missing values must sort last in both directions) is decided by the
 * memory source over at most `scanLimit` candidates the database already narrowed.
 */
export function createPayloadDataSource(options: PayloadDataSourceOptions): DataSource {
  const { payload } = options;
  const collections = collectionsOf(payload);
  const scanLimit = options.scanLimit ?? DEFAULT_SCAN_LIMIT;

  const scope = (ctx: DataSourceContext) => ({
    ...(options.req === undefined ? {} : { req: options.req }),
    overrideAccess: false as const,
    ...(payload.config.localization && ctx.locale !== ''
      ? {
          locale: ctx.locale,
          ...(payload.config.localization.fallback === false
            ? { fallbackLocale: false as const }
            : {}),
        }
      : {}),
  });

  const idKind = (slug: string): IdType => {
    const custom = payload.collections[slug]?.customIDType;
    return { kind: (custom ?? payload.db.defaultIDType) === 'number' ? 'number' : 'text' };
  };

  async function query(spec: ResolvedQuerySpec, ctx: DataSourceContext): Promise<QueryResult> {
    const queryable = Object.hasOwn(options.queryable, spec.source)
      ? options.queryable[spec.source]
      : undefined;
    const collection = payload.collections[spec.source];
    const own = collections.find((candidate) => candidate.slug === spec.source);
    if (
      queryable === undefined ||
      collection === undefined ||
      own === undefined ||
      !isExposedCollection(own)
    ) {
      throw new DataQueryError(`The collection "${spec.source}" cannot be queried.`);
    }
    if (!Number.isInteger(spec.limit) || spec.limit < 1 || spec.limit > MAX_QUERY_LIMIT) {
      throw new DataQueryError(`The limit must be between 1 and ${MAX_QUERY_LIMIT}.`);
    }
    if (!Number.isInteger(spec.page) || spec.page < 1) {
      throw new DataQueryError('The page must be 1 or more.');
    }

    const id = idKind(spec.source);
    const context: WhereContext = {
      collections,
      source: spec.source,
      allowed: queryable.fields,
      id,
    };
    let compiled: Compiled = { c: 'true', post: false };
    let sortNeedsScan = false;
    const sortKeys: string[] = [];
    try {
      if (spec.where !== undefined) compiled = compileWhere(spec.where, context);
      for (const { field, dir } of spec.sort ?? []) {
        if (!queryable.sort.includes(field)) {
          throw new QueryFieldError(
            `The field "${field}" of "${spec.source}" cannot be sorted by.`,
          );
        }
        const resolved = queryFieldOf({ ...context, allowed: [field] }, field);
        sortNeedsScan ||= resolved.nullable || resolved.kind === 'unsafe';
        sortKeys.push(`${dir === 'desc' ? '-' : ''}${resolved.payloadPath}`);
      }
    } catch (error) {
      if (error instanceof QueryFieldError) throw new DataQueryError(error.message);
      throw error;
    }
    if (compiled.c === 'false') {
      return { items: [], total: 0, page: spec.page, totalPages: 0 };
    }

    const conditions: Where[] = compiled.c === 'where' ? [compiled.where] : [];
    if (spec.excludeId !== undefined) {
      const excluded = String(spec.excludeId);
      if (id.kind === 'text' || /^\d+$/.test(excluded)) {
        conditions.push({
          id: { not_equals: id.kind === 'number' ? Number(excluded) : excluded },
        });
      }
    }
    const preview = ctx.mode !== 'production';
    const hasDrafts = Boolean(collection.config.versions && collection.config.versions.drafts);
    if (hasDrafts && !preview) conditions.push({ _status: { equals: 'published' } });
    const where: Where | undefined =
      conditions.length === 0
        ? undefined
        : conditions.length === 1
          ? conditions[0]
          : { and: conditions };

    const depth = Math.max(1, options.depth ?? 1);
    const normalize = (doc: unknown) =>
      normalizeDoc(
        { collections },
        own.fields,
        doc as Record<string, unknown>,
        options.contextNames ?? {},
      ) as JsonValue;
    const common = {
      collection: spec.source,
      depth,
      draft: preview,
      ...(where === undefined ? {} : { where }),
      ...scope(ctx),
    };

    if (!compiled.post && !sortNeedsScan) {
      const sort = [
        ...sortKeys,
        ...(sortKeys.some((key) => key.replace('-', '') === 'id') ? [] : ['id']),
      ];
      const found = await payload.find({
        ...common,
        sort,
        page: spec.page,
        limit: spec.limit,
        pagination: true,
      });
      return {
        items: found.docs.map(normalize),
        total: found.totalDocs,
        page: spec.page,
        totalPages: Math.ceil(found.totalDocs / spec.limit),
      };
    }

    const candidates = await payload.find({
      ...common,
      sort: 'id',
      page: 1,
      limit: scanLimit + 1,
      pagination: true,
    });
    if (candidates.totalDocs > scanLimit) {
      throw new DataQueryError(
        `The query needs to look at more than ${scanLimit} documents; narrow the filter.`,
      );
    }
    return createMemoryDataSource({
      collections: { [spec.source]: candidates.docs.map(normalize) },
    }).query(spec, ctx);
  }

  async function getMedia(
    ids: readonly string[],
    ctx: DataSourceContext,
  ): Promise<Readonly<Record<string, MediaAsset>>> {
    const slug = options.mediaCollection;
    if (slug === undefined) throw new DataQueryError('No media collection is configured.');
    const kind = idKind(slug).kind;
    const valid = [...new Set(ids)].filter((value) =>
      kind === 'number' ? /^\d+$/.test(value) : value !== '',
    );
    const found: Record<string, MediaAsset> = {};
    if (valid.length === 0) return found;
    const result = await payload.find({
      collection: slug,
      where: { id: { in: kind === 'number' ? valid.map(Number) : valid } },
      limit: valid.length,
      pagination: false,
      depth: 0,
      ...scope(ctx),
    });
    for (const doc of result.docs) {
      const asset = normalizeMedia(doc);
      if (asset !== null) found[asset.id] = asset;
    }
    return found;
  }

  return { query, getMedia };
}
