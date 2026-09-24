import type { BuilderComponentProps } from '@buildr/react';
import { createElement } from 'react';
import { TEXT_ELEMENTS, type textProps } from './props.ts';

const ELEMENTS: readonly string[] = TEXT_ELEMENTS;

/** Line breaks in the text are kept (`white-space: pre-line` in the CSS); the text is never HTML. */
export function TextView({ props, root }: BuilderComponentProps<typeof textProps>) {
  const requested = String(props.as);
  return createElement(ELEMENTS.includes(requested) ? requested : 'p', root, props.text);
}
