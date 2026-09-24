import type { BuilderComponentProps } from '@buildr/react';
import { createElement } from 'react';
import { linkAttributes, newTabNotice } from '../link-attributes.ts';
import { CARD_ELEMENTS, CARD_VARIANTS, type cardProps } from './props.ts';

const ELEMENTS: readonly string[] = CARD_ELEMENTS;
const VARIANTS: readonly string[] = CARD_VARIANTS;

export function CardView({
  props,
  root,
  slots,
  platform,
  env,
}: BuilderComponentProps<typeof cardProps>) {
  const tag = ELEMENTS.includes(String(props.as)) ? String(props.as) : 'article';
  const variant = VARIANTS.includes(String(props.variant)) ? String(props.variant) : 'outlined';

  const notice = newTabNotice(props.newTab, props.linkLabel, env);
  const anchor = {
    className: 'bc-card__link',
    href: props.href,
    ...linkAttributes(props.newTab, props.linkLabel, env),
  };
  // Empty apart from its name, so the card's contents are never inside the link.
  const link =
    props.href !== ''
      ? createElement(
          platform !== undefined ? platform.Link : 'a',
          anchor,
          props.linkLabel,
          notice !== undefined ? <span className="bc-visually-hidden">{notice}</span> : null,
        )
      : null;

  return createElement(
    tag,
    { ...root, 'data-variant': variant, ...(props.href !== '' ? { 'data-linked': '' } : {}) },
    <div key="media" className="bc-card__media">
      {slots['media']}
    </div>,
    <div key="body" className="bc-card__body">
      {slots['body']}
      {link}
    </div>,
    <div key="actions" className="bc-card__actions">
      {slots['actions']}
    </div>,
  );
}
