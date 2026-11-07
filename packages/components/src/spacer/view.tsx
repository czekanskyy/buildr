import type { BuilderComponentProps } from '@next-buildr/react';
import { SPACER_SIZES, type spacerProps } from './props.ts';

export function SpacerView({ props, root, env }: BuilderComponentProps<typeof spacerProps>) {
  const size = SPACER_SIZES.includes(props.size as never) ? props.size : 'md';
  return (
    <div
      {...root}
      aria-hidden="true"
      data-size={size}
      data-axis={props.axis === 'horizontal' ? 'horizontal' : 'vertical'}
      {...(env.mode === 'canvas' ? { 'data-canvas': '' } : {})}
    />
  );
}
