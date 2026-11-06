import type { BuilderComponentProps } from '@next-buildr/react';
import { createElement } from 'react';
import { hostsFrom, resolveMediaSource } from '../media/external.ts';
import { message } from '../messages/index.ts';
import { VIDEO_ASPECT_RATIOS, VIDEO_FITS, VIDEO_PRELOADS, type videoProps } from './props.ts';

type Props = BuilderComponentProps<typeof videoProps>;

function oneOf<T extends string>(options: readonly T[], value: unknown, fallback: T): T {
  return options.includes(value as T) ? (value as T) : fallback;
}

const LANGUAGE = /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;

/**
 * One `<video>` root. Library media was resolved by `prepareRender`; an external URL is validated
 * here on every render and, when invalid, nothing is rendered (the canvas shows an empty frame
 * marked `data-media-invalid`). An autoplaying video is always muted, inline and has controls, so
 * it never plays sound unasked and a visitor can stop it (WCAG 1.4.2, 2.2.2). The name is
 * required (`aria-label`); the captions track is optional.
 */
export function VideoView({ props, root, env }: Props) {
  const hosts = hostsFrom(env, 'externalMediaHosts');
  const video = resolveMediaSource(props.video, hosts);
  const poster = resolveMediaSource(props.poster, hosts);
  const captions = resolveMediaSource(props.captions, hosts);

  if (video.source === undefined) {
    if (env.mode !== 'canvas') return null;
    return createElement('div', {
      ...root,
      'data-empty': '',
      ...(video.problem.kind === 'invalid' ? { 'data-media-invalid': video.problem.problem } : {}),
    });
  }

  const autoplay = props.autoplay === true;
  const name = props.title.trim();
  const language = LANGUAGE.test(props.captionsLanguage) ? props.captionsLanguage : env.locale;
  const label = props.captionsLabel !== '' ? props.captionsLabel : message(env, 'video.captions');
  const external = [video, poster, captions].some((r) => r.source?.external === true);

  const track =
    captions.source !== undefined
      ? createElement('track', {
          key: 'captions',
          kind: 'captions',
          src: captions.source.url,
          srcLang: language,
          label,
        })
      : null;

  return createElement(
    'video',
    {
      ...root,
      src: video.source.url,
      ...(poster.source !== undefined ? { poster: poster.source.url } : {}),
      ...(name !== '' ? { 'aria-label': name } : {}),
      controls: props.controls === true || autoplay,
      loop: props.loop === true,
      autoPlay: autoplay,
      muted: props.muted === true || autoplay,
      playsInline: true,
      preload: oneOf(VIDEO_PRELOADS, props.preload, 'metadata'),
      'data-ratio': oneOf(VIDEO_ASPECT_RATIOS, props.aspectRatio, '16:9'),
      'data-fit': oneOf(VIDEO_FITS, props.fit, 'contain'),
      // `video` and `track` elements have no `referrerpolicy` attribute, so an external file or
      // track is fetched with the page's own referrer policy: a host that uses external video sets a
      // page-level `Referrer-Policy` (docs/components.md).
      ...(external ? { 'data-external-media': '' } : {}),
    },
    track,
  );
}
