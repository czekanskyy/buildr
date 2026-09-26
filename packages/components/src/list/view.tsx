import type { BuilderComponentProps } from '@next-buildr/react';
import { createElement } from 'react';
import type { listProps } from './props.ts';

export function ListView({ props, root, children }: BuilderComponentProps<typeof listProps>) {
  return createElement(
    props.ordered ? 'ol' : 'ul',
    {
      ...root,
      'data-ordered': props.ordered ? '' : undefined,
      ...(props.ariaLabel !== '' ? { 'aria-label': props.ariaLabel } : {}),
    },
    children,
  );
}
