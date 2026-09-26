import type { Platform, PlatformImageProps, PlatformLinkProps } from '@next-buildr/react';
import Image from 'next/image';
import Link from 'next/link';

/** Internal when it is a path on this site: `/x`, `#x`, `?x`; not `//host` and not a scheme. */
export function isInternalHref(href: string): boolean {
  if (href.startsWith('//')) return false;
  return href.startsWith('/') || href.startsWith('#') || href.startsWith('?');
}

function NextLink({ href, ...rest }: PlatformLinkProps) {
  if (isInternalHref(href)) return <Link href={href} {...(rest as Record<string, unknown>)} />;
  // An external URL is a plain anchor: no client-side routing, and a new tab never gets `window.opener`.
  const rel = new Set((rest.rel ?? '').split(/\s+/).filter(Boolean));
  if (rest.target === '_blank') {
    rel.add('noopener');
    rel.add('noreferrer');
  }
  const { rel: _rel, ...others } = rest;
  return <a href={href} {...others} {...(rel.size > 0 ? { rel: [...rel].join(' ') } : {})} />;
}

function NextImage({ src, alt, width, height, priority, ...rest }: PlatformImageProps) {
  // `next/image` needs dimensions; without them the image is still shown, unoptimized.
  if (width === undefined || height === undefined) {
    // biome-ignore lint/performance/noImgElement: no known dimensions, so next/image cannot be used
    return <img src={src} alt={alt} {...rest} />;
  }
  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      {...(priority === undefined ? {} : { priority })}
      {...rest}
    />
  );
}

export interface NextPlatformOptions {
  /**
   * The URL a form of the layout `ref` (`{collection}:{id}`) posts to. Defaults to the Payload
   * plugin endpoint `/api/buildr/forms/:collection/:id/:nodeId`.
   */
  readonly formAction?: (ref: string, nodeId: string) => string;
}

/** The `Platform` of a Next.js application (docs/nextjs.md): `next/link`, `next/image` and the form endpoint. */
export function createNextPlatform(options: NextPlatformOptions = {}): Platform {
  return {
    Link: NextLink,
    Image: NextImage,
    formAction(ref, nodeId) {
      if (options.formAction !== undefined) return options.formAction(ref, nodeId);
      const [collection = '', ...id] = ref.split(':');
      return `/api/buildr/forms/${encodeURIComponent(collection)}/${encodeURIComponent(id.join(':'))}/${encodeURIComponent(nodeId)}`;
    },
  };
}
