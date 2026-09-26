import type { MediaAsset } from '@next-buildr/core';
import {
  exposedFields,
  type FieldLike,
  relationTarget,
  type SchemaSource,
} from './schema-from-fields.ts';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isoDate = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const num = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

/**
 * A populated Payload upload document as a `MediaAsset`; an id that was not populated (or a
 * document without a URL) is `null`: the context never carries half a media asset.
 */
export function normalizeMedia(value: unknown): MediaAsset | null {
  if (!isRecord(value) || typeof value['url'] !== 'string' || value['id'] === undefined)
    return null;
  const sizes: Record<string, { url: string; width: number; height: number }> = {};
  if (isRecord(value['sizes'])) {
    for (const [name, size] of Object.entries(value['sizes'])) {
      if (isRecord(size) && typeof size['url'] === 'string') {
        const width = num(size['width']);
        const height = num(size['height']);
        if (width !== undefined && height !== undefined) {
          sizes[name] = { url: size['url'], width, height };
        }
      }
    }
  }
  const focalX = num(value['focalX']);
  const focalY = num(value['focalY']);
  const width = num(value['width']);
  const height = num(value['height']);
  return {
    id: String(value['id']),
    url: value['url'],
    mimeType: typeof value['mimeType'] === 'string' ? value['mimeType'] : '',
    ...(typeof value['alt'] === 'string' ? { alt: value['alt'] } : {}),
    ...(width === undefined ? {} : { width }),
    ...(height === undefined ? {} : { height }),
    ...(focalX !== undefined && focalY !== undefined
      ? { focalPoint: { x: focalX, y: focalY } }
      : {}),
    ...(Object.keys(sizes).length === 0 ? {} : { sizes }),
  };
}

interface Walk {
  readonly source: SchemaSource;
  readonly names: Readonly<Record<string, string>>;
  /** Relation targets already on the way down; a cycle stops at `{ id }`. */
  readonly trail: readonly string[];
}

function normalizeValue(field: FieldLike, value: unknown, walk: Walk): unknown {
  if (value === null || value === undefined) return null;
  if (field.hasMany === true && Array.isArray(value) && field.type !== 'array') {
    return value.map((item) => normalizeValue({ ...field, hasMany: false }, item, walk));
  }
  switch (field.type) {
    case 'date':
      return isoDate(value);
    case 'upload':
      return normalizeMedia(value);
    case 'relationship': {
      const slug = relationTarget(field, walk.source);
      if (slug === undefined) return null;
      if (!isRecord(value)) return { id: String(value) };
      const id = String(value['id']);
      const target = walk.source.collections.find((candidate) => candidate.slug === slug);
      // Not populated (or a cycle): the id is all there is; never the raw document.
      if (target === undefined || walk.trail.includes(`${slug}:${id}`)) return { id };
      return {
        id,
        ...normalizeFields(target.fields, value, {
          ...walk,
          trail: [...walk.trail, `${slug}:${id}`],
        }),
      };
    }
    case 'group':
      return isRecord(value) ? normalizeFields(field.fields ?? [], value, walk) : null;
    case 'array':
      return Array.isArray(value)
        ? value.map((row) =>
            isRecord(row) ? normalizeFields(field.fields ?? [], row, walk) : null,
          )
        : null;
    case 'richText':
      return value;
    default:
      return value;
  }
}

function normalizeFields(
  fields: readonly FieldLike[],
  doc: Record<string, unknown>,
  walk: Walk,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const field of exposedFields(fields)) {
    // Types the schema does not expose (blocks, json, ...) have no `case` above that keeps them.
    if (!EXPOSED_TYPES.has(field.type)) continue;
    // A relation the schema drops (to users, or polymorphic) is dropped here too.
    if (field.type === 'relationship' && relationTarget(field, walk.source) === undefined) continue;
    result[field.name] = normalizeValue(field, doc[field.name], walk);
  }
  return result;
}

const EXPOSED_TYPES = new Set([
  'text',
  'textarea',
  'email',
  'number',
  'checkbox',
  'date',
  'select',
  'radio',
  'richText',
  'upload',
  'relationship',
  'group',
  'array',
]);

/**
 * A document as plain, JSON-safe data for bindings: only the fields the schema exposes (an
 * allow-list, so nothing else ever leaks), dates as ISO strings, uploads as `MediaAsset`s,
 * relations as plain objects (`{ id }` when they were not populated).
 */
export function normalizeDoc(
  source: SchemaSource,
  fields: readonly FieldLike[],
  doc: Record<string, unknown>,
  contextNames: Readonly<Record<string, string>> = {},
): Record<string, unknown> {
  return {
    id: doc['id'] === undefined ? null : String(doc['id']),
    createdAt: isoDate(doc['createdAt']),
    updatedAt: isoDate(doc['updatedAt']),
    ...normalizeFields(fields, doc, { source, names: contextNames, trail: [] }),
  };
}
