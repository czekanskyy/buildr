import type { BuilderComponentProps } from '@buildr/react';
import type { containerProps } from './props.ts';

export function ContainerView({
  props,
  root,
  children,
}: BuilderComponentProps<typeof containerProps>) {
  return (
    <div {...root} data-width={props.width}>
      {children}
    </div>
  );
}
