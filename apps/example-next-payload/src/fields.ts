import type { Field } from 'payload';

/** A localized URL segment (`a/b` allowed). */
export const slugField = (): Field => ({
  name: 'slug',
  type: 'text',
  required: true,
  localized: true,
  index: true,
  admin: { position: 'sidebar' },
  validate: (value: unknown) =>
    typeof value === 'string' && /^[a-z0-9-]+(\/[a-z0-9-]+)*$/.test(value)
      ? true
      : 'Use lowercase letters, digits and hyphens (segments may be separated by /).',
});

export const statusDefaults = { versions: { drafts: { autosave: true }, maxPerDoc: 50 } } as const;
