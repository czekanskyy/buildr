import type { Field, FieldHook } from 'payload';
import { TEMPLATES_COLLECTION } from '../data/resolve-layout.ts';

/** The Payload import-map path of the admin field (docs/payload.md). */
export const LAYOUT_FIELD_COMPONENT = '@buildr/payload/admin#LayoutField';
/** The collection the `template` relationship points at. */
export { TEMPLATES_COLLECTION };

export const LAYOUT = 'layout';
export const REVISION = 'buildrRevision';
export const TEMPLATE = 'template';
/** Who made the last builder write (added with `mcp.enabled`); versions keep it, so history names the agent. */
export const UPDATED_BY = 'buildrUpdatedBy';

/** The names the plugin owns; a collection that already has one of them is a configuration error. */
export const RESERVED_FIELDS: readonly string[] = [LAYOUT, REVISION, TEMPLATE];
/** Reserved too, but only when `mcp.enabled` adds it. */
export const RESERVED_MCP_FIELDS: readonly string[] = [UPDATED_BY];

/**
 * The fields the plugin adds to a collection: the document (`layout`), its concurrency counter
 * (`buildrRevision`, hidden and read-only) and, when the collection takes templates, `template`.
 */
export function buildrFields(options: {
  readonly templates: boolean;
  readonly editorRoute: string;
  readonly guard: (name: string) => FieldHook;
  readonly layoutHook: FieldHook;
  /** The auth collections `buildrUpdatedBy` may point at; absent unless agents are enabled. */
  readonly updatedBy?: readonly string[] | undefined;
}): Field[] {
  const fields: Field[] = [
    {
      name: LAYOUT,
      type: 'json',
      label: 'Layout',
      hooks: { beforeChange: [options.layoutHook] },
      admin: {
        components: {
          Field: {
            path: LAYOUT_FIELD_COMPONENT,
            clientProps: { editorRoute: options.editorRoute },
          },
        },
      },
    },
    {
      name: REVISION,
      type: 'number',
      defaultValue: 0,
      hooks: { beforeChange: [options.guard(REVISION)] },
      admin: { hidden: true, readOnly: true },
    },
  ];
  if (options.updatedBy !== undefined) {
    fields.push({
      name: UPDATED_BY,
      type: 'relationship',
      relationTo: [...options.updatedBy],
      hasMany: false,
      hooks: { beforeChange: [options.guard(UPDATED_BY)] },
      admin: { hidden: true, readOnly: true },
    });
  }
  if (options.templates) {
    fields.push({
      name: TEMPLATE,
      type: 'relationship',
      relationTo: TEMPLATES_COLLECTION,
      hasMany: false,
    });
  }
  return fields;
}
