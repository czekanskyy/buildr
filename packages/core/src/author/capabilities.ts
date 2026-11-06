import { z } from 'zod';

/**
 * What the host permits beyond the safe defaults. `authorCode` (ADR-026) lets trusted editors
 * write custom CSS, class names, HTML attributes and Text HTML. It is off unless a host sets it
 * to exactly `true`, and every write and render path checks it (core fails closed: an absent
 * object, an absent key or any other value means no).
 */
export interface HostCapabilities {
  readonly authorCode?: boolean | undefined;
  /**
   * Hosts external image, video and background media may come from (ADR-028). Absent: any HTTPS
   * host. A list restricts media to those hosts and their subdomains; an empty list allows none.
   */
  readonly externalMediaHosts?: readonly string[] | undefined;
  /** The same for `buildr/iframe` URLs (ADR-028). */
  readonly iframeHosts?: readonly string[] | undefined;
}

/** For validating a capabilities object that arrives over a boundary (config, postMessage). */
export const hostCapabilitiesSchema: z.ZodType<HostCapabilities> = z.strictObject({
  authorCode: z.boolean().optional(),
  externalMediaHosts: z.array(z.string().min(1).max(253)).max(200).optional(),
  iframeHosts: z.array(z.string().min(1).max(253)).max(200).optional(),
});

/** Whether author code is permitted: only an explicit `true`. */
export function authorCodeEnabled(capabilities: HostCapabilities | null | undefined): boolean {
  return (
    typeof capabilities === 'object' && capabilities !== null && capabilities.authorCode === true
  );
}
