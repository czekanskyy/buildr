import type { BuilderComponentProps } from '@buildr/react';
import type { dividerProps } from './props.ts';

export function DividerView({ props, root }: BuilderComponentProps<typeof dividerProps>) {
  return <hr {...root} {...(props.decorative ? { role: 'presentation' } : {})} />;
}
