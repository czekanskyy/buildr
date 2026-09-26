import type { BuilderComponentProps } from '@next-buildr/react';
import type { stackProps } from './props.ts';

export function StackView({ props, root, children }: BuilderComponentProps<typeof stackProps>) {
  return (
    <div
      {...root}
      {...(props.role !== 'none' ? { role: String(props.role) } : {})}
      {...(props.ariaLabel !== '' ? { 'aria-label': props.ariaLabel } : {})}
    >
      {children}
    </div>
  );
}
