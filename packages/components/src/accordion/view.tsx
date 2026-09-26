import type { BuilderComponentProps } from '@next-buildr/react';
import type { accordionProps } from './props.ts';

export function AccordionView({ root, children }: BuilderComponentProps<typeof accordionProps>) {
  return <div {...root}>{children}</div>;
}
