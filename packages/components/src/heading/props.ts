import { p } from '@next-buildr/core';

export const HEADING_LEVELS = [1, 2, 3, 4, 5, 6] as const;

/**
 * What element a heading renders as. `heading` (the default) is `h{level}`; the others are for text
 * that is styled like a heading but is not part of the outline.
 */
export const HEADING_TAGS = ['heading', 'p', 'span', 'div', 'strong'] as const;

export const headingProps = {
  text: p.text({ label: 'Text', default: 'Heading', bindable: true }),
  /** The document outline level. How big it looks is a style, not the level. */
  level: p.select({ label: 'Level', options: HEADING_LEVELS, default: 2 }),
  /**
   * The element to render. `heading` (default) renders `h{level}`. Any other tag renders that element
   * with no heading semantics (no role, no `aria-level`) and is skipped by the heading a11y rules;
   * `level` is then ignored.
   */
  tag: p.select({
    label: 'Tag',
    options: HEADING_TAGS,
    default: 'heading',
    optionLabels: {
      heading: 'Heading (by level)',
      p: 'Paragraph',
      span: 'Span',
      div: 'Div',
      strong: 'Bold',
    },
  }),
} as const;
