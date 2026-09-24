import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = { enabled: false };
vi.mock('next/headers', () => ({
  draftMode: async () => ({
    get isEnabled() {
      return state.enabled;
    },
    enable: () => {
      state.enabled = true;
    },
    disable: () => {
      state.enabled = false;
    },
  }),
}));

const { PreviewBanner, createExitPreviewRoute, createPreviewRoute, safeRedirectPath } =
  await import('./index.ts');

beforeEach(() => {
  state.enabled = false;
});

const request = (query: string) => new Request(`https://site.test/buildr/preview${query}`);

describe('safeRedirectPath', () => {
  it('accepts only paths on this site', () => {
    expect(safeRedirectPath('/pl/about?x=1#y')).toBe('/pl/about?x=1#y');
    const hostile = [
      'https://evil.test',
      '//evil.test',
      '/\\evil.test',
      '\\\\evil.test',
      'javascript:alert(1)',
      '/ok\nLocation: x',
      '/a\u0000b',
      'evil.test',
      '',
      null,
      undefined,
    ];
    for (const value of hostile) expect(safeRedirectPath(value)).toBe('/');
    expect(safeRedirectPath('//x', '/home')).toBe('/home');
  });
});

describe('createPreviewRoute', () => {
  it('answers 401 and leaves draft mode off when authorization fails', async () => {
    const GET = createPreviewRoute({ authorize: () => false });
    const response = await GET(request('?path=/a'));
    expect(response.status).toBe(401);
    expect(state.enabled).toBe(false);
  });

  it('enables draft mode and redirects to the relative path', async () => {
    const GET = createPreviewRoute({ authorize: async () => true });
    const response = await GET(request('?path=/pl/about'));
    expect(response.status).toBe(307);
    expect(response.headers.get('Location')).toBe('/pl/about');
    expect(state.enabled).toBe(true);
  });

  it('never redirects off site', async () => {
    const GET = createPreviewRoute({ authorize: () => true, defaultPath: '/home' });
    for (const path of ['https://evil.test', '//evil.test', '/\\evil.test']) {
      const response = await GET(request(`?path=${encodeURIComponent(path)}`));
      expect(response.headers.get('Location')).toBe('/home');
    }
    expect((await GET(request(''))).headers.get('Location')).toBe('/home');
  });

  it('passes the request to authorize', async () => {
    const seen: string[] = [];
    const GET = createPreviewRoute({
      authorize: (req) => {
        seen.push(new URL(req.url).searchParams.get('secret') ?? '');
        return false;
      },
    });
    await GET(request('?secret=s'));
    expect(seen).toEqual(['s']);
  });
});

describe('createExitPreviewRoute', () => {
  it('turns draft mode off and redirects safely', async () => {
    state.enabled = true;
    const GET = createExitPreviewRoute();
    const response = await GET(request('?path=//evil.test'));
    expect(state.enabled).toBe(false);
    expect(response.headers.get('Location')).toBe('/');
    expect((await GET(request('?path=/blog'))).headers.get('Location')).toBe('/blog');
  });
});

describe('PreviewBanner', () => {
  it('renders nothing unless draft mode is on', async () => {
    expect(await PreviewBanner({ message: 'Draft', exitLabel: 'Exit' })).toBeNull();
    state.enabled = true;
    const html = renderToStaticMarkup(
      (await PreviewBanner({ message: 'Draft', exitLabel: 'Exit', returnTo: '/a b' })) as never,
    );
    expect(html).toContain('Draft');
    expect(html).toContain('href="/buildr/preview/exit?path=%2Fa%20b"');
  });
});
