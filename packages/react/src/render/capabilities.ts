import type { HostCapabilities } from '@next-buildr/core';

const MAX_HOSTS = 200;
const MAX_HOST_LENGTH = 253;

/**
 * Fail closed on a malformed list: an array keeps its string entries (trimmed, lowercased, bounded),
 * anything else present means "no host" (`[]`), never "any host". Absent stays absent.
 */
function hostList(value: unknown): readonly string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) return [];
  const hosts = new Set<string>();
  for (const entry of value) {
    if (hosts.size >= MAX_HOSTS) break;
    if (typeof entry !== 'string') continue;
    const host = entry.trim().toLowerCase();
    if (host.length > 0 && host.length <= MAX_HOST_LENGTH) hosts.add(host);
  }
  return [...hosts];
}

/**
 * Fail closed (ADR-026, ADR-028): only an explicit `authorCode: true` survives, and the host lists
 * are validated (strings only, lowercase, bounded). Anything else — an absent object, a truthy
 * string, `1` — gives `{}`, so a host that forwards a malformed value gets the safe default.
 */
export function normalizeCapabilities(
  capabilities: HostCapabilities | null | undefined,
): HostCapabilities {
  if (typeof capabilities !== 'object' || capabilities === null) return {};
  const media = hostList(capabilities.externalMediaHosts);
  const iframes = hostList(capabilities.iframeHosts);
  return {
    ...(capabilities.authorCode === true ? { authorCode: true } : {}),
    ...(media === undefined ? {} : { externalMediaHosts: media }),
    ...(iframes === undefined ? {} : { iframeHosts: iframes }),
  };
}
