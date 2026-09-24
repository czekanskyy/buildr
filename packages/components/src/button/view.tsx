import type { BuilderComponentProps } from '@buildr/react';
import { createElement, Fragment, type ReactNode } from 'react';
import { hasIcon, Icon } from '../icons/index.ts';
import { linkAttributes, newTabNotice } from '../link-attributes.ts';
import { BUTTON_SIZES, BUTTON_VARIANTS, type buttonProps } from './props.ts';

type Props = BuilderComponentProps<typeof buttonProps>;

const oneOf = <T extends string>(allowed: readonly T[], value: unknown, fallback: T): T =>
  allowed.includes(value as T) ? (value as T) : fallback;

export function ButtonView({ props, root, platform, env }: Props) {
  const label = props.label;
  const icon = hasIcon(props.icon) ? <Icon name={props.icon} /> : null;
  const text = label !== '' ? <span className="bc-button__label">{label}</span> : null;
  const notice = newTabNotice(props.newTab, props.ariaLabel, env);

  const iconNode: ReactNode = icon !== null ? <Fragment key="icon">{icon}</Fragment> : null;
  const textNode: ReactNode = text !== null ? <Fragment key="text">{text}</Fragment> : null;
  const content = props.iconPosition === 'end' ? [textNode, iconNode] : [iconNode, textNode];
  const attributes = {
    ...root,
    'data-variant': oneOf(BUTTON_VARIANTS, props.variant, 'primary'),
    'data-size': oneOf(BUTTON_SIZES, props.size, 'md'),
    ...(label === '' && icon !== null ? { 'data-icon-only': '' } : {}),
  };

  const children = [
    ...content,
    notice !== undefined ? (
      <span key="notice" className="bc-visually-hidden">
        {notice}
      </span>
    ) : null,
  ];

  if (props.href !== '') {
    const link = {
      ...attributes,
      ...linkAttributes(props.newTab, props.ariaLabel, env),
      href: props.href,
    };
    return platform !== undefined
      ? createElement(platform.Link, link, children)
      : createElement('a', link, children);
  }

  return createElement(
    'button',
    {
      ...attributes,
      type: props.type === 'submit' ? 'submit' : 'button',
      ...(props.ariaLabel !== '' ? { 'aria-label': props.ariaLabel } : {}),
    },
    children,
  );
}
