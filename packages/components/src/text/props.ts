import { p } from '@next-buildr/core';

/** `p` for a paragraph; `span`, `small` and `div` when a paragraph is not the right meaning. */
export const TEXT_ELEMENTS = ['p', 'span', 'small', 'div'] as const;

/**
 * How the text is written. `plain` (the default, and what every version 1 Text is) is a string with
 * line breaks. `rich` is formatted text (bold, italic, links, lists), walked and never parsed as
 * HTML. `html` is HTML written by a trusted editor (ADR-026): it needs the host's `authorCode`
 * capability, is sanitised by core on write and again on render, and without the capability the
 * Text shows its plain `text`.
 */
export const TEXT_MODES = ['plain', 'rich', 'html'] as const;

export const textProps = {
  text: p.textarea({ label: 'Text', default: '', bindable: true }),
  as: p.select({ label: 'Element', options: TEXT_ELEMENTS, default: 'p' }),
  mode: p.select({
    label: 'Mode',
    options: TEXT_MODES,
    default: 'plain',
    optionLabels: { plain: 'Plain text', rich: 'Rich text', html: 'HTML' },
  }),
  /** The content in `rich` mode. */
  rich: p.richText({ label: 'Rich text', bindable: true }),
  /** The content in `html` mode: author HTML, which needs `capabilities.authorCode` (ADR-026). */
  html: p.textarea({ label: 'HTML', default: '', bindable: true, format: 'html' }),
} as const;
