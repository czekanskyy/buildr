import { p } from '@next-buildr/core';

export const IFRAME_ASPECT_RATIOS = ['16:9', '4:3', '1:1', '9:16', '21:9'] as const;

/**
 * The sandbox of every iframe (ADR-028): scripts may run, and nothing else is granted: no same
 * origin (so a framed page on the site's own origin cannot lift its sandbox), no forms, popups,
 * modals, downloads, top-level navigation or pointer lock. There is no prop for it: widening it is
 * a decision for a future ADR and host control, never an author setting.
 */
export const IFRAME_SANDBOX = 'allow-scripts';

/** No referrer is sent to the embedded page. */
export const IFRAME_REFERRER_POLICY = 'no-referrer';

export const iframeProps = {
  /**
   * An external page, `https` only (no credentials, at most 2048 characters, a host on the host's
   * `iframeHosts` allowlist when it sets one). The renderer checks it on every render; the editor
   * asks for the "Zewnętrzne źródło" confirmation before it stores one (ADR-028).
   */
  url: p.text({ label: 'Address (https)', default: '', bindable: true }),
  /** The accessible name of the frame (required): what it contains. */
  title: p.text({ label: 'Accessible name', default: '', bindable: true, localizable: true }),
  aspectRatio: p.select({
    label: 'Aspect ratio',
    options: IFRAME_ASPECT_RATIOS,
    default: '16:9',
  }),
} as const;
