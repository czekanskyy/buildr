import type { DataField, DataSchema, DataType } from '@buildr/core';

/**
 * The part of a (sanitized) Payload field this module reads. Payload's own `Field` union is large
 * and changes between minor versions; reading through this shape keeps the mapping in one place
 * and the dedicated tests pin the behaviour.
 */
export interface FieldLike {
  readonly type: string;
  readonly name?: string;
  readonly hidden?: boolean;
  readonly label?: unknown;
  readonly access?: { readonly read?: unknown };
  readonly fields?: readonly FieldLike[];
  readonly tabs?: readonly { readonly name?: string; readonly fields: readonly FieldLike[] }[];
  readonly options?: readonly unknown[];
  readonly hasMany?: boolean;
  readonly relationTo?: unknown;
}

/** A collection as the mapping sees it. */
export interface CollectionLike {
  readonly slug: string;
  readonly auth?: unknown;
  readonly fields: readonly FieldLike[];
}

export interface SchemaSource {
  readonly collections: readonly CollectionLike[];
  readonly globals?: readonly { readonly slug: string; readonly fields: readonly FieldLike[] }[];
}

export interface SchemaOptions {
  /** The name each configured collection is bound under (`page`, `post`, ...); others keep their slug. */
  readonly contextNames: Readonly<Record<string, string>>;
  /** The global that becomes the `site` scope. */
  readonly siteGlobal?: string;
}

/** Fields the builder itself owns; they are never data for a binding. */
const INTERNAL_FIELDS = new Set(['layout', 'buildrRevision', '_status']);
/** A name that says the value is a credential, whatever the field config claims. */
const SENSITIVE_NAME =
  /pass(word|phrase)|secret|token|salt|hash|api[-_]?key|otp|2fa|session|credential/i;
/** Payload's own collections and the plugin's; the auth collections are excluded by `auth`. */
const isInternalCollection = (slug: string): boolean =>
  slug.startsWith('payload-') || slug.startsWith('buildr-');

/** Whether a collection may take part in the schema and in contexts at all: never the auth ones. */
export const isExposedCollection = (collection: CollectionLike): boolean =>
  !collection.auth && !isInternalCollection(collection.slug);

/** Layout-only wrappers whose children are ordinary siblings of the parent. */
const CONTAINERS = new Set(['row', 'collapsible']);

/** A field with a name that the schema (and the context) may carry, or `undefined`. */
function exposed(field: FieldLike): (FieldLike & { readonly name: string }) | undefined {
  if (field.name === undefined || field.name === '') return undefined;
  if (INTERNAL_FIELDS.has(field.name) || SENSITIVE_NAME.test(field.name)) return undefined;
  if (field.hidden === true) return undefined;
  // A field-level read rule may hide it from this very user; the schema is not user-specific.
  if (field.access?.read !== undefined) return undefined;
  return field as FieldLike & { readonly name: string };
}

/**
 * The named fields of `fields` a binding may reach, layout containers (`row`, `collapsible`, tabs)
 * flattened; a named tab is a `group`. This is the allow-list both the schema and the context use.
 */
export function exposedFields(
  fields: readonly FieldLike[],
): readonly (FieldLike & { readonly name: string })[] {
  const result: (FieldLike & { readonly name: string })[] = [];
  for (const field of fields) {
    if (CONTAINERS.has(field.type)) {
      result.push(...exposedFields(field.fields ?? []));
    } else if (field.type === 'tabs') {
      for (const tab of field.tabs ?? []) {
        if (tab.name === undefined) {
          result.push(...exposedFields(tab.fields));
        } else {
          const named = exposed({ type: 'group', name: tab.name, fields: tab.fields });
          if (named !== undefined) result.push(named);
        }
      }
    } else {
      const own = exposed(field);
      if (own !== undefined) result.push(own);
    }
  }
  return result;
}

const stringLabel = (field: FieldLike): string | undefined =>
  typeof field.label === 'string' ? field.label : undefined;

const optionValue = (option: unknown): string | undefined => {
  if (typeof option === 'string') return option;
  if (typeof option === 'object' && option !== null && 'value' in option) {
    const value = (option as { value: unknown }).value;
    return typeof value === 'string' ? value : undefined;
  }
  return undefined;
};

const targetOf = (field: FieldLike): string | undefined =>
  typeof field.relationTo === 'string' ? field.relationTo : undefined;

/** The slug a relation points at when it can be followed (a single, exposed target). */
export function relationTarget(field: FieldLike, source: SchemaSource): string | undefined {
  const slug = targetOf(field);
  const collection = source.collections.find((candidate) => candidate.slug === slug);
  return collection !== undefined && isExposedCollection(collection) ? collection.slug : undefined;
}

/** The `DataType` of a field, or `undefined` for a kind the MVP does not expose. */
function typeOf(
  field: FieldLike,
  source: SchemaSource,
  options: SchemaOptions,
  reached: Set<string>,
): DataType | undefined {
  const many = (type: DataType | undefined): DataType | undefined =>
    type !== undefined && field.hasMany === true ? { t: 'list', of: type } : type;
  switch (field.type) {
    case 'text':
    case 'textarea':
    case 'email':
      return many({ t: 'string' });
    case 'number':
      return many({ t: 'number' });
    case 'checkbox':
      return { t: 'boolean' };
    case 'date':
      return { t: 'date' };
    case 'select':
    case 'radio': {
      const values = (field.options ?? []).flatMap((option) => optionValue(option) ?? []);
      return many({ t: 'enum', values });
    }
    case 'richText':
      return { t: 'richText' };
    case 'upload':
      return many({ t: 'media' });
    case 'relationship': {
      const slug = relationTarget(field, source);
      if (slug === undefined) return undefined;
      reached.add(slug);
      return many({ t: 'ref', entity: options.contextNames[slug] ?? slug });
    }
    case 'group':
      return { t: 'object', fields: fieldsToData(field.fields ?? [], source, options, reached) };
    case 'array':
      return {
        t: 'list',
        of: { t: 'object', fields: fieldsToData(field.fields ?? [], source, options, reached) },
      };
    default:
      // blocks, json, point, code, join, ui, ...: not exposed in the MVP.
      return undefined;
  }
}

function fieldsToData(
  fields: readonly FieldLike[],
  source: SchemaSource,
  options: SchemaOptions,
  reached: Set<string>,
): Record<string, DataField> {
  const result: Record<string, DataField> = {};
  for (const field of exposedFields(fields)) {
    const type = typeOf(field, source, options, reached);
    if (type === undefined) continue;
    const label = stringLabel(field);
    result[field.name] = { type, ...(label === undefined ? {} : { label }), nullable: true };
  }
  return result;
}

const STANDARD: Record<string, DataField> = {
  id: { type: { t: 'string' } },
  createdAt: { type: { t: 'date' } },
  updatedAt: { type: { t: 'date' } },
};

const objectOf = (fields: Record<string, DataField>): DataField => ({
  type: { t: 'object', fields: { ...STANDARD, ...fields } },
});

const ROUTE: DataField = {
  type: {
    t: 'object',
    fields: {
      path: { type: { t: 'string' } },
      locale: { type: { t: 'string' } },
      params: {
        type: { t: 'object', fields: { page: { type: { t: 'number' }, nullable: true } } },
      },
    },
  },
};

/**
 * The `DataSchema` of a collection's documents: the scopes `site` (when the site global exists),
 * the collection's own context name, and `route`; plus one entity per relation target that can be
 * reached (transitively). Auth collections (`users`), hidden fields and anything that looks like a
 * credential are never included; a relation to them is dropped.
 */
export function schemaFromCollection(
  source: SchemaSource,
  collection: string,
  options: SchemaOptions,
): DataSchema | undefined {
  const own = source.collections.find((candidate) => candidate.slug === collection);
  if (own === undefined || !isExposedCollection(own)) return undefined;

  const reached = new Set<string>();
  const entities: Record<string, DataField> = {};
  const scopes: Record<string, DataField> = {};

  const site = source.globals?.find((global) => global.slug === options.siteGlobal);
  if (site !== undefined) {
    scopes['site'] = {
      type: { t: 'object', fields: fieldsToData(site.fields, source, options, reached) },
    };
  }
  scopes[options.contextNames[collection] ?? collection] = objectOf(
    fieldsToData(own.fields, source, options, reached),
  );
  scopes['route'] = ROUTE;

  // Every relation target becomes an entity; a target's own relations extend the worklist.
  const done = new Set<string>();
  while (true) {
    const next = [...reached].find((slug) => !done.has(slug));
    if (next === undefined) break;
    done.add(next);
    const target = source.collections.find((candidate) => candidate.slug === next);
    if (target === undefined) continue;
    entities[options.contextNames[next] ?? next] = objectOf(
      fieldsToData(target.fields, source, options, reached),
    );
  }
  return { scopes, entities };
}
