import type { BuilderComponentProps } from '@next-buildr/react';
import { hasIcon, Icon } from '../icons/index.ts';
import { ICON_SIZES, type iconProps } from './props.ts';

const SIZES: readonly string[] = ICON_SIZES;

/** The icon is the root element: its class and identity go on the `svg` itself. */
export function IconView({ props, root }: BuilderComponentProps<typeof iconProps>) {
  if (!hasIcon(props.name)) return null;
  const size = SIZES.includes(String(props.size)) ? String(props.size) : 'md';
  return (
    <Icon
      {...root}
      name={props.name}
      data-size={size}
      {...(props.label !== '' ? { label: props.label } : {})}
    />
  );
}
