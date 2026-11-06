import { markResolvedMedia } from '@next-buildr/react';
import { describe, expect, it } from 'vitest';
import {
  checkExternalUrl,
  EXTERNAL_URL_MAX_LENGTH,
  hostIsAllowed,
  hostsFrom,
  isExternalMedia,
  resolveMediaSource,
} from './external.ts';

describe('checkExternalUrl', () => {
  it('accepts an HTTPS URL and returns it normalised', () => {
    expect(checkExternalUrl('  https://Example.com/a b.mp4?x=1  ')).toEqual({
      ok: true,
      url: 'https://example.com/a%20b.mp4?x=1',
      host: 'example.com',
    });
  });

  it.each([
    ['http://example.com/a', 'not-https'],
    ['//example.com/a', 'invalid'],
    ['/relative.mp4', 'invalid'],
    ['javascript:alert(1)', 'not-https'],
    ['data:text/html,<b>x</b>', 'not-https'],
    ['ftp://example.com/a', 'not-https'],
    ['https://user:secret@example.com/a', 'credentials'],
    ['https://user@example.com/a', 'credentials'],
    ['https://', 'invalid'],
    ['not a url', 'invalid'],
    ['', 'empty'],
    ['   ', 'empty'],
  ])('rejects %j as %s', (raw, problem) => {
    expect(checkExternalUrl(raw)).toEqual({ ok: false, problem });
  });

  it.each([undefined, null, 5, {}, ['https://example.com']])('rejects the non-string %j', (raw) => {
    expect(checkExternalUrl(raw)).toEqual({ ok: false, problem: 'empty' });
  });

  it('bounds the length', () => {
    const long = `https://example.com/${'a'.repeat(EXTERNAL_URL_MAX_LENGTH)}`;
    expect(checkExternalUrl(long)).toEqual({ ok: false, problem: 'too-long' });
    const fits = `https://example.com/${'a'.repeat(EXTERNAL_URL_MAX_LENGTH - 'https://example.com/'.length)}`;
    expect(checkExternalUrl(fits).ok).toBe(true);
  });

  it('applies the host allowlist to the host and its subdomains, never to a lookalike', () => {
    const allowed = ['cdn.example.com', '*.videos.test'];
    expect(checkExternalUrl('https://cdn.example.com/a', allowed).ok).toBe(true);
    expect(checkExternalUrl('https://eu.cdn.example.com/a', allowed).ok).toBe(true);
    expect(checkExternalUrl('https://a.videos.test/a', allowed).ok).toBe(true);
    expect(checkExternalUrl('https://videos.test/a', allowed).ok).toBe(true);
    for (const url of [
      'https://example.com/a',
      'https://evilcdn.example.com/a',
      'https://cdn.example.com.evil.test/a',
      'https://evil.test/https://cdn.example.com/',
      'https://cdn.example.com@evil.test/a',
    ]) {
      expect(checkExternalUrl(url, allowed).ok, url).toBe(false);
    }
  });

  it('allows no host for an explicit empty allowlist, and every host for none', () => {
    expect(checkExternalUrl('https://example.com/a', [])).toEqual({
      ok: false,
      problem: 'host-not-allowed',
    });
    expect(checkExternalUrl('https://example.com/a', undefined).ok).toBe(true);
  });
});

describe('hostIsAllowed', () => {
  it('is case-insensitive and ignores a trailing dot and empty entries', () => {
    expect(hostIsAllowed('CDN.Example.com.', ['example.COM'])).toBe(true);
    expect(hostIsAllowed('example.com', ['', ' '])).toBe(false);
  });
});

describe('hostsFrom', () => {
  it('reads the list from the env capabilities, and ignores anything that is not a list', () => {
    expect(hostsFrom({ capabilities: { iframeHosts: ['a.test', 1] } }, 'iframeHosts')).toEqual([
      'a.test',
    ]);
    expect(hostsFrom({ capabilities: { iframeHosts: [] } }, 'iframeHosts')).toEqual([]);
    expect(hostsFrom({ capabilities: {} }, 'iframeHosts')).toBeUndefined();
    expect(hostsFrom({ capabilities: { iframeHosts: undefined } }, 'iframeHosts')).toBeUndefined();
    expect(hostsFrom({}, 'externalMediaHosts')).toBeUndefined();
    expect(hostsFrom(null, 'externalMediaHosts')).toBeUndefined();
  });
});

describe('hostsFrom fails closed', () => {
  it.each(['a.test', true, 1, {}, null])(
    'treats a present list that is %j as no host allowed',
    (list) => {
      const env = { capabilities: { externalMediaHosts: list, iframeHosts: list } };
      expect(hostsFrom(env, 'externalMediaHosts')).toEqual([]);
      expect(hostsFrom(env, 'iframeHosts')).toEqual([]);
      expect(checkExternalUrl('https://a.test/x', hostsFrom(env, 'externalMediaHosts')).ok).toBe(
        false,
      );
    },
  );
});

describe('resolveMediaSource', () => {
  it('marks a library asset as not external and keeps relative URLs', () => {
    const asset = markResolvedMedia({ id: 'm', url: '/media/a.jpg', mimeType: 'image/jpeg' });
    const { source } = resolveMediaSource(asset, ['only.test']);
    expect(source).toMatchObject({ url: '/media/a.jpg', external: false, mimeType: 'image/jpeg' });
    expect(source?.asset).toBe(asset);
  });

  it('rejects an unsafe library URL', () => {
    expect(
      resolveMediaSource(
        markResolvedMedia({ id: 'm', url: 'javascript:alert(1)', mimeType: '' }),
        undefined,
      ),
    ).toEqual({ problem: { kind: 'invalid', problem: 'unsafe-url' } });
  });

  it('accepts a resolved library asset on any scheme the sanitiser allows, with the allowlist unset', () => {
    const asset = markResolvedMedia({ id: 'm', url: 'http://localhost:3000/a.png', mimeType: '' });
    expect(resolveMediaSource(asset, ['only.test']).source).toMatchObject({
      url: 'http://localhost:3000/a.png',
      external: false,
    });
  });

  describe('an object that the renderer did not resolve', () => {
    it.each([
      ['an http URL', { url: 'http://tracker.evil/p.gif' }, 'not-https'],
      ['a protocol-relative URL', { url: '//tracker.evil/v.mp4' }, 'invalid'],
      ['a backslash host', { url: '/\\tracker.evil/v.mp4' }, 'invalid'],
      [
        'a snapshot with an http URL',
        { id: 'x', url: 'http://tracker.evil/p.gif', mimeType: '' },
        'not-https',
      ],
      ['a javascript URL', { id: 'x', url: 'javascript:alert(1)', mimeType: '' }, 'not-https'],
      ['a data URL', { url: 'data:image/svg+xml,<svg/>' }, 'not-https'],
      ['a bare relative path', { url: 'media/a.png' }, 'invalid'],
    ])('does not render %s as a library asset', (_name, value, problem) => {
      expect(resolveMediaSource(value, undefined)).toEqual({
        problem: { kind: 'invalid', problem },
      });
    });

    it('treats a forged marker as a plain key, not as the renderer mark', () => {
      const forged = JSON.parse(
        '{"url":"http://tracker.evil/p.gif","__resolved":true,"resolved":true}',
      );
      expect(resolveMediaSource(forged, undefined).source).toBeUndefined();
    });

    it('lets an https URL through the allowlist, as an external source', () => {
      expect(resolveMediaSource({ url: 'https://cdn.test/a.png' }, ['cdn.test']).source).toEqual({
        url: 'https://cdn.test/a.png',
        external: true,
      });
      expect(resolveMediaSource({ url: 'https://other.test/a.png' }, ['cdn.test'])).toEqual({
        problem: { kind: 'invalid', problem: 'host-not-allowed' },
      });
    });

    it('allows a same-origin path, keeping only plain facts about it', () => {
      const { source } = resolveMediaSource(
        {
          id: 'm',
          url: '/media/a.png',
          mimeType: 'image/png',
          alt: 'A',
          width: 10,
          sizes: { big: { url: 'http://tracker.evil/p.gif', width: 5 } },
        },
        ['only.test'],
      );
      expect(source).toMatchObject({ url: '/media/a.png', external: false, mimeType: 'image/png' });
      expect(source?.asset).toEqual({
        id: 'm',
        url: '/media/a.png',
        mimeType: 'image/png',
        alt: 'A',
        width: 10,
      });
    });
  });

  it('marks and validates an external source', () => {
    const ok = resolveMediaSource({ external: true, url: 'https://a.test/v.mp4' }, ['a.test']);
    expect(ok.source).toEqual({ url: 'https://a.test/v.mp4', external: true });
    expect(resolveMediaSource({ external: true, url: 'http://a.test/v.mp4' }, undefined)).toEqual({
      problem: { kind: 'invalid', problem: 'not-https' },
    });
    expect(resolveMediaSource({ external: true, url: 'https://b.test/v.mp4' }, ['a.test'])).toEqual(
      {
        problem: { kind: 'invalid', problem: 'host-not-allowed' },
      },
    );
  });

  it('treats an absent or unreadable value as nothing', () => {
    expect(resolveMediaSource(null, undefined)).toEqual({ problem: { kind: 'none' } });
    expect(resolveMediaSource(undefined, undefined)).toEqual({ problem: { kind: 'none' } });
    expect(resolveMediaSource({ source: 'x', collection: 'media', id: '1' }, undefined)).toEqual({
      problem: { kind: 'none' },
    });
    expect(resolveMediaSource('https://a.test/x.jpg', undefined)).toEqual({
      problem: { kind: 'invalid', problem: 'invalid' },
    });
  });

  it('recognises the external marker only as `external: true` with a string URL', () => {
    expect(isExternalMedia({ external: true, url: 'https://a.test' })).toBe(true);
    expect(isExternalMedia({ external: 'true', url: 'https://a.test' })).toBe(false);
    expect(isExternalMedia({ external: true })).toBe(false);
    expect(isExternalMedia(null)).toBe(false);
  });
});
