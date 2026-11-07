import type { PayloadRequest } from 'payload';
import { describe, expect, it } from 'vitest';
import { type ClientIpSource, clientIpOf } from './client-ip.ts';

const request = (headers: Record<string, string> = {}) =>
  ({ headers: new Headers(headers) }) as PayloadRequest;

describe('clientIpOf', () => {
  it('preserves the old default including unvalidated values and whitespace', () => {
    expect(
      clientIpOf(request({ 'x-forwarded-for': ' spoofed , 192.0.2.1', 'x-real-ip': 'other' })),
    ).toBe('spoofed');
    expect(clientIpOf(request({ 'x-forwarded-for': ' ,x', 'x-real-ip': ' untrimmed ' }))).toBe(
      'untrimmed',
    );
    expect(clientIpOf(request())).toBe('unknown');
  });
  it('selects the configured hop from the right and validates IPv4 and IPv6', () => {
    const req = request({ 'trusted-ip': '192.0.2.1, 2001:db8::1, 198.51.100.1' });
    expect(clientIpOf(req, { header: 'trusted-ip' })).toBe('198.51.100.1');
    expect(clientIpOf(req, { header: 'trusted-ip', hops: 2 })).toBe('2001:db8:0:0::/64');
    expect(clientIpOf(req, { header: 'trusted-ip', hops: 3 })).toBe('192.0.2.1');
  });
  it.each([undefined, '', 'unknown', '192.0.2.1:80', '[2001:db8::1]', '999.2.3.4', 'example.com'])(
    'shares one unknown bucket for bad configured addresses: %s',
    (value) => {
      const req = request({
        'x-forwarded-for': '192.0.2.9',
        'x-real-ip': '192.0.2.8',
        ...(value === undefined ? {} : { trusted: value }),
      });
      expect(clientIpOf(req, { header: 'trusted' })).toBe('unknown');
      expect(clientIpOf(req, () => value)).toBe('unknown');
    },
  );
  it('never falls back for a short chain or throwing callback, and passes the request', () => {
    const req = request({ trusted: '192.0.2.1', 'x-real-ip': '192.0.2.8' });
    expect(clientIpOf(req, { header: 'trusted', hops: 2 })).toBe('unknown');
    const source: ClientIpSource = (received) => {
      expect(received).toBe(req);
      return ' 2001:db8::1 ';
    };
    expect(clientIpOf(req, source)).toBe('2001:db8:0:0::/64');
    expect(
      clientIpOf(req, () => {
        throw new Error('private details');
      }),
    ).toBe('unknown');
  });
});

it('normalises mapped IPv4 and groups IPv6 by /64 across spellings and zones', () => {
  const key = (ip: string) => clientIpOf(request(), () => ip);
  expect(key('::ffff:192.0.2.1')).toBe(key('192.0.2.1'));
  expect(key('::ffff:c000:201')).toBe(key('192.0.2.1'));
  expect(key('2001:db8::1')).toBe(key('2001:0db8:0000:0000:ffff:0:0:2'));
  expect(key('2001:db8:0:1::1')).not.toBe(key('2001:db8::1'));
  expect(key('fe80::1%eth0')).toBe('unknown');
});
