import { type FormatSpec, type NodeStyles, s, type TreeNode } from '@next-buildr/core';

/** Small builders for template trees, so each template reads as the page it makes. */

/** A property that is either fixed text or any value the document can hold (a binding, a formula). */
export type Text = string | { readonly kind: 'binding' | 'expression' };

const val = (value: Text): never => (typeof value === 'string' ? s(value) : value) as never;

/** A binding to `path` in the data (`post.title`, `item.path`), optionally formatted and with a fallback. */
export const bind = (
  path: string,
  options: { format?: FormatSpec; fallback?: string | number } = {},
) =>
  ({
    kind: 'binding',
    path,
    ...(options.format === undefined ? {} : { format: options.format }),
    ...(options.fallback === undefined ? {} : { fallback: options.fallback }),
  }) as const;

/** A formula over the data, for what a single format cannot say (`formatCurrency(product.price, product.currency)`). */
export const formula = (expr: string) => ({ kind: 'expression', expr, mode: 'formula' }) as const;

export const styled = (styles: unknown): { styles: NodeStyles } => ({
  styles: styles as NodeStyles,
});

export const heading = (text: Text, level: number, styles?: unknown): TreeNode => ({
  type: 'buildr/heading',
  props: { text: val(text), level: s(level) } as never,
  ...(styles === undefined ? {} : styled(styles)),
});

export const text = (value: Text, styles?: unknown): TreeNode => ({
  type: 'buildr/text',
  props: { text: val(value) } as never,
  ...(styles === undefined ? {} : styled(styles)),
});

export const button = (
  label: Text,
  props: { variant?: string; href?: Text; size?: string; type?: string } = {},
): TreeNode => ({
  type: 'buildr/button',
  props: {
    label: val(label),
    ...(props.variant === undefined ? {} : { variant: s(props.variant) }),
    ...(props.size === undefined ? {} : { size: s(props.size) }),
    ...(props.type === undefined ? {} : { type: s(props.type) }),
    ...(props.href === undefined ? {} : { href: val(props.href) }),
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

/**
 * A full-width band with the theme's vertical rhythm, tighter on a phone. (Tablets keep the
 * desktop rhythm: every template is part of the registry manifest, which has a size budget.)
 */
export const section = (
  children: readonly TreeNode[],
  props: { container?: string; ariaLabel?: string; as?: string } = {},
  extraStyles: { base?: Record<string, unknown>; bp?: Record<string, unknown> } = {},
): TreeNode => ({
  type: 'buildr/section',
  props: {
    container: s(props.container ?? 'lg'),
    ...(props.as === undefined ? {} : { as: s(props.as) }),
    ...(props.ariaLabel === undefined ? {} : { ariaLabel: s(props.ariaLabel) }),
  } as never,
  children,
  ...styled({
    base: {
      spacing: { padding: { top: '$space.16', bottom: '$space.16' } },
      ...extraStyles.base,
    },
    bp: {
      mobile: { spacing: { padding: { top: '$space.8', bottom: '$space.8' } } },
      ...extraStyles.bp,
    },
  }),
});

export const centered = { layout: { align: 'center' }, typography: { textAlign: 'center' } };
