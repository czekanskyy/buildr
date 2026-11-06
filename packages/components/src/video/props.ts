import { p } from '@next-buildr/core';

/** The shape of the picture: `auto` follows the video itself. */
export const VIDEO_ASPECT_RATIOS = ['16:9', '4:3', '1:1', '9:16', '21:9', 'auto'] as const;
export const VIDEO_FITS = ['contain', 'cover'] as const;
export const VIDEO_PRELOADS = ['none', 'metadata'] as const;

/**
 * `video` and `poster` hold a media library reference or, outside the library,
 * `{ external: true, url }` (ADR-028): an external URL is validated by the renderer on every
 * render (HTTPS, no credentials, the host's `externalMediaHosts`) and the editor asks for
 * confirmation before it stores one.
 */
export const videoProps = {
  video: p.media({ label: 'Video', accept: ['video'], bindable: true }),
  poster: p.media({ label: 'Poster', accept: ['image'], bindable: true }),
  /** The accessible name of the video (required): what it shows, for someone who cannot see it. */
  title: p.text({ label: 'Accessible name', default: '', bindable: true, localizable: true }),
  /** An optional WebVTT captions file. */
  captions: p.media({ label: 'Captions (WebVTT)', accept: ['text'] }),
  /** The language of the captions (a BCP 47 tag); empty uses the page language. */
  captionsLanguage: p.text({ label: 'Captions language', default: '' }),
  /** The name of the captions track in the player; empty uses a built-in label. */
  captionsLabel: p.text({ label: 'Captions label', default: '', localizable: true }),
  /** Always on while `autoplay` is: a visitor must be able to pause a video that starts by itself. */
  controls: p.boolean({ label: 'Controls', default: true }),
  loop: p.boolean({ label: 'Loop', default: false }),
  /** Starts by itself. Always muted, and with controls, so it never plays sound unasked. */
  autoplay: p.boolean({ label: 'Autoplay (muted)', default: false }),
  muted: p.boolean({ label: 'Muted', default: false }),
  preload: p.select({
    label: 'Preload',
    options: VIDEO_PRELOADS,
    default: 'metadata',
    optionLabels: { none: 'Nothing', metadata: 'Length and first frame' },
  }),
  aspectRatio: p.select({
    label: 'Aspect ratio',
    options: VIDEO_ASPECT_RATIOS,
    default: '16:9',
    optionLabels: { auto: 'As the video' },
  }),
  fit: p.select({ label: 'Fit', options: VIDEO_FITS, default: 'contain' }),
} as const;
