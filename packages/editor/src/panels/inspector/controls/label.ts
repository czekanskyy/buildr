import type { PropDef } from '@buildr/core';

const titleCase = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** The label of a prop: its own, else its name split into words. */
export function propLabel(name: string, def: PropDef): string {
  if (def.label !== undefined) return def.label;
  const words = name.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[-_]+/g, ' ');
  return titleCase(words.toLowerCase());
}
