import type { BuilderComponentProps } from '@next-buildr/react';
import type { loopProps } from './props.ts';

/** The renderer produces the entries (`item`), the empty state and `after`; this only lays them out. */
export function LoopView({ root, slots }: BuilderComponentProps<typeof loopProps>) {
  return (
    <div {...root}>
      {slots['item']}
      {slots['empty']}
      <div className="bc-loop__after">{slots['after']}</div>
    </div>
  );
}
