import type { BuilderComponentProps } from '@next-buildr/react';

/** A plain `div`: landmarks (`main`, `header`, …) are Sections, so a page can have several. */
export function PageView({ root, children }: BuilderComponentProps<Record<string, never>>) {
  return <div {...root}>{children}</div>;
}
