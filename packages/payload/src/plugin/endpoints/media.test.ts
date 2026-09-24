import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mediaListResponseSchema } from '../../contract.ts';
import { boot, type Harness } from './endpoints.test-kit.ts';

let h: Harness;
beforeAll(async () => {
  h = await boot(
    'media',
    { media: { collection: 'media' } },
    {
      collections: [
        {
          slug: 'media',
          upload: { staticDir: mkdtempSync(join(tmpdir(), 'buildr-media-files-')) },
          fields: [{ name: 'alt', type: 'text', required: true }],
        },
      ],
    },
  );
});
afterAll(() => h.close());

const PNG = Uint8Array.from(
  atob(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==',
  ),
  (char) => char.charCodeAt(0),
);

const upload = async (fields: { file?: File; alt?: string }, token?: string | null) => {
  const form = new FormData();
  if (fields.file !== undefined) form.set('file', fields.file);
  if (fields.alt !== undefined) form.set('alt', fields.alt);
  const { handleEndpoints } = await import('payload');
  const auth = token === undefined ? h.token : token;
  const response = await handleEndpoints({
    config: h.payload.config,
    request: new Request('http://localhost/api/buildr/media', {
      method: 'POST',
      headers: auth === null ? {} : { authorization: `JWT ${auth}` },
      body: form,
    }),
  });
  const text = await response.text();
  return { status: response.status, body: text === '' ? undefined : JSON.parse(text) };
};

describe('POST /buildr/media', () => {
  it('uploads a file with its alt and answers a MediaAsset', async () => {
    const { status, body } = await upload({
      file: new File([PNG], 'pixel.png', { type: 'image/png' }),
      alt: '  A pixel ',
    });
    expect(status).toBe(201);
    expect(body).toMatchObject({ alt: 'A pixel', mimeType: 'image/png' });
    expect(typeof body.url).toBe('string');
  });

  it('refuses an upload with no alt (422), no file (400) or no login (401)', async () => {
    const file = new File([PNG], 'x.png', { type: 'image/png' });
    expect((await upload({ file })).status).toBe(422);
    expect((await upload({ file, alt: '  ' })).status).toBe(422);
    expect((await upload({ alt: 'x' })).status).toBe(400);
    expect((await upload({ file, alt: 'x' }, null)).status).toBe(401);
  });

  it('refuses a foreign origin and a JSON body', async () => {
    const foreign = await h.call('POST', '/buildr/media', {
      body: {},
      headers: { origin: 'https://evil.test' },
    });
    expect(foreign.status).toBe(415);
    const { handleEndpoints } = await import('payload');
    const form = new FormData();
    form.set('alt', 'x');
    const response = await handleEndpoints({
      config: h.payload.config,
      request: new Request('http://localhost/api/buildr/media', {
        method: 'POST',
        headers: { authorization: `JWT ${h.token}`, origin: 'https://evil.test' },
        body: form,
      }),
    });
    expect(response.status).toBe(403);
  });
});

describe('GET /buildr/media', () => {
  it('lists, searches and filters by type', async () => {
    await upload({ file: new File([PNG], 'cat.png', { type: 'image/png' }), alt: 'A cat' });
    await upload({ file: new File(['%PDF'], 'doc.pdf', { type: 'application/pdf' }), alt: 'Doc' });
    const all = mediaListResponseSchema.parse((await h.call('GET', '/buildr/media')).body);
    expect(all.items.length).toBeGreaterThanOrEqual(3);
    expect(all.page).toBe(1);
    const images = mediaListResponseSchema.parse(
      (await h.call('GET', '/buildr/media?type=image')).body,
    );
    expect(images.items.every((item) => item.mimeType.startsWith('image/'))).toBe(true);
    expect(images.items.length).toBe(all.items.length - 1);
    const found = mediaListResponseSchema.parse(
      (await h.call('GET', '/buildr/media?search=cat')).body,
    );
    expect(found.items.map((item) => item.alt)).toEqual(['A cat']);
  });

  it('validates the query and the caller: 400, 401', async () => {
    expect((await h.call('GET', '/buildr/media?type=exe')).status).toBe(400);
    expect((await h.call('GET', '/buildr/media?page=0')).status).toBe(400);
    expect((await h.call('GET', '/buildr/media', { token: null })).status).toBe(401);
  });
});
