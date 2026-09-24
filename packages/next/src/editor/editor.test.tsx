import { describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }));
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  },
}));

const { BuildrEditorPage, editorMetadata } = await import('./index.ts');

const manifest = { hash: 'h', components: {} } as never;
const base = {
  collection: 'pages',
  id: 7,
  loginUrl: '/admin/login',
  returnTo: '/buildr/edit/pages/7',
  manifest,
  render: (props: unknown) => props as never,
};

describe('BuildrEditorPage', () => {
  it('hands serializable props to the client file for a signed-in editor', async () => {
    const out = await BuildrEditorPage({ ...base, authorize: () => true });
    expect(out).toEqual({
      manifest,
      canvasUrl: '/buildr/canvas',
      documentRef: { collection: 'pages', id: 7 },
    });
    expect(() => JSON.stringify(out)).not.toThrow();
  });

  it('passes config and a custom canvas URL through', async () => {
    const out = (await BuildrEditorPage({
      ...base,
      authorize: async () => true,
      canvasUrl: '/c',
      config: { theme: 'dark' },
    })) as unknown as { canvasUrl: string; config: unknown };
    expect(out.canvasUrl).toBe('/c');
    expect(out.config).toEqual({ theme: 'dark' });
  });

  it('sends a visitor to the login page and back', async () => {
    await expect(BuildrEditorPage({ ...base, authorize: () => false })).rejects.toThrow(
      'NEXT_REDIRECT /admin/login?redirect=%2Fbuildr%2Fedit%2Fpages%2F7',
    );
  });

  it('never redirects off site, and does not reveal the editor to a forbidden user', async () => {
    await expect(
      BuildrEditorPage({ ...base, loginUrl: 'https://evil.test', authorize: () => false }),
    ).rejects.toThrow('NEXT_REDIRECT /?redirect=');
    await expect(BuildrEditorPage({ ...base, authorize: () => 'forbidden' })).rejects.toThrow(
      'NEXT_NOT_FOUND',
    );
  });

  it('is never indexed', () => {
    expect(editorMetadata.robots).toEqual({ index: false, follow: false });
  });
});
