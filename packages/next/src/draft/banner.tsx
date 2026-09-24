import { draftMode } from 'next/headers';
import type { CSSProperties } from 'react';

export interface PreviewBannerProps {
  /** "Viewing a draft" — supplied by the application, in the site's language. */
  readonly message: string;
  /** "Exit preview". */
  readonly exitLabel: string;
  /** The exit route. Default `/buildr/preview/exit`. */
  readonly exitHref?: string;
  /** The page to return to when exiting: a relative path. */
  readonly returnTo?: string;
}

const style: CSSProperties = {
  position: 'fixed',
  insetBlockEnd: 0,
  insetInline: 0,
  zIndex: 2147483647,
  display: 'flex',
  gap: '1rem',
  justifyContent: 'center',
  padding: '0.5rem 1rem',
  background: '#111',
  color: '#fff',
  font: '14px system-ui, sans-serif',
};

/** A bar shown in draft mode only; renders nothing on a published visit. A Server Component. */
export async function PreviewBanner({
  message,
  exitLabel,
  exitHref = '/buildr/preview/exit',
  returnTo,
}: PreviewBannerProps) {
  if (!(await draftMode()).isEnabled) return null;
  const href =
    returnTo === undefined ? exitHref : `${exitHref}?path=${encodeURIComponent(returnTo)}`;
  return (
    <div role="status" data-buildr-preview style={style}>
      <span>{message}</span>
      <a href={href} style={{ color: 'inherit' }}>
        {exitLabel}
      </a>
    </div>
  );
}
