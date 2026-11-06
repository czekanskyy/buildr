import type { BuilderComponentProps } from '@next-buildr/react';
import { createElement } from 'react';
import { checkExternalUrl, hostsFrom } from '../media/external.ts';
import {
  IFRAME_ASPECT_RATIOS,
  IFRAME_REFERRER_POLICY,
  IFRAME_SANDBOX,
  type iframeProps,
} from './props.ts';

type Props = BuilderComponentProps<typeof iframeProps>;

/**
 * One `<iframe>` root (ADR-028). The URL is validated on every render (HTTPS, no credentials,
 * bounded length, the host's `iframeHosts` allowlist) and an invalid one renders nothing (the
 * canvas shows an empty frame marked `data-embed-invalid`). Always `sandbox`ed with
 * `IFRAME_SANDBOX`, `referrerpolicy="no-referrer"` and `loading="lazy"`; no `allow` features. The
 * `title` is the accessible name and wins over an author `title` attribute.
 */
export function IframeView({ props, root, env }: Props) {
  const checked = checkExternalUrl(props.url, hostsFrom(env, 'iframeHosts'));

  if (!checked.ok) {
    if (env.mode !== 'canvas') return null;
    return createElement('div', {
      ...root,
      'data-empty': '',
      ...(checked.problem !== 'empty' ? { 'data-embed-invalid': checked.problem } : {}),
    });
  }

  const ratio = IFRAME_ASPECT_RATIOS.includes(props.aspectRatio as never)
    ? String(props.aspectRatio)
    : '16:9';
  const name = props.title.trim();
  return createElement('iframe', {
    ...root,
    src: checked.url,
    ...(name !== '' ? { title: name } : {}),
    sandbox: IFRAME_SANDBOX,
    referrerPolicy: IFRAME_REFERRER_POLICY,
    loading: 'lazy',
    'data-ratio': ratio,
    'data-external-media': '',
  });
}
