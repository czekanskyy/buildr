import type { CollectionConfig, Config, Plugin } from 'payload';
import { formSubmissionsCollection } from './collections/form-submissions.ts';
import { templatesCollection } from './collections/templates.ts';
import { buildrEndpoints } from './endpoints/index.ts';
import {
  buildrFields,
  RESERVED_FIELDS,
  RESERVED_MCP_FIELDS,
  TEMPLATES_COLLECTION,
} from './fields.ts';
import { isAllowedRecipient } from './forms/notify.ts';
import { createMemoryRateLimiter } from './forms/rate-limit.ts';
import { layoutHook } from './hooks/layout-hook.ts';
import { type BuildrPluginOptions, resolveOptions } from './options.ts';
import { writeGuard } from './write-guard.ts';

export { FORM_SUBMISSIONS_COLLECTION } from './collections/form-submissions.ts';
export { FORM_TYPE, HONEYPOT_FIELD } from './endpoints/forms.ts';
export { LAYOUT_FIELD_COMPONENT, TEMPLATES_COLLECTION } from './fields.ts';
export type { MemoryRateLimiterOptions, RateLimiter, RateLimitResult } from './forms/rate-limit.ts';
export { createMemoryRateLimiter } from './forms/rate-limit.ts';
export type { ProcessedLayout, ProcessLayoutOptions } from './hooks/process-layout.ts';
export { describeDiagnostics, documentLimits, processLayout } from './hooks/process-layout.ts';
export type {
  AccessArgs,
  AccessFn,
  BuildrPluginOptions,
  BuildrRegistry,
  ResolvedOptions,
} from './options.ts';
export { resolveOptions } from './options.ts';
export { BUILDR_WRITE } from './write-guard.ts';

const hasDrafts = (collection: CollectionConfig): boolean => {
  const versions = collection.versions;
  return typeof versions === 'object' && versions !== null && Boolean(versions.drafts);
};

/**
 * The one-line install (docs/payload.md): adds the `layout`, `buildrRevision` and `template` fields
 * to the configured collections and guards them against writes that do not come from the builder.
 */
export function buildrPlugin(input: BuildrPluginOptions): Plugin {
  const options = resolveOptions(input);
  const forms = options.forms;
  if (forms.enabled && options.registry === undefined) {
    throw new Error(
      'buildrPlugin: forms need the "registry" option (the form schema is derived from it)',
    );
  }
  const stray = forms.notifyTo.find(
    (address) => !isAllowedRecipient(address, forms.notifyAllowlist),
  );
  if (stray !== undefined) {
    throw new Error(`buildrPlugin: forms.notifyTo "${stray}" is not in forms.notifyAllowlist`);
  }
  const rateLimiter = forms.enabled
    ? (forms.rateLimiter ?? createMemoryRateLimiter(forms.rateLimit))
    : undefined;
  const writeLimiter = options.mcp.enabled
    ? (options.mcp.rateLimiter ?? createMemoryRateLimiter(options.mcp.rateLimit))
    : undefined;
  return (config: Config): Config => {
    const collections = config.collections ?? [];
    const authSlugs = collections.filter((c) => Boolean(c.auth)).map((c) => c.slug);
    if (options.mcp.enabled) {
      const keyed = collections.some(
        (c) => typeof c.auth === 'object' && Boolean(c.auth.useAPIKey),
      );
      if (!keyed) {
        throw new Error(
          'buildrPlugin: mcp.enabled needs an auth collection with `auth: { useAPIKey: true }` (a dedicated, low-privilege agent user; see docs/mcp.md)',
        );
      }
      const unknown = (options.mcp.collections ?? []).find(
        (slug) => options.collections[slug] === undefined,
      );
      if (unknown !== undefined) {
        throw new Error(
          `buildrPlugin: mcp.collections "${unknown}" is not a configured builder collection`,
        );
      }
    }
    for (const slug of Object.keys(options.collections)) {
      const collection = collections.find((candidate) => candidate.slug === slug);
      if (collection === undefined) {
        throw new Error(`buildrPlugin: the configured collection "${slug}" does not exist`);
      }
      if (!hasDrafts(collection)) {
        throw new Error(
          `buildrPlugin: the collection "${slug}" must enable versions.drafts (the builder saves drafts and autosaves)`,
        );
      }
      const taken = (collection.fields as { name?: string }[]).find(
        (field) =>
          field.name !== undefined &&
          (RESERVED_FIELDS.includes(field.name) ||
            (options.mcp.enabled && RESERVED_MCP_FIELDS.includes(field.name))),
      );
      if (taken !== undefined) {
        throw new Error(
          `buildrPlugin: the collection "${slug}" already has a "${taken.name}" field`,
        );
      }
    }
    const targets = Object.entries(options.collections)
      .filter(([, own]) => own.templates)
      .map(([slug]) => slug);
    if (targets.length > 0 && collections.some((c) => c.slug === TEMPLATES_COLLECTION)) {
      throw new Error(
        `buildrPlugin: the collection "${TEMPLATES_COLLECTION}" is added by the plugin and must not be defined`,
      );
    }
    return {
      ...config,
      endpoints: [
        ...(config.endpoints ?? []),
        ...buildrEndpoints({ options, rateLimiter, writeLimiter }),
      ],
      collections: [
        ...collections.map((collection) => {
          const own = options.collections[collection.slug];
          if (own === undefined) return collection;
          return {
            ...collection,
            fields: [
              ...collection.fields,
              ...buildrFields({
                templates: own.templates,
                editorRoute: options.routes.editor,
                guard: writeGuard,
                layoutHook: layoutHook(options),
                updatedBy: options.mcp.enabled ? authSlugs : undefined,
              }),
            ],
          };
        }),
        ...(targets.length === 0 ? [] : [templatesCollection({ resolved: options, targets })]),
        ...(forms.enabled ? [formSubmissionsCollection()] : []),
      ],
    };
  };
}
