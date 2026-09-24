import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createNextPlatform, isInternalHref } from './platform.tsx';

const platform = createNextPlatform();

describe('createNextPlatform', () => {
  it('tells internal paths from external URLs', () => {
    for (const href of ['/a', '#top', '?page=2']) expect(isInternalHref(href)).toBe(true);
    for (const href of ['//evil.test', 'https://x.test', 'mailto:a@b.c', 'javascript:0', 'a/b']) {
      expect(isInternalHref(href)).toBe(false);
    }
  });

  it('renders an external link as a plain anchor and protects a new tab', () => {
    const { Link } = platform;
    const html = renderToStaticMarkup(
      <Link href="https://x.test" target="_blank" rel="nofollow">
        x
      </Link>,
    );
    expect(html).toContain('href="https://x.test"');
    expect(html).toContain('rel="nofollow noopener noreferrer"');
  });

  it('renders an internal link through next/link', () => {
    const { Link } = platform;
    expect(renderToStaticMarkup(<Link href="/about">About</Link>)).toContain('href="/about"');
  });

  it('renders images with and without dimensions', () => {
    const { Image } = platform;
    expect(renderToStaticMarkup(<Image src="/a.png" alt="A" width={10} height={5} />)).toContain(
      'alt="A"',
    );
    expect(renderToStaticMarkup(<Image src="/b.png" alt="B" />)).toContain('src="/b.png"');
  });

  it('points a form at the plugin endpoint, escaping every part', () => {
    expect(platform.formAction('pages:12', 'nodeId0001')).toBe(
      '/api/buildr/forms/pages/12/nodeId0001',
    );
    expect(platform.formAction('a/b:c d', 'n')).toBe('/api/buildr/forms/a%2Fb/c%20d/n');
    expect(createNextPlatform({ formAction: (r, n) => `/x/${r}/${n}` }).formAction('r', 'n')).toBe(
      '/x/r/n',
    );
  });
});
