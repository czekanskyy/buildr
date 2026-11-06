import type { MediaAsset } from '@next-buildr/core';
import type { BuilderComponentProps } from '@next-buildr/react';
import { createElement } from 'react';
import { hostsFrom, resolveMediaSource } from '../media/external.ts';
import { IMAGE_FITS, type imageProps } from './props.ts';
import { buildSrcSet, objectPosition, SIZES_ATTRIBUTE } from './source.ts';

type Props = BuilderComponentProps<typeof imageProps>;

const FITS: readonly string[] = IMAGE_FITS;
const positive = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n > 0;

/**
 * The alternative text: none for a decorative image; else the author's, else the one stored with
 * the media asset, else empty (and the `image-alt` rule has already said so in the editor).
 */
export function altOf(
  props: Pick<Props['props'], 'alt' | 'decorative'>,
  asset: Pick<MediaAsset, 'alt'>,
): string {
  if (props.decorative) return '';
  return props.alt !== '' ? props.alt : (asset.alt ?? '');
}

export function ImageView({ props, root, platform, env }: Props) {
  const { source } = resolveMediaSource(props.image, hostsFrom(env, 'externalMediaHosts'));

  if (source === undefined) {
    // Nothing to show. The editor's canvas shows where the image will go; a published page shows nothing.
    return env.mode === 'canvas' ? createElement('div', { ...root, 'data-empty': '' }) : null;
  }

  if (source.external) {
    // An external image (ADR-028) is a plain `img`: no `srcset`, no focal point, and no referrer.
    const fit = FITS.includes(String(props.fit)) ? String(props.fit) : 'cover';
    return createElement('img', {
      ...root,
      src: source.url,
      alt: props.decorative ? '' : props.alt,
      'data-fit': fit,
      'data-external-media': '',
      loading: props.priority ? 'eager' : 'lazy',
      decoding: 'async',
      referrerPolicy: 'no-referrer',
      ...(props.decorative ? { role: 'presentation' } : {}),
    });
  }

  const asset = source.asset as MediaAsset;
  const src = source.url;
  const fit = FITS.includes(String(props.fit)) ? String(props.fit) : 'cover';
  const position = objectPosition(asset.focalPoint);
  const attributes = {
    ...root,
    src,
    alt: altOf(props, asset),
    sizes: SIZES_ATTRIBUTE[String(props.sizes)] ?? SIZES_ATTRIBUTE['full'],
    'data-fit': fit,
    ...(buildSrcSet(asset) !== undefined ? { srcSet: buildSrcSet(asset) } : {}),
    ...(positive(asset.width) ? { width: asset.width } : {}),
    ...(positive(asset.height) ? { height: asset.height } : {}),
    ...(position !== undefined ? { style: { objectPosition: position } } : {}),
    ...(props.priority ? { priority: true } : {}),
    ...(props.decorative ? { role: 'presentation' } : {}),
  };

  if (platform !== undefined) return createElement(platform.Image, attributes as never);
  // Without a platform there is no `priority`: the closest plain-HTML equivalent is eager loading.
  const { priority: _priority, ...img } = attributes as typeof attributes & { priority?: boolean };
  return createElement('img', {
    ...img,
    loading: props.priority ? 'eager' : 'lazy',
    decoding: 'async',
  });
}
