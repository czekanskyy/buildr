import type { Field, FieldHook } from 'payload';

/** The Payload import-map path of the admin field (docs/payload.md). */
export const LAYOUT_FIELD_COMPONENT = '@buildr/payload/admin#LayoutField';
/** The collection the `template` relationship points at (added by PB-101). */
export const TEMPLATES_COLLECTION = 'buildr-templates';

export const LAYOUT = 'layout';
export const REVISION = 'buildrRevision';
export const TEMPLATE = 'template';

/** The names the plugin owns; a collection that already has one of them is a configuration error. */
export const RESERVED_FIELDS: readonly string[] = [LAYOUT, REVISION, TEMPLATE];

/**
 * The fields the plugin adds to a collection: the document (`layout`), its concurrency counter
 * (`buildrRevision`, hidden and read-only) and, when the collection takes templates, `template`.
 */
export function buildrFields(options: {
  readonly templates: boolean;
  readonly editorRoute: string;
  readonly guard: (name: string) => FieldHook;
  readonly layoutHook: FieldHook;
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
