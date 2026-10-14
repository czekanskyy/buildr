import type { MediaAsset } from '@next-buildr/core';
import type { BuilderComponentProps } from '@next-buildr/react';
import { createElement } from 'react';
import { CONTAINER_ELEMENTS, type containerProps } from './props.ts';

type Props = BuilderComponentProps<typeof containerProps>;

const ELEMENTS: ReadonlySet<string> = new Set(CONTAINER_ELEMENTS);

/**
 * One root element (the chosen `as`, `div` if it is not on the allowlist). The width limit is done
 * with margins or, for `bleed`, with padding in CSS, so there is no wrapper element; the background
 * image is a decorative sibling of the content, behind it.
 */
export function ContainerView({ props, root, children, platform }: Props) {
  const requested = String(props.as);
  const tag = ELEMENTS.has(requested) ? requested : 'div';
  const image = props.backgroundImage as unknown as MediaAsset | null;
  const Image = platform?.Image;
  const hasBackground = typeof image?.url === 'string';
  const background = hasBackground
    ? Image !== undefined
      ? createElement(Image, {
          className: 'bc-container__background',
          src: image.url,
          alt: '',
          ...(image.width !== undefined ? { width: image.width } : {}),
          ...(image.height !== undefined ? { height: image.height } : {}),
        })
      : createElement('img', {
          className: 'bc-container__background',
          src: image.url,
          alt: '',
        })
    : null;

  return createElement(
    tag,
    {
      ...root,
      'data-display': String(props.display),
      'data-width': String(props.width),
      ...(props.bleed ? { 'data-bleed': '' } : {}),
      ...(hasBackground ? { 'data-has-background': '' } : {}),
      // A role on `main`, `nav`, `header`... would override the landmark (`<main role="group">`), so
      // it applies to a plain `div` only (a stack always was one).
      ...(tag === 'div' && props.role !== 'none' ? { role: String(props.role) } : {}),
      // A landmark needs a name to be exposed as one (`section`, `aside`, `nav`, `header`, `footer`).
      ...(props.ariaLabel !== '' ? { 'aria-label': props.ariaLabel } : {}),
    },
    background,
    children,
  );
}
