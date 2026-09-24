import { type NodeStyles, s, type TreeNode } from '@buildr/core';

/** Small builders for template trees, so each template reads as the page it makes. */

export const styled = (styles: unknown): { styles: NodeStyles } => ({
  styles: styles as NodeStyles,
});

export const heading = (text: string, level: number, styles?: unknown): TreeNode => ({
  type: 'buildr/heading',
  props: { text: s(text), level: s(level) } as never,
  ...(styles === undefined ? {} : styled(styles)),
});

export const text = (value: string, styles?: unknown): TreeNode => ({
  type: 'buildr/text',
  props: { text: s(value) } as never,
  ...(styles === undefined ? {} : styled(styles)),
});

export const button = (
  label: string,
  props: { variant?: string; href?: string; size?: string; type?: string } = {},
): TreeNode => ({
  type: 'buildr/button',
  props: {
    label: s(label),
    ...(props.variant === undefined ? {} : { variant: s(props.variant) }),
    ...(props.size === undefined ? {} : { size: s(props.size) }),
    ...(props.type === undefined ? {} : { type: s(props.type) }),
    ...(props.href === undefined ? {} : { href: s(props.href) }),
  } as never,
});

export const badge = (label: string, variant = 'primary'): TreeNode => ({
  type: 'buildr/badge',
  props: { text: s(label), variant: s(variant) } as never,
});

export const icon = (name: string, size = 'lg'): TreeNode => ({
  type: 'buildr/icon',
  props: { name: s(name), size: s(size) } as never,
});

/** A vertical stack; `styles` may add alignment, gap and responsive overrides. */
export const stack = (
  children: readonly TreeNode[],
  styles?: unknown,
  extra: Partial<TreeNode> = {},
): TreeNode => ({
  type: 'buildr/stack',
  children,
  ...(styles === undefined ? {} : styled(styles)),
  ...extra,
});

/** A grid of `columns` equal columns, `tablet` on tablets and one on phones unless told otherwise. */
export const grid = (
  children: readonly TreeNode[],
  columns: number,
  tablet: number,
  gap = '$space.6',
  extraBase: Record<string, unknown> = {},
): TreeNode => ({
  type: 'buildr/grid',
  children,
  ...styled({
    base: { layout: { columns, gap, ...extraBase } },
    bp: { tablet: { layout: { columns: tablet } }, mobile: { layout: { columns: 1 } } },
  }),
});

/** A full-width band with the theme's vertical rhythm, tighter on small screens. */
export const section = (
  children: readonly TreeNode[],
  props: { container?: string; ariaLabel?: string } = {},
  extraStyles: { base?: Record<string, unknown>; bp?: Record<string, unknown> } = {},
): TreeNode => ({
  type: 'buildr/section',
  props: {
    container: s(props.container ?? 'lg'),
    ...(props.ariaLabel === undefined ? {} : { ariaLabel: s(props.ariaLabel) }),
  } as never,
  children,
  ...styled({
    base: {
      spacing: { padding: { top: '$space.16', bottom: '$space.16' } },
      ...extraStyles.base,
    },
    bp: {
      tablet: { spacing: { padding: { top: '$space.12', bottom: '$space.12' } } },
      mobile: { spacing: { padding: { top: '$space.8', bottom: '$space.8' } } },
      ...extraStyles.bp,
    },
  }),
});

export const centered = { layout: { align: 'center' }, typography: { textAlign: 'center' } };
