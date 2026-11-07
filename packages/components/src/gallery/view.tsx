// biome-ignore-all lint/a11y/useSemanticElements: Loop wrappers require ARIA list semantics.
// biome-ignore-all lint/a11y/useAriaPropsSupportedByRole: The group role and its label are set together.
import type { BuilderComponentProps } from '@next-buildr/react';
import { message } from '../messages/index.ts';
import { GalleryEnhancer } from './enhancer.client.tsx';
import type { galleryProps } from './props.ts';
export function GalleryView({
  props,
  root,
  children,
  env,
}: BuilderComponentProps<typeof galleryProps>) {
  const columns = Number.isFinite(props.columns)
    ? Math.max(2, Math.min(6, Math.round(props.columns)))
    : 3;
  return (
    <div
      {...root}
      role={props.ariaLabel ? 'group' : undefined}
      aria-label={props.ariaLabel || undefined}
    >
      <div
        className="bc-gallery__list"
        role="list"
        data-columns={columns}
        data-ratio={props.aspectRatio}
      >
        {children}
      </div>
      {props.lightbox && env.mode !== 'canvas' && (
        <GalleryEnhancer
          dialog={message(env, 'gallery.dialog')}
          close={message(env, 'gallery.close')}
          previous={message(env, 'gallery.previous')}
          next={message(env, 'gallery.next')}
          counter={message(env, 'gallery.counter')}
        />
      )}
    </div>
  );
}
