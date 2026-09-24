import type { CollectionConfig } from 'payload';

/** Where submitted forms are stored (`forms.enabled`). */
export const FORM_SUBMISSIONS_COLLECTION = 'buildr-form-submissions';

/**
 * `buildr-form-submissions`: one document per accepted submission. Only the plugin's endpoint
 * creates them (through the Local API, past access control), so the collection accepts no writes
 * from anyone else; signed-in users read and delete them (the data is personal).
 */
export function formSubmissionsCollection(): CollectionConfig {
  const signedIn = ({ req }: { req: { user?: unknown } }) => Boolean(req.user);
  return {
    slug: FORM_SUBMISSIONS_COLLECTION,
    labels: { singular: 'Form submission', plural: 'Form submissions' },
    admin: { defaultColumns: ['createdAt', 'form', 'locale'] },
    access: { read: signedIn, delete: signedIn, create: () => false, update: () => false },
    fields: [
      {
        name: 'form',
        type: 'group',
        fields: [
          { name: 'collection', type: 'text', required: true },
          { name: 'documentId', type: 'text', required: true },
          { name: 'nodeId', type: 'text', required: true },
        ],
      },
      { name: 'data', type: 'json', required: true },
      { name: 'locale', type: 'text' },
      {
        name: 'meta',
        type: 'group',
        fields: [
          { name: 'userAgent', type: 'text' },
          { name: 'ipHash', type: 'text' },
        ],
      },
    ],
  };
}
