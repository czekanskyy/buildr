import { type FieldHook, ValidationError } from 'payload';
import type { ResolvedOptions } from '../options.ts';
import { BUILDR_WRITE, writeGuard } from '../write-guard.ts';
import { describeDiagnostics, processLayout } from './process-layout.ts';

/**
 * The `beforeChange` hook of the `layout` field: the write-guard first (a write that is not the
 * builder keeps the stored value, which is not re-validated), then `processLayout` for the writes
 * that are allowed to change it. Invalid documents are rejected with a field error the admin shows.
 */
export const layoutHook =
  (options: Pick<ResolvedOptions, 'registry' | 'limits'>): FieldHook =>
  (args) => {
    const guarded = writeGuard('layout')(args);
    const accepted = args.operation === 'create' || args.req.context[BUILDR_WRITE] === true;
    if (!accepted) return guarded;
    // An update that does not carry a layout (a publish, a title edit) leaves it as it is.
    if (args.operation === 'update' && guarded === undefined) return undefined;
    const result = processLayout(guarded, options);
    if (!result.ok) {
      throw new ValidationError({
        ...(args.collection == null ? {} : { collection: args.collection.slug }),
        errors: [{ path: 'layout', message: describeDiagnostics(result.diagnostics) }],
        req: args.req,
      });
    }
    for (const warning of result.warnings) {
      args.req.payload.logger.warn({ code: warning.code, path: warning.path }, warning.message);
    }
    return result.doc;
  };
