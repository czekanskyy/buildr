import {
  type BuilderFragment,
  type DragItem,
  fromTree,
  instantiateTemplate,
  type RegistryMeta,
  registryVersions,
} from '@next-buildr/core';

/** What dropping a palette item inserts: a template's tree, or a component with its defaults. */
export function fragmentFor(
  registry: RegistryMeta,
  item: Exclude<DragItem, { kind: 'nodes' }>,
): BuilderFragment | undefined {
  const versions = registryVersions(registry);
  if (item.kind === 'template') {
    const definition = registry.getTemplate(item.id);
    return definition === undefined
      ? undefined
      : instantiateTemplate(definition, undefined, undefined, versions);
  }
  const meta = registry.get(item.type);
  if (meta === undefined) return undefined;
  return fromTree(
    {
      type: meta.type,
      ...(meta.defaults?.slots !== undefined ? { slots: meta.defaults.slots } : {}),
    },
    undefined,
    versions,
  );
}
