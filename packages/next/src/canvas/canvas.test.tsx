import { describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }));
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
}));

const { BuildrCanvasPage, buildrSecurityHeaders, canvasMetadata } = await import('./index.ts');
const { headers } = await import('next/headers');

describe('BuildrCanvasPage', () => {
  it('renders its children for an authorized caller and opts into dynamic rendering', async () => {
    const out = await BuildrCanvasPage({ authorize: async () => true, children: 'canvas' });
    expect(out).toMatchObject({ props: { children: 'canvas' } });
    expect(headers).toHaveBeenCalled();
  });

  it('answers not found when the caller is not authorized', async () => {
    await expect(BuildrCanvasPage({ authorize: () => false, children: 'x' })).rejects.toThrow(
      'NEXT_NOT_FOUND',
    );
  });

  it('is never indexed', () => {
    expect(canvasMetadata.robots).toEqual({ index: false, follow: false });
  });
});

describe('buildrSecurityHeaders', () => {
  const rules = buildrSecurityHeaders();
  const of = (source: string) =>
    Object.fromEntries(
      rules.find((r) => r.source === source)?.headers.map((h) => [h.key, h.value]) ?? [],
    );

  it('lets only this site frame the canvas, uncached and unindexed', () => {
    expect(of('/buildr/canvas')).toEqual({
      'Content-Security-Policy': "frame-ancestors 'self'",
      'Cache-Control': 'private, no-store',
      'X-Robots-Tag': 'noindex',
    });
  });

  it('forbids framing the editor', () => {
    expect(of('/buildr/edit/:path*')['Content-Security-Policy']).toBe("frame-ancestors 'none'");
    expect(of('/buildr/edit/:path*')['X-Robots-Tag']).toBe('noindex');
  });

  it('lets this site frame every other page, and excludes the two routes from that rule', () => {
    const rule = rules[2];
    expect(rule?.source).toBe('/((?!buildr/canvas|buildr/edit).*)');
    expect(rule?.headers).toEqual([
      { key: 'Content-Security-Policy', value: "frame-ancestors 'self'" },
    ]);
  });

  it('follows custom paths', () => {
    const custom = buildrSecurityHeaders({ canvasPath: '/x/canvas', editPath: '/x/edit' });
    expect(custom.map((r) => r.source)).toEqual([
      '/x/canvas',
      '/x/edit/:path*',
      '/((?!x/canvas|x/edit).*)',
    ]);
  });
});
