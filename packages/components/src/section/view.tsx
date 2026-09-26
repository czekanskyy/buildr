import type { MediaAsset } from '@next-buildr/core';
import type { BuilderComponentProps } from '@next-buildr/react';
import { createElement } from 'react';
import { SECTION_ELEMENTS, type sectionProps } from './props.ts';

type Props = BuilderComponentProps<typeof sectionProps>;

const ELEMENTS: ReadonlySet<string> = new Set(SECTION_ELEMENTS);

/**
 * One root element (the chosen `as`, `section` if it is not on the allowlist). The content column
 * is done with padding in CSS, so there is no wrapper element; the background image is a decorative
 * sibling of the content, behind it.
 */
export function SectionView({ props, root, children, platform }: Props) {
  const requested = String(props.as);
  const tag = ELEMENTS.has(requested) ? requested : 'section';
  const image = props.backgroundImage as unknown as MediaAsset | null;
  const Image = platform?.Image;
  const background =
    typeof image?.url === 'string'
      ? Image !== undefined
        ? createElement(Image, {
            className: 'bc-section__background',
            src: image.url,
            alt: '',
            ...(image.width !== undefined ? { width: image.width } : {}),
            ...(image.height !== undefined ? { height: image.height } : {}),
          })
        : createElement('img', {
            className: 'bc-section__background',
            src: image.url,
            alt: '',
          })
      : null;

  return createElement(
    tag,
    {
      ...root,
      'data-container': String(props.container),
      // A landmark needs a name to be exposed as one (`section`, `aside`, `nav`, `header`, `footer`).
      ...(props.ariaLabel !== '' ? { 'aria-label': props.ariaLabel } : {}),
    },
    background,
    children,
  );
}
