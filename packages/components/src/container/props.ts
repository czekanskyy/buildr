import { p } from '@next-buildr/core';

/** How the container lays out its children; `block` is the plain box. */
export const CONTAINER_DISPLAYS = ['flex', 'block', 'grid', 'inline-flex', 'inline-block'] as const;

/** Elements a container may be: the sectioning and landmark elements that take flow content. */
export const CONTAINER_ELEMENTS = [
  'div',
  'section',
  'header',
  'footer',
  'main',
  'aside',
  'nav',
  'article',
] as const;

/** Widths of the content column, from the theme's `container` tokens; `none` lifts the limit. */
export const CONTAINER_WIDTHS = ['none', 'sm', 'md', 'lg', 'xl'] as const;

/**
 * `none` adds no role; `group` needs an accessible name; `list` needs `buildr/list-item` children.
 * Applied only when the element is a `div`: a landmark or sectioning element keeps its own role.
 */
export const CONTAINER_ROLES = ['none', 'group', 'list'] as const;

/** How the background media fills the box: cropped (`cover`) or whole (`contain`). */
export const BACKGROUND_FITS = ['cover', 'contain'] as const;
export const BACKGROUND_POSITIONS = [
  'center',
  'top',
  'bottom',
  'left',
  'right',
  'top-left',
  'top-right',
  'bottom-left',
  'bottom-right',
] as const;
/** `fixed` keeps the media still while the page scrolls past it; reduced motion turns it into `scroll`. */
export const BACKGROUND_ATTACHMENTS = ['scroll', 'fixed'] as const;
/** A scrim over the media: a tint of the text (`dark`) or surface (`light`) colour, for legible content. */
export const OVERLAY_TONES = ['none', 'dark', 'light'] as const;

export const containerProps = {
  display: p.select({
    label: 'Display',
    options: CONTAINER_DISPLAYS,
    default: 'flex',
    optionLabels: {
      flex: 'Flex',
      block: 'Box',
      grid: 'Grid',
      'inline-flex': 'Inline flex',
      'inline-block': 'Inline box',
    },
  }),
  as: p.select({ label: 'Element', options: CONTAINER_ELEMENTS, default: 'div' }),
  width: p.select({
    label: 'Max width',
    options: CONTAINER_WIDTHS,
    default: 'lg',
    optionLabels: { none: 'No limit' },
  }),
  bleed: p.boolean({ label: 'Full-width background', default: false }),
  /**
   * The background media props hold a media library reference or, outside the library,
   * `{ external: true, url }` (ADR-028): the renderer checks external URLs (HTTPS, no credentials,
   * the host's allowlist) on every render, the editor asks for confirmation before it stores one.
   */
  backgroundImage: p.media({ label: 'Background image', accept: ['image'], bindable: true }),
  /** Loops silently, muted and without controls; with reduced motion the image or poster shows instead. */
  backgroundVideo: p.media({ label: 'Background video', accept: ['video'], bindable: true }),
  /** Shown while the video loads and, with reduced motion, instead of it. */
  backgroundPoster: p.media({ label: 'Video poster', accept: ['image'], bindable: true }),
  /** An image over the media (a texture, a gradient with alpha). */
  backgroundOverlay: p.media({ label: 'Overlay image', accept: ['image'] }),
  overlayTone: p.select({
    label: 'Overlay',
    options: OVERLAY_TONES,
    default: 'none',
    optionLabels: { none: 'None', dark: 'Dark', light: 'Light' },
  }),
  overlayOpacity: p.number({ label: 'Overlay strength', default: 0.5, min: 0, max: 1, step: 0.05 }),
  backgroundFit: p.select({ label: 'Media fit', options: BACKGROUND_FITS, default: 'cover' }),
  backgroundPosition: p.select({
    label: 'Media position',
    options: BACKGROUND_POSITIONS,
    default: 'center',
    optionLabels: {
      'top-left': 'Top left',
      'top-right': 'Top right',
      'bottom-left': 'Bottom left',
      'bottom-right': 'Bottom right',
    },
  }),
  backgroundAttachment: p.select({
    label: 'Media scrolling',
    options: BACKGROUND_ATTACHMENTS,
    default: 'scroll',
    optionLabels: { scroll: 'Scrolls with the page', fixed: 'Fixed' },
  }),
  role: p.select({ label: 'Role (plain div only)', options: CONTAINER_ROLES, default: 'none' }),
  ariaLabel: p.text({ label: 'Accessible name', localizable: true }),
} as const;
