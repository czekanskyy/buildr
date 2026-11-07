import type { BuilderComponentProps } from '@next-buildr/react';
import { buildSrcSet, SIZES_ATTRIBUTE } from '../image/source.ts';
import { hostsFrom, resolveMediaSource } from '../media/external.ts';
import { message } from '../messages/index.ts';
import type { galleryItemProps } from './props.ts';
export function GalleryItemView({
  props,
  root,
  env,
}: BuilderComponentProps<typeof galleryItemProps>) {
  const { source } = resolveMediaSource(props.image, hostsFrom(env, 'externalMediaHosts'));
  const alt = props.alt || source?.asset?.alt || '';
  return (
    // biome-ignore lint/a11y/useSemanticElements: Loop wrappers require ARIA list semantics.
    <div {...root} role="listitem" data-empty={source ? undefined : ''}>
      <figure>
        {source && (
          <a
            className="bc-gallery-item__link"
            href={source.url}
            // Caption-only links repeat the visible caption for an explicit accessible name.
            aria-label={alt || props.caption || message(env, 'gallery.openImage')}
            rel={source.external ? 'noreferrer' : undefined}
          >
            <img
              src={source.url}
              alt={alt}
              loading="lazy"
              decoding="async"
              referrerPolicy={source.external ? 'no-referrer' : undefined}
              srcSet={source.asset ? buildSrcSet(source.asset) : undefined}
              // biome-ignore lint/complexity/useLiteralKeys: Index signature access is required by TypeScript.
              sizes={source.asset ? SIZES_ATTRIBUTE['full'] : undefined}
            />
          </a>
        )}
        {props.caption && <figcaption>{props.caption}</figcaption>}
      </figure>
    </div>
  );
}
