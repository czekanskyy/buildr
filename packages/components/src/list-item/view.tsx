import type { BuilderComponentProps } from '@next-buildr/react';
import type { listItemProps } from './props.ts';

export function ListItemView({
  props,
  root,
  children,
}: BuilderComponentProps<typeof listItemProps>) {
  return (
    <li {...root}>
      {props.text}
      {children}
    </li>
  );
}
