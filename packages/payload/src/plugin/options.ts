import type { RegistryMeta } from '@buildr/core';
import { z } from 'zod';

/** A function the host supplies; Zod only checks that it is one, the plugin never runs it at startup. */
const fn = <T>() => z.custom<T>((value) => typeof value === 'function', 'must be a function');

/** The slice of Payload's `PayloadRequest` the access functions read (`req.user`, ...). */
export interface AccessArgs {
  readonly req: { readonly user?: unknown; readonly [key: string]: unknown };
}
export type AccessFn = (args: AccessArgs) => boolean | Promise<boolean>;

const collectionOptions = z.object({
  /** The name the collection document is bound under in dynamic values (`page`, `post`, ...). */
  context: z.string().min(1),
  /** The public path of a document; drives previews, revalidation and `route` in the context. */
  path: fn<(doc: Record<string, unknown>) => string>().optional(),
  /** Templates (`buildr-templates`) can be attached to this collection. */
  templates: z.boolean().default(false),
  /** How deep relations are resolved in the context. */
  depth: z.number().int().min(0).max(5).default(0),
  /** Whether the a11y rules expect exactly one `h1`. */
  expectH1: z.boolean().default(false),
});

const queryableOptions = z.object({
  fields: z.array(z.string().min(1)),
  sort: z.array(z.string().min(1)).default([]),
});

export const optionsSchema = z.object({
  /** Only its metadata and migrations are used, so `registry.meta` is enough. */
  registry: z
    .custom<RegistryMeta>((value) => typeof value === 'object' && value !== null)
    .optional(),
  routes: z
    .object({
      editor: z.string().startsWith('/').default('/buildr/edit'),
      canvas: z.string().startsWith('/').default('/buildr/canvas'),
      preview: z.string().startsWith('/').default('/buildr/preview'),
    })
    .default({ editor: '/buildr/edit', canvas: '/buildr/canvas', preview: '/buildr/preview' }),
  collections: z.record(z.string().min(1), collectionOptions),
  globals: z.record(z.string().min(1), z.string().min(1)).default({}),
  queryable: z.record(z.string().min(1), queryableOptions).default({}),
  media: z.object({ collection: z.string().min(1) }).optional(),
  forms: z
    .object({
      enabled: z.boolean().default(false),
      notifyAllowlist: z.array(z.string()).default([]),
    })
    .default({ enabled: false, notifyAllowlist: [] }),
  access: z
    .object({
      edit: fn<AccessFn>().optional(),
      publish: fn<AccessFn>().optional(),
      unlockTemplates: fn<AccessFn>().optional(),
    })
    .default({}),
  limits: z
    .object({
      maxNodes: z.number().int().positive().default(5000),
      maxBytes: z.number().int().positive().default(2_000_000),
    })
    .default({ maxNodes: 5000, maxBytes: 2_000_000 }),
  a11y: z
    .object({ publish: z.enum(['warn', 'block']).default('warn') })
    .default({ publish: 'warn' }),
});

export type BuildrPluginOptions = z.input<typeof optionsSchema>;
export type ResolvedOptions = z.output<typeof optionsSchema>;

/** Validates the options (a bad config fails at startup, with every problem listed). */
export function resolveOptions(input: BuildrPluginOptions): ResolvedOptions {
  const parsed = optionsSchema.safeParse(input);
  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(options)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`buildrPlugin: invalid options\n${problems}`);
  }
  return parsed.data;
}
