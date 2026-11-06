import type { MediaAsset } from '@next-buildr/core';
import type { BuilderComponentProps } from '@next-buildr/react';
import { type CSSProperties, createElement, type ReactNode } from 'react';
import {
  hostsFrom,
  type MediaProblem,
  type MediaSource,
  resolveMediaSource,
} from '../media/external.ts';
import {
  BACKGROUND_ATTACHMENTS,
  BACKGROUND_FITS,
  BACKGROUND_POSITIONS,
  CONTAINER_ELEMENTS,
  type containerProps,
  OVERLAY_TONES,
} from './props.ts';

type Props = BuilderComponentProps<typeof containerProps>;

const ELEMENTS: ReadonlySet<string> = new Set(CONTAINER_ELEMENTS);

/** The value if it is one of the options, else the fallback (a stored value can be anything). */
function oneOf<T extends string>(options: readonly T[], value: unknown, fallback: T): T {
  return options.includes(value as T) ? (value as T) : fallback;
}

/** An opacity from the prop: a number clamped to 0..1, 0.5 when it is not one. */
function opacityOf(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(1, Math.max(0, value))
    : 0.5;
}

/**
 * One image as the decorative layer it is: library images go through the platform's `Image`, an
 * external one is a plain `img` (the platform's image optimiser is for hosts the site knows), which
 * sends no referrer.
 */
function imageLayer(
  source: MediaSource,
  className: string,
  platform: Props['platform'],
  key: string,
) {
  const asset = source.asset as MediaAsset | undefined;
  if (!source.external && platform?.Image !== undefined) {
    return createElement(platform.Image, {
      key,
      className,
      src: source.url,
      alt: '',
      ...(asset?.width !== undefined ? { width: asset.width } : {}),
      ...(asset?.height !== undefined ? { height: asset.height } : {}),
    });
  }
  return createElement('img', {
    key,
    className,
    src: source.url,
    alt: '',
    loading: 'lazy',
    decoding: 'async',
    ...(source.external ? { referrerPolicy: 'no-referrer' as const } : {}),
  });
}

/**
 * The background video: muted, looping, inline and without controls, so it never plays sound or
 * takes focus. It is removed from the accessibility tree, as a background is decoration. The CSS
 * hides it under `prefers-reduced-motion`, which leaves the image or poster underneath.
 */
function videoLayer(source: MediaSource, poster: MediaSource | undefined) {
  return createElement('video', {
    key: 'video',
    className: 'bc-container__background bc-container__video',
    src: source.url,
    autoPlay: true,
    muted: true,
    loop: true,
    playsInline: true,
    preload: 'metadata',
    tabIndex: -1,
    'aria-hidden': 'true',
    disablePictureInPicture: true,
    disableRemotePlayback: true,
    ...(poster !== undefined ? { poster: poster.url } : {}),
  });
}

/** The first problem of an unusable source, for the canvas to show. */
const firstProblem = (problems: readonly MediaProblem[]): string | undefined => {
  for (const problem of problems) if (problem.kind === 'invalid') return problem.problem;
  return undefined;
};

/**
 * One root element (the chosen `as`, `div` if it is not on the allowlist). The width limit is done
 * with margins or, for `bleed`, with padding in CSS, so there is no wrapper element. Background
 * media (image, video, overlay) is one decorative, `aria-hidden` layer in front of the content in
 * source order and behind it on screen. Library media was resolved by `prepareRender`; an external
 * URL is validated here on every render (HTTPS, no credentials, `capabilities.externalMediaHosts`)
 * and, when invalid, is not rendered (the canvas gets `data-media-invalid`).
 */
export function ContainerView({ props, root, children, platform, env }: Props) {
  const requested = String(props.as);
  const tag = ELEMENTS.has(requested) ? requested : 'div';
  const hosts = hostsFrom(env, 'externalMediaHosts');

  const image = resolveMediaSource(props.backgroundImage, hosts);
  const video = resolveMediaSource(props.backgroundVideo, hosts);
  const poster = resolveMediaSource(props.backgroundPoster, hosts);
  const overlay = resolveMediaSource(props.backgroundOverlay, hosts);
  const problems = [image.problem, video.problem, poster.problem, overlay.problem];

  // The still behind (or instead of) the video: the image, else the poster.
  const still = image.source ?? poster.source;
  const tone = oneOf(OVERLAY_TONES, props.overlayTone, 'none');
  const layers: ReactNode[] = [];
  if (still !== undefined) {
    layers.push(
      imageLayer(still, 'bc-container__background bc-container__still', platform, 'still'),
    );
  }
  if (video.source !== undefined) {
    layers.push(videoLayer(video.source, poster.source ?? image.source));
  }
  if (overlay.source !== undefined) {
    layers.push(
      createElement('img', {
        key: 'overlay',
        className: 'bc-container__overlay-image',
        src: overlay.source.url,
        alt: '',
        loading: 'lazy',
        decoding: 'async',
        ...(overlay.source.external ? { referrerPolicy: 'no-referrer' as const } : {}),
      }),
    );
  }

  const hasMedia = layers.length > 0 || tone !== 'none';
  const external = [image, video, poster, overlay].some((r) => r.source?.external === true);
  const invalid = env?.mode === 'canvas' ? firstProblem(problems) : undefined;

  const media = hasMedia
    ? createElement(
        'span',
        {
          className: 'bc-container__media',
          'aria-hidden': 'true',
          'data-fit': oneOf(BACKGROUND_FITS, props.backgroundFit, 'cover'),
          'data-position': oneOf(BACKGROUND_POSITIONS, props.backgroundPosition, 'center'),
          'data-attachment': oneOf(BACKGROUND_ATTACHMENTS, props.backgroundAttachment, 'scroll'),
          'data-overlay': tone,
          style: { '--bc-overlay-opacity': opacityOf(props.overlayOpacity) } as CSSProperties,
        },
        layers,
      )
    : null;

  return createElement(
    tag,
    {
      ...root,
      'data-display': String(props.display),
      'data-width': String(props.width),
      ...(props.bleed ? { 'data-bleed': '' } : {}),
      ...(hasMedia ? { 'data-has-background': '' } : {}),
      ...(video.source !== undefined ? { 'data-has-video': '' } : {}),
      ...(external ? { 'data-external-media': '' } : {}),
      ...(invalid !== undefined ? { 'data-media-invalid': invalid } : {}),
      // A role on `main`, `nav`, `header`... would override the landmark (`<main role="group">`), so
      // it applies to a plain `div` only (a stack always was one).
      ...(tag === 'div' && props.role !== 'none' ? { role: String(props.role) } : {}),
      // A landmark needs a name to be exposed as one (`section`, `aside`, `nav`, `header`, `footer`).
      ...(props.ariaLabel !== '' ? { 'aria-label': props.ariaLabel } : {}),
    },
    media,
    children,
  );
}
