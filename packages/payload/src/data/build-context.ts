import { normalizeDoc } from './normalize.ts';
import type { SchemaOptions, SchemaSource } from './schema-from-fields.ts';

export interface BuildContextInput {
  readonly source: SchemaSource;
  readonly options: SchemaOptions;
  readonly collection: string;
  readonly doc: Record<string, unknown>;
  /** The site global's document, when there is one and the user may read it. */
  readonly site?: Record<string, unknown> | undefined;
  readonly route: { readonly path: string; readonly locale: string; readonly page?: number };
}

/**
 * The data scopes of a document: `{ site, [context]: doc, route }`, shaped exactly like the schema
 * `schemaFromCollection` derives (same allow-list), ready to be served to the canvas as `scopes`.
 */
export function buildContext(input: BuildContextInput): Record<string, unknown> {
  const { source, options, collection } = input;
  const own = source.collections.find((candidate) => candidate.slug === collection);
  const scopes: Record<string, unknown> = {};
  const siteGlobal = source.globals?.find((global) => global.slug === options.siteGlobal);
  if (siteGlobal !== undefined) {
    scopes['site'] =
      input.site === undefined
        ? null
        : normalizeDoc(source, siteGlobal.fields, input.site, options.contextNames);
  }
  scopes[options.contextNames[collection] ?? collection] =
    own === undefined ? null : normalizeDoc(source, own.fields, input.doc, options.contextNames);
  scopes['route'] = {
    path: input.route.path,
    locale: input.route.locale,
    params: { page: input.route.page ?? null },
  };
  return scopes;
}
