import type { BuilderComponentProps } from '@next-buildr/react';
import { type anchorProps, isAnchorName } from './props.ts';

export function AnchorView({ props, root, env }: BuilderComponentProps<typeof anchorProps>) {
  const valid = isAnchorName(props.name);
  if (env.mode === 'canvas') {
    return (
      <span {...root} {...(valid ? { id: props.name } : {})} data-canvas="">
        #{props.name}
      </span>
    );
  }
  if (!valid) return null;
  return <span {...root} id={props.name} />;
}
