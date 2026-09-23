import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { capString, sanitizeUrl } from './sanitize.ts';

// Built via String.fromCharCode rather than a literal escape in source, so the file never embeds
// a raw control byte (which some tools, including git, treat the whole file as binary because of).
const NUL = String.fromCharCode(0);

describe('sanitizeUrl', () => {
  it.each([
    'https://example.com/path?a=1&b=2#section',
    'http://example.com',
    'mailto:hello@example.com',
    'mailto:hello@example.com?subject=hi',
    'tel:+15551234567',
    '/relative/path',
    'relative/path',
    '?query=1',
    '#anchor',
    '',
    '//example.com/protocol-relative',
    'HTTP://EXAMPLE.COM',
    'MAILTO:HELLO@EXAMPLE.COM',
  ])('accepts %j', (url) => {
    expect(sanitizeUrl(url)).toMatchObject({ ok: true });
  });

  // OWASP-style malicious URL corpus: dangerous schemes plus obfuscation via control characters,
  // whitespace, HTML entity encoding (named, decimal, hex, with and without a trailing `;`),
  // percent-encoding, case variation, and combinations thereof.
  it.each([
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    'JAVASCRIPT:alert(1)',
    '  javascript:alert(1)',
    '\t\tjavascript:alert(1)',
    '\n\njavascript:alert(1)',
    'java\tscript:alert(1)',
    'java\nscript:alert(1)',
    'java\rscript:alert(1)',
    `${NUL}javascript:alert(1)`,
    `j${NUL}avascript:alert(1)`,
    `javascript${NUL}:alert(1)`,
    'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox(1)',
    'VBSCRIPT:msgbox(1)',
    'javascript&colon;alert(1)',
    'javascript&#58;alert(1)',
    'javascript&#058;alert(1)',
    'javascript&#x3A;alert(1)',
    'javascript&#x3a;alert(1)',
    'javascript&#X3A;alert(1)',
    'javascript&#58alert(1)',
    '&#106;avascript:alert(1)',
    '&#106avascript:alert(1)',
    '&#x6A;avascript:alert(1)',
    'javascript%3Aalert(1)',
    'java%09script:alert(1)',
    'java%0ascript:alert(1)',
    'jav&#x09;ascript:alert(1)',
    'javascript:/*--></script>alert(1)',
    'file:///etc/passwd',
    'about:blank',
    'chrome://settings',
    'ftp://example.com/file',
  ])('rejects %j', (url) => {
    expect(sanitizeUrl(url)).toMatchObject({ ok: false, error: { code: 'url.unsafe-scheme' } });
  });

  it('strips control characters and surrounding whitespace from an accepted URL', () => {
    const result = sanitizeUrl(`  https://example.com/${NUL}path  `);
    expect(result).toEqual({ ok: true, value: 'https://example.com/path' });
  });

  it('never throws for arbitrary input', () => {
    fc.assert(
      fc.property(fc.string(), (url) => {
        expect(() => sanitizeUrl(url)).not.toThrow();
      }),
    );
  });

  it('property: an accepted value never resolves (after decoding) to a dangerous scheme', () => {
    const dangerous = fc.constantFrom('javascript', 'data', 'vbscript', 'file', 'about', 'chrome');
    // Only control characters as "noise" between the scheme and the colon — a plain space there
    // (unlike inside the scheme's own leading whitespace) breaks scheme recognition for a real URL
    // parser too, so it isn't obfuscation and legitimately produces a relative (accepted) result.
    const obfuscated = fc
      .tuple(
        dangerous,
        fc.constantFrom('', '\t', '\n', '\r', NUL),
        fc.constantFrom(':', '&colon;', '&#58;', '&#x3A;', '%3A'),
      )
      .map(([scheme, noise, colon]) => `${noise}${scheme}${noise}${colon}alert(1)`);

    fc.assert(
      fc.property(obfuscated, (url) => {
        const result = sanitizeUrl(url);
        expect(result.ok).toBe(false);
      }),
    );
  });
});

describe('capString', () => {
  it('returns the string unchanged when under the limit', () => {
    expect(capString('hi', 5)).toBe('hi');
  });

  it('returns the string unchanged when exactly at the limit', () => {
    expect(capString('hello', 5)).toBe('hello');
  });

  it('truncates a string over the limit', () => {
    expect(capString('hello world', 5)).toBe('hello');
  });

  it('truncates to the empty string for a non-positive limit', () => {
    expect(capString('hello', 0)).toBe('');
    expect(capString('hello', -5)).toBe('');
  });

  it('never throws for arbitrary input', () => {
    fc.assert(
      fc.property(fc.string(), fc.integer(), (value, maxLength) => {
        expect(() => capString(value, maxLength)).not.toThrow();
      }),
    );
  });

  it('property: the result never exceeds maxLength and is always a prefix of the input', () => {
    fc.assert(
      fc.property(fc.string(), fc.nat({ max: 1000 }), (value, maxLength) => {
        const result = capString(value, maxLength);
        expect(result.length).toBeLessThanOrEqual(Math.max(maxLength, 0));
        expect(value.startsWith(result)).toBe(true);
      }),
    );
  });
});
