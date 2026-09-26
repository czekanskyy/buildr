import type { BuilderComponentProps } from '@next-buildr/react';
import type { gridProps } from './props.ts';

export function GridView({ props, root, children }: BuilderComponentProps<typeof gridProps>) {
  return (
    <div
      {...root}
      {...(props.ariaLabel !== '' ? { role: 'group', 'aria-label': props.ariaLabel } : {})}
    >
      {children}
    </div>
  );
}
