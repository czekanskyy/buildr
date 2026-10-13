import type { BuilderFragment } from '../document/fragment.ts';
import type { ComponentType } from '../document/types.ts';
import type { RegistryMeta } from './registry.ts';

/** The prop-schema version `registry` serves for every registered component type. */
export function registryVersions(registry: RegistryMeta): Readonly<Record<ComponentType, number>> {
  return Object.fromEntries(registry.list().map((meta) => [meta.type, meta.version]));
}

/**
 * Pins a fragment's `components` to what `registry` serves. Types the registry doesn't know keep
 * the fragment's own version. Use it on fragments built without versions (`fromTree` stamps 1).
 */
export function withRegistryVersions(
  fragment: BuilderFragment,
  registry: RegistryMeta,
): BuilderFragment {
  return {
    ...fragment,
    components: Object.fromEntries(
      Object.entries(fragment.components).map(([type, version]) => [
        type,
        registry.get(type)?.version ?? version,
      ]),
    ),
  };
}
