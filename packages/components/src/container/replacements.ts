import {
  type ComponentReplacement,
  type ComponentReplacementNode,
  isStaticValue,
  type NodeStyles,
  s,
} from '@next-buildr/core';

type Styles = ComponentReplacementNode['styles'];
type Layout = NonNullable<NonNullable<NodeStyles['base']>['layout']>;

/**
 * `buildr/stack` -> container: a flex column with the stack's gap, no width limit (so it sizes like
 * the old stack, also inside a row), and the stack's role and name.
 */
const fromStack: ComponentReplacement = {
  fromVersion: 1,
  toVersion: 2,
  migrate: ({ props, styles }) => ({
    props: { ...props, as: s('div'), display: s('flex'), width: s('none') },
    styles,
  }),
};

/** Section content widths: `full` becomes "no limit"; anything unreadable falls back to the default. */
function widthOf(value: unknown): string {
  if (typeof value === 'object' && value !== null && isStaticValue(value as never)) {
    const raw = (value as { value: unknown }).value;
    if (raw === 'full') return 'none';
    if (raw === 'sm' || raw === 'md' || raw === 'lg' || raw === 'xl') return raw;
  }
  return 'lg';
}

/**
 * A section had no gap, a container does (a flex column with `space-4`). Writes the missing gap as
 * `0` into the base layout, key by key and only where absent; breakpoints and states are never
 * touched.
 */
function withoutGap(styles: Styles): Styles {
  const layout: Layout = styles?.base?.layout ?? {};
  const hasGap = layout.gap !== undefined;
  const hasRow = layout.rowGap !== undefined;
  const hasColumn = layout.columnGap !== undefined;
  if (hasGap || (hasRow && hasColumn)) return styles;

  const fill: { gap?: string; rowGap?: string; columnGap?: string } = {};
  if (!hasRow && !hasColumn) fill.gap = '0';
  else if (!hasRow) fill.rowGap = '0';
  else fill.columnGap = '0';
  return {
    ...styles,
    base: { ...styles?.base, layout: { ...layout, ...fill } },
  };
}

/**
 * `buildr/section` -> container: the section's defaults are filled first (`as` section, width
 * `lg`), then written explicitly as a bleeding flex column; the old `container` prop becomes
 * `width` (`full` -> `none`). The background image is copied as it is, so a binding stays one.
 */
const fromSection: ComponentReplacement = {
  fromVersion: 1,
  toVersion: 2,
  migrate: ({ props, styles }) => {
    const { container, ...rest } = props ?? {};
    return {
      props: {
        ...rest,
        as: rest['as'] ?? s('section'),
        display: s('flex'),
        width: s(widthOf(container)),
        bleed: s(true),
      },
      styles: withoutGap(styles),
    };
  },
};

export const containerReplaces = {
  'buildr/stack': fromStack,
  'buildr/section': fromSection,
} as const;
