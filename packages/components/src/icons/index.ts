export type { IconProps } from './icon.tsx';
export { hasIcon, Icon } from './icon.tsx';
export type { IconName } from './nodes.ts';
export { ICON_NODES } from './nodes.ts';
export type { IconNode, IconShape } from './types.ts';

import { ICON_NODES } from './nodes.ts';

/** Every icon name, sorted; what the editor's icon picker lists. */
export const ICON_NAMES: readonly string[] = Object.freeze(Object.keys(ICON_NODES).sort());
