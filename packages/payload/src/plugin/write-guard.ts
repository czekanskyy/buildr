import type { FieldHook } from 'payload';

/**
 * The context flag every write of the builder endpoints sets (docs/payload.md#save-autosave-drafts-publish-versions).
 * Anything else that saves the document (Payload Admin form, the REST API, a script) is not allowed to change `layout`.
 */
export const BUILDR_WRITE = 'buildrWrite';

/**
 * Payload Admin submits every field, including the `layout` it loaded when the form opened; taking
 * that value would overwrite what the builder saved since. So a write only changes the guarded field
 * when it comes from the builder (or creates the document); otherwise the stored value is kept.
 * `originalDoc` is the latest draft when drafts are enabled, which is exactly the value to keep.
 */
export const writeGuard =
  (name: string): FieldHook =>
  ({ value, originalDoc, operation, req }) => {
    if (operation === 'create') return value;
    if (req.context[BUILDR_WRITE] === true) return value;
    return (originalDoc as Record<string, unknown> | undefined)?.[name];
  };
