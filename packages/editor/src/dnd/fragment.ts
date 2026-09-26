import {
  type BuilderFragment,
  type DragItem,
  fromTree,
  instantiateTemplate,
  type RegistryMeta,
} from '@next-buildr/core';

/** What dropping a palette item inserts: a template's tree, or a component with its defaults. */
export function fragmentFor(
  registry: RegistryMeta,
  item: Exclude<DragItem, { kind: 'nodes' }>,
): BuilderFragment | undefined {
  if (item.kind === 'template') {
    const definition = registry.getTemplate(item.id);
    return definition === undefined ? undefined : instantiateTemplate(definition);
  }
  const meta = registry.get(item.type);
  if (meta === undefined) return undefined;
  return fromTree({
    type: meta.type,
    ...(meta.defaults?.slots !== undefined ? { slots: meta.defaults.slots } : {}),
  });
}
