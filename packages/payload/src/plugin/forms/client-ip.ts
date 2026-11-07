import { isIP } from 'node:net';
import type { PayloadRequest } from 'payload';

export type ClientIpSource =
  | { readonly header: string; readonly hops?: number }
  | ((req: PayloadRequest) => string | undefined);

/** A configured, trusted source never falls back to client-controlled forwarding headers. */
export function clientIpOf(req: PayloadRequest, source?: ClientIpSource): string {
  if (source === undefined) {
    const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
    return forwarded || req.headers.get('x-real-ip') || 'unknown';
  }
  try {
    const chain =
      typeof source === 'function' ? undefined : req.headers.get(source.header)?.split(',');
    const raw = typeof source === 'function' ? source(req) : chain?.at(-(source.hops ?? 1));
    const ip = typeof raw === 'string' ? raw.trim() : '';
    if (ip.includes('%')) return 'unknown';
    const family = isIP(ip);
    if (family === 4) return ip;
    if (family !== 6) return 'unknown';
    // URL canonicalisation expands dotted IPv4 tails and compresses equivalent IPv6 spellings.
    const canonical = new URL(`http://[${ip}]/`).hostname.slice(1, -1);
    const [left = '', right = ''] = canonical.split('::');
    const head = left ? left.split(':') : [];
    const tail = right ? right.split(':') : [];
    const words = canonical.includes('::')
      ? [...head, ...Array<string>(8 - head.length - tail.length).fill('0'), ...tail]
      : head;
    const nums = words.map((word) => Number.parseInt(word, 16));
    if (nums.slice(0, 5).every((word) => word === 0) && nums[5] === 65535) {
      const a = nums[6] ?? 0;
      const b = nums[7] ?? 0;
      return `${a >> 8}.${a & 255}.${b >> 8}.${b & 255}`;
    }
    return `${nums
      .slice(0, 4)
      .map((word) => word.toString(16))
      .join(':')}::/64`;
  } catch {
    return 'unknown';
  }
}
