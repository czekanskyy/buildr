import type { HTMLAttributes, ReactNode } from 'react';

const cx = (...parts: (string | undefined)[]) => parts.filter(Boolean).join(' ');

export interface PanelProps extends HTMLAttributes<HTMLElement> {
  /** The element: a landmark `aside` for the shell's side panels, a `section` inside them. */
  readonly as?: 'aside' | 'section' | 'div';
  readonly children?: ReactNode;
}

/**
 * The panel frame (docs/editor-design.md#panel-anatomy): a flat column that scrolls as one; its
 * header and footer stick to the top and bottom edge of it.
 */
export function Panel({ as: Tag = 'div', className, ...rest }: PanelProps) {
  return <Tag {...rest} className={cx('bd-panel', className)} />;
}

/** The 40px header: tabs or a title. Sticks to the top of the panel. */
export function PanelHeader({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div {...rest} className={cx('bd-panel-header', className)} />;
}

/** The content, with `--bd-space-4` padding on every side. */
export function PanelBody({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div {...rest} className={cx('bd-panel-body', className)} />;
}

/** Optional actions or a summary; sticks to the bottom of the panel. */
export function PanelFooter({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div {...rest} className={cx('bd-panel-footer', className)} />;
}
