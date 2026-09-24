import type { BuilderComponentProps } from '@buildr/react';
import { BADGE_VARIANTS, type badgeProps } from './props.ts';

const VARIANTS: readonly string[] = BADGE_VARIANTS;

export function BadgeView({ props, root }: BuilderComponentProps<typeof badgeProps>) {
  const variant = VARIANTS.includes(String(props.variant)) ? String(props.variant) : 'neutral';
  return (
    <span {...root} data-variant={variant}>
      {props.text}
    </span>
  );
}
