import {
  type ComponentMigrations,
  type ComponentType,
  createRegistryMeta,
  type RegistryMeta,
  type TemplateDefinition,
} from '@next-buildr/core';
import type { ComponentDefinition } from './types.ts';

export interface ReactRegistryInput {
  readonly components: readonly ComponentDefinition[];
  readonly templates?: readonly TemplateDefinition[];
}

/**
 * Component metadata (`meta`, a core `RegistryMeta` — pass it to `toManifest`, `canInsert`,
 * `validateDocument`, …) together with the implementations that render it. Immutable; `extend`
 * returns a new registry.
 */
export interface ReactRegistry {
  readonly meta: RegistryMeta;
  get(type: ComponentType): ComponentDefinition | undefined;
  has(type: ComponentType): boolean;
  list(): readonly ComponentDefinition[];
  /** What `migrateComponents` needs: every type's current version, steps and replacements. */
  readonly migrations: ComponentMigrations;
  extend(addition: Partial<ReactRegistryInput>): ReactRegistry;
}

/**
 * Builds an immutable registry (docs/component-registry.md#registering-components). Throws on a
 * duplicate type or template id or an invalid definition — an authoring mistake made while
 * wiring up the application. There is no global registry and no `registerComponent()`.
 */
export function createRegistry(input: ReactRegistryInput): ReactRegistry {
  const meta = createRegistryMeta({
    components: input.components.map((definition) => definition.meta),
    ...(input.templates !== undefined ? { templates: input.templates } : {}),
  });
  const definitions = [...input.components];
  const byType = new Map(definitions.map((definition) => [definition.meta.type, definition]));
  const replacedBy = new Map<ComponentType, ComponentType>();
  for (const definition of definitions) {
    for (const retired of Object.keys(definition.replaces ?? {})) {
      if (byType.has(retired)) {
        throw new Error(
          `createRegistry: retired type "${retired}" replaced by "${definition.meta.type}" is still registered`,
        );
      }
      const previous = replacedBy.get(retired);
      if (previous !== undefined) {
        throw new Error(
          `createRegistry: retired type "${retired}" is replaced by both "${previous}" and "${definition.meta.type}"`,
        );
      }
      replacedBy.set(retired, definition.meta.type);
    }
  }
  const migrations: ComponentMigrations = Object.fromEntries(
    definitions.map((definition) => [
      definition.meta.type,
      {
        currentVersion: definition.meta.version,
        steps: definition.migrations,
        ...(definition.replaces !== undefined ? { replaces: definition.replaces } : {}),
      },
    ]),
  );

  return {
    meta,
    get: (type) => byType.get(type),
    has: (type) => byType.has(type),
    list: () => definitions,
    migrations,
    extend: (addition) =>
      createRegistry({
        components: [...definitions, ...(addition.components ?? [])],
        templates: [...meta.listTemplates(), ...(addition.templates ?? [])],
      }),
  };
}
