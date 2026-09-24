import {
  type CollectionBeforeChangeHook,
  type CollectionConfig,
  type FieldHook,
  ValidationError,
} from 'payload';
import { TEMPLATES_COLLECTION } from '../../data/resolve-layout.ts';
import { allowed } from '../access.ts';
import { describeDiagnostics, processLayout } from '../hooks/process-layout.ts';
import type { ResolvedOptions } from '../options.ts';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/**
 * At most one default template per target collection: saving a default when another one is already
 * the default for the same collection is rejected (the author unmarks the other one first).
 */
const singleDefault: CollectionBeforeChangeHook = async ({ data, originalDoc, req }) => {
  const original = isRecord(originalDoc) ? originalDoc : {};
  const isDefault = data['isDefault'] ?? original['isDefault'];
  if (isDefault !== true) return data;
  const target = data['targetCollection'] ?? original['targetCollection'];
  if (typeof target !== 'string') return data;
  const ownId = original['id'];
  const others = await req.payload.find({
    collection: TEMPLATES_COLLECTION,
    where: {
      and: [
        { targetCollection: { equals: target } },
        { isDefault: { equals: true } },
        ...(ownId === undefined ? [] : [{ id: { not_equals: ownId } }]),
      ],
    },
    limit: 1,
    depth: 0,
    pagination: false,
    draft: true,
    req,
    overrideAccess: true,
  });
  const other = others.docs[0] as unknown as Record<string, unknown> | undefined;
  if (other !== undefined) {
    throw new ValidationError({
      collection: TEMPLATES_COLLECTION,
      errors: [
        {
          path: 'isDefault',
          message: `"${String(other['title'])}" is already the default template for "${target}".`,
        },
      ],
      req,
    });
  }
  return data;
};

/** A stored layout is validated like the builder's: an invalid document never reaches the database. */
const templateLayoutHook =
  (options: Pick<ResolvedOptions, 'registry' | 'limits'>): FieldHook =>
  ({ value, req }) => {
    if (value === undefined || value === null) return value;
    const result = processLayout(value, options);
    if (!result.ok) {
      throw new ValidationError({
        collection: TEMPLATES_COLLECTION,
        errors: [{ path: 'layout', message: describeDiagnostics(result.diagnostics) }],
        req,
      });
    }
    return result.doc;
  };

/**
 * `buildr-templates` (docs/payload.md): reusable layouts a collection's documents inherit. Anyone
 * signed in reads them; visitors read the published ones (a rendered page needs its template);
 * writing needs the builder's `edit` permission.
 */
export function templatesCollection(options: {
  readonly resolved: ResolvedOptions;
  /** The collections that take templates: what `targetCollection` can be. */
  readonly targets: readonly string[];
}): CollectionConfig {
  const { resolved } = options;
  const mayEdit = ({ req }: { req: Parameters<typeof allowed>[2] }) =>
    allowed(resolved, 'edit', req);
  return {
    slug: TEMPLATES_COLLECTION,
    labels: { singular: 'Template', plural: 'Templates' },
    admin: { useAsTitle: 'title', defaultColumns: ['title', 'targetCollection', 'isDefault'] },
    access: {
      read: ({ req }) => (req.user ? true : { _status: { equals: 'published' } }),
      create: mayEdit,
      update: mayEdit,
      delete: mayEdit,
    },
    versions: { drafts: { autosave: true }, maxPerDoc: 50 },
    hooks: { beforeChange: [singleDefault] },
    fields: [
      { name: 'title', type: 'text', required: true },
      {
        name: 'targetCollection',
        type: 'select',
        required: true,
        options: [...options.targets],
        admin: { description: 'The collection whose documents can use this template.' },
      },
      {
        name: 'isDefault',
        type: 'checkbox',
        defaultValue: false,
        admin: {
          description: 'Used by documents of the collection that have no layout and no template.',
        },
      },
      {
        name: 'layout',
        type: 'json',
        hooks: { beforeChange: [templateLayoutHook(resolved)] },
      },
      {
        name: 'buildrRevision',
        type: 'number',
        defaultValue: 0,
        admin: { hidden: true, readOnly: true },
      },
    ],
  };
}
