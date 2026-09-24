import type { CollectionConfig, Config, Plugin } from 'payload';
import { templatesCollection } from './collections/templates.ts';
import { buildrEndpoints } from './endpoints/index.ts';
import { buildrFields, RESERVED_FIELDS, TEMPLATES_COLLECTION } from './fields.ts';
import { layoutHook } from './hooks/layout-hook.ts';
import { type BuildrPluginOptions, resolveOptions } from './options.ts';
import { writeGuard } from './write-guard.ts';

export { LAYOUT_FIELD_COMPONENT, TEMPLATES_COLLECTION } from './fields.ts';
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
  return (config: Config): Config => {
    const collections = config.collections ?? [];
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
        (field) => field.name !== undefined && RESERVED_FIELDS.includes(field.name),
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
      endpoints: [...(config.endpoints ?? []), ...buildrEndpoints({ options })],
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
              }),
            ],
          };
        }),
        ...(targets.length === 0 ? [] : [templatesCollection({ resolved: options, targets })]),
      ],
    };
  };
}
