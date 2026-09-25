import type { ComponentMigrations, RegistryMeta } from '@buildr/core';
import type { PayloadRequest } from 'payload';
import { z } from 'zod';
import type { RateLimiter } from './forms/rate-limit.ts';

/** A function the host supplies; Zod only checks that it is one, the plugin never runs it at startup. */
const fn = <T>() => z.custom<T>((value) => typeof value === 'function', 'must be a function');

/** What the access functions get (`req.user`, ...). */
export interface AccessArgs {
  readonly req: PayloadRequest;
}
export type AccessFn = (args: AccessArgs) => boolean | Promise<boolean>;

/** What the plugin needs of a registry: its metadata and, optionally, the component migrations. */
export interface BuildrRegistry {
  readonly meta: RegistryMeta;
  readonly migrations?: ComponentMigrations | undefined;
}

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
  /** Only its metadata and migrations are used, so `{ meta }` is enough (a React registry fits too). */
  registry: z
    .custom<BuildrRegistry>(
      (value) =>
        typeof value === 'object' &&
        value !== null &&
        typeof (value as BuildrRegistry).meta === 'object',
    )
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
      /** Adds `buildr-form-submissions` and the public submission endpoint (needs `registry`). */
      enabled: z.boolean().default(false),
      /** Who a notification may go to: exact addresses or domains (`@example.com`). */
      notifyAllowlist: z.array(z.string()).default([]),
      /** Notified about every submission; each must match `notifyAllowlist`. */
      notifyTo: z.array(z.string()).default([]),
      /** Attempts per visitor and form per window; used by the bundled in-memory limiter. */
      rateLimit: z
        .object({
          limit: z.number().int().positive().default(5),
          windowMs: z.number().int().positive().default(60_000),
        })
        .default({ limit: 5, windowMs: 60_000 }),
      /** Replaces the in-memory limiter (which does not span serverless instances). */
      rateLimiter: z
        .custom<RateLimiter>(
          (value) =>
            typeof value === 'object' &&
            value !== null &&
            typeof (value as RateLimiter).hit === 'function',
          'must be a rate limiter',
        )
        .optional(),
    })
    .default({
      enabled: false,
      notifyAllowlist: [],
      notifyTo: [],
      rateLimit: { limit: 5, windowMs: 60_000 },
    }),
  access: z
    .object({
      edit: fn<AccessFn>().optional(),
      publish: fn<AccessFn>().optional(),
      unlockTemplates: fn<AccessFn>().optional(),
    })
    .default({}),
  /**
   * Access for AI agents (docs/mcp.md, ADR-024): Payload API-key requests, document listing and
   * creation. Off by default; an API-key request is refused by the builder endpoints unless enabled.
   */
  mcp: z
    .object({
      enabled: z.boolean().default(false),
      /** Lets an API-key user publish (they still need `access.publish`); off by default. */
      allowPublish: z.boolean().default(false),
      /** The collections an agent may list, create in and edit; default: all builder collections. */
      collections: z.array(z.string().min(1)).optional(),
      /** Writes per API-key user and window; used by the bundled in-memory limiter. */
      rateLimit: z
        .object({
          limit: z.number().int().positive().default(60),
          windowMs: z.number().int().positive().default(60_000),
        })
        .default({ limit: 60, windowMs: 60_000 }),
      /** Replaces the in-memory limiter (which does not span serverless instances). */
      rateLimiter: z
        .custom<RateLimiter>(
          (value) =>
            typeof value === 'object' &&
            value !== null &&
            typeof (value as RateLimiter).hit === 'function',
          'must be a rate limiter',
        )
        .optional(),
    })
    .default({
      enabled: false,
      allowPublish: false,
      rateLimit: { limit: 60, windowMs: 60_000 },
    }),
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
